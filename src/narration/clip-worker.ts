import {
  appendChunks,
  createClipStack,
  failUnreadyClips,
  markDead,
  markPending,
  markReady,
  markSynthesizing,
  planPrefetch,
  recordFailure,
  resetClip,
  retryDelayMs,
  type ClipStack,
  type RetryPolicy,
  DEFAULT_LOOKAHEAD,
  DEFAULT_RETRY_POLICY,
} from './clip-stack';
import type { SpeechChunk } from './chunker';

export type SynthResult = {
  uri: string;
  durationMs?: number | null;
};

/** A failure the worker can classify. Permanent failures latch the backend. */
export class SynthError extends Error {
  constructor(
    message: string,
    readonly permanent = false,
  ) {
    super(message);
    this.name = 'SynthError';
  }
}

/**
 * The only effectful piece of synthesis. Every backend writes a WAV and
 * returns its URI; playback, speed and pause stay with the player.
 */
export type ClipSynthesizer = {
  synthesize(text: string): Promise<SynthResult>;
  warmup?(): Promise<void>;
  release?(): Promise<void>;
};

export type ClipWorkerOptions = {
  synth: ClipSynthesizer;
  policy?: RetryPolicy;
  lookahead?: number;
  /** Injected so retry timing is unit-testable without real timers. */
  delay?: (ms: number) => Promise<void>;
  /** A synth promise that never settles must not wedge the session. */
  synthTimeoutMs?: number;
  /** Consecutive failed clips before the whole backend is assumed dead. */
  breakerThreshold?: number;
  onUpdate?: (stack: ClipStack) => void;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const DEFAULT_SYNTH_TIMEOUT_MS = 60_000;
const DEFAULT_BREAKER_THRESHOLD = 4;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SynthError('Synthesis timed out.', true)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Single-flight synthesis worker. The native model is stateful and CPU-bound,
 * so exactly one job runs at a time; throughput comes from synthesising ahead
 * of the playhead, never from parallel workers. Retries are timed outside the
 * loop so a failing clip cannot stall the clips behind it.
 */
export class ClipWorker {
  private readonly synth: ClipSynthesizer;
  private readonly policy: RetryPolicy;
  private readonly lookahead: number;
  private readonly delay: (ms: number) => Promise<void>;
  private readonly synthTimeoutMs: number;
  private readonly breakerThreshold: number;
  private readonly onUpdate?: (stack: ClipStack) => void;

  private stack: ClipStack | null = null;
  private playIndex = 0;
  private stopped = true;
  private latched = false;
  private consecutiveFailures = 0;
  private run: Promise<void> | null = null;
  private retries = new Map<number, Promise<void>>();

  constructor(options: ClipWorkerOptions) {
    this.synth = options.synth;
    this.policy = options.policy ?? DEFAULT_RETRY_POLICY;
    this.lookahead = Math.max(0, options.lookahead ?? DEFAULT_LOOKAHEAD);
    this.delay = options.delay ?? wait;
    this.synthTimeoutMs = options.synthTimeoutMs ?? DEFAULT_SYNTH_TIMEOUT_MS;
    this.breakerThreshold = Math.max(1, options.breakerThreshold ?? DEFAULT_BREAKER_THRESHOLD);
    this.onUpdate = options.onUpdate;
  }

  get snapshot(): ClipStack | null {
    return this.stack;
  }

  load(sessionId: number, chunks: readonly SpeechChunk[], playIndex = 0): void {
    this.stack = createClipStack(sessionId, chunks);
    this.playIndex = Math.max(0, playIndex);
    this.stopped = false;
    this.latched = false;
    this.consecutiveFailures = 0;
    this.retries.clear();
    this.emit();
    this.kick();
  }

  append(chunks: readonly SpeechChunk[]): void {
    if (!this.stack || chunks.length === 0) return;
    this.stack = appendChunks(this.stack, chunks);
    this.emit();
    this.kick();
  }

  setPlayIndex(index: number): void {
    this.playIndex = Math.max(0, Math.floor(index));
    this.kick();
  }

  retry(index: number): void {
    if (!this.stack) return;
    this.stack = resetClip(this.stack, index);
    this.latched = false;
    this.consecutiveFailures = 0;
    this.emit();
    this.kick();
  }

  discard(index: number): void {
    if (!this.stack) return;
    this.stack = markDead(this.stack, index);
    this.emit();
  }

  stop(): void {
    this.stopped = true;
    this.stack = null;
    this.retries.clear();
  }

  async warmUp(): Promise<void> {
    await this.synth.warmup?.();
  }

  async release(): Promise<void> {
    this.stop();
    await this.synth.release?.().catch(() => undefined);
  }

  /** Resolves after the current worker loop and any pending retries drain. */
  async whenIdle(): Promise<void> {
    while (this.run || this.retries.size > 0) {
      const retries = [...this.retries.values()];
      if (this.run) await this.run;
      if (retries.length > 0) await Promise.all(retries);
    }
  }

  private emit(): void {
    if (this.stack) this.onUpdate?.(this.stack);
  }

  private nextJob(): number | null {
    if (!this.stack || this.latched) return null;
    return planPrefetch(this.stack, this.playIndex, this.lookahead)[0] ?? null;
  }

  private kick(): void {
    if (this.stopped || this.latched || this.run || !this.stack) return;
    this.run = this.loop().finally(() => {
      this.run = null;
      if (!this.stopped && !this.latched && this.nextJob() != null) this.kick();
    });
  }

  private scheduleRetry(index: number, attempts: number, session: number): void {
    if (this.retries.has(index)) return;
    const retry = this.delay(retryDelayMs(attempts, this.policy))
      .then(() => {
        this.retries.delete(index);
        if (this.stopped || this.latched || !this.stack || this.stack.sessionId !== session) return;
        this.stack = markPending(this.stack, index);
        this.emit();
        this.kick();
      })
      .catch(() => {
        this.retries.delete(index);
      });
    this.retries.set(index, retry);
  }

  private latch(error: string): void {
    this.latched = true;
    if (this.stack) this.stack = failUnreadyClips(this.stack, error);
    this.emit();
  }

  private async loop(): Promise<void> {
    while (!this.stopped && !this.latched && this.stack) {
      const index = this.nextJob();
      if (index == null) return;

      const session = this.stack.sessionId;
      const chunk = this.stack.chunks[index];
      if (!chunk) return;

      this.stack = markSynthesizing(this.stack, index);
      this.emit();

      try {
        const result = await withTimeout(this.synth.synthesize(chunk.text), this.synthTimeoutMs);
        if (this.stopped || !this.stack || this.stack.sessionId !== session) return;
        this.stack = markReady(this.stack, index, {
          uri: result.uri,
          durationMs: result.durationMs ?? null,
        });
        this.consecutiveFailures = 0;
        this.emit();
      } catch (error) {
        if (this.stopped || !this.stack || this.stack.sessionId !== session) return;
        const message = error instanceof Error ? error.message : String(error);
        const permanent = error instanceof SynthError && error.permanent;
        this.stack = recordFailure(this.stack, index, message, this.policy, permanent);
        this.emit();
        this.consecutiveFailures += 1;

        const dead = this.stack.clips[index].phase === 'dead';
        const tripped = permanent || (dead && this.consecutiveFailures >= this.breakerThreshold);
        if (tripped) {
          this.latch(message);
          return;
        }
        if (!dead) this.scheduleRetry(index, this.stack.clips[index].attempts, session);
      }
    }
  }
}
