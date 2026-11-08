import {
  appendChunks,
  createClipStack,
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

/**
 * The only effectful piece of synthesis. A neural implementation writes a WAV
 * and returns its URI; a live engine can return a synthetic URI and resolve
 * immediately, in which case the narrator plays through the engine instead.
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
  onUpdate?: (stack: ClipStack) => void;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Single-flight synthesis worker. The native model is stateful and CPU-bound,
 * so exactly one job runs at a time; throughput comes from synthesising ahead
 * of the playhead, never from parallel workers.
 */
export class ClipWorker {
  private readonly synth: ClipSynthesizer;
  private readonly policy: RetryPolicy;
  private readonly lookahead: number;
  private readonly delay: (ms: number) => Promise<void>;
  private readonly onUpdate?: (stack: ClipStack) => void;

  private stack: ClipStack | null = null;
  private playIndex = 0;
  private stopped = true;
  private run: Promise<void> | null = null;

  constructor(options: ClipWorkerOptions) {
    this.synth = options.synth;
    this.policy = options.policy ?? DEFAULT_RETRY_POLICY;
    this.lookahead = Math.max(0, options.lookahead ?? DEFAULT_LOOKAHEAD);
    this.delay = options.delay ?? wait;
    this.onUpdate = options.onUpdate;
  }

  get snapshot(): ClipStack | null {
    return this.stack;
  }

  load(sessionId: number, chunks: readonly SpeechChunk[], playIndex = 0): void {
    this.stack = createClipStack(sessionId, chunks);
    this.playIndex = Math.max(0, playIndex);
    this.stopped = false;
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
  }

  async warmUp(): Promise<void> {
    await this.synth.warmup?.();
  }

  async release(): Promise<void> {
    this.stop();
    await this.synth.release?.();
  }

  /** Resolves after the current worker loop drains. Tests use this. */
  async whenIdle(): Promise<void> {
    while (this.run) await this.run;
  }

  private emit(): void {
    if (this.stack) this.onUpdate?.(this.stack);
  }

  private nextJob(): number | null {
    if (!this.stack) return null;
    return planPrefetch(this.stack, this.playIndex, this.lookahead)[0] ?? null;
  }

  private kick(): void {
    if (this.stopped || this.run || !this.stack) return;
    this.run = this.loop().finally(() => {
      this.run = null;
      if (!this.stopped && this.nextJob() != null) this.kick();
    });
  }

  private async loop(): Promise<void> {
    while (!this.stopped && this.stack) {
      const index = this.nextJob();
      if (index == null) return;

      const session = this.stack.sessionId;
      const chunk = this.stack.chunks[index];
      if (!chunk) return;

      this.stack = markSynthesizing(this.stack, index);
      this.emit();

      try {
        const result = await this.synth.synthesize(chunk.text);
        if (this.stopped || !this.stack || this.stack.sessionId !== session) return;
        this.stack = markReady(this.stack, index, {
          uri: result.uri,
          durationMs: result.durationMs ?? null,
        });
        this.emit();
      } catch (error) {
        if (this.stopped || !this.stack || this.stack.sessionId !== session) return;
        const message = error instanceof Error ? error.message : String(error);
        this.stack = recordFailure(this.stack, index, message, this.policy);
        this.emit();

        if (this.stack.clips[index].phase === 'failed') {
          await this.delay(retryDelayMs(this.stack.clips[index].attempts, this.policy));
          if (this.stopped || !this.stack || this.stack.sessionId !== session) return;
          this.stack = markPending(this.stack, index);
          this.emit();
        }
      }
    }
  }
}
