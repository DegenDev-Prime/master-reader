import { estimateChunkSeconds, NarrationStoppedError, type NarratorEngine } from './engine';
import type { SpeechChunk } from './chunker';
import { isSleepTimerExpired, type SleepTimerState } from './sleep-timer';
import type { NarrationStatus } from './types';

export type PlayOptions = {
  chunks: SpeechChunk[];
  startIndex?: number;
  voiceId?: string | null;
  language?: string;
  rate: number;
};

export type FinishReason = 'finished' | 'stopped' | 'sleep' | 'endOfChapter';

export type NarratorListener = {
  onStatus?: (status: NarrationStatus) => void;
  onChunk?: (index: number) => void;
  onDone?: (reason: FinishReason) => void;
  onError?: (error: Error) => void;
};

export type NarratorDeps = {
  engine: NarratorEngine;
  /** Current sleep state; consulted before every chunk. */
  getSleepState: () => SleepTimerState;
  nowMs: () => number;
  /**
   * The rate the next chunk is spoken at. Read for every chunk so a speed
   * change applies to the rest of the run, not only to the chunk that is
   * already playing.
   */
  getRate: () => number;
  onProgress: (chunkIndex: number) => void;
};

/**
 * Chunk-by-chunk playback orchestration. Engine-agnostic and free of RN/DB
 * imports: the host injects the engine, clock, sleep state and progress sink,
 * which keeps this unit-testable with a fake engine.
 *
 * `play` starts a run and returns immediately. The run itself lives in the
 * background and reports through the listener, so a caller that awaits
 * `play` is never blocked for the length of a chapter. `finished` resolves
 * when the run ends.
 */
export class Narrator {
  private runId = 0;
  private stopped = true;
  private status: NarrationStatus = 'idle';
  private run: Promise<void> | null = null;

  constructor(
    private readonly deps: NarratorDeps,
    private readonly listener: NarratorListener = {},
  ) {}

  get currentStatus(): NarrationStatus {
    return this.status;
  }

  /** Resolves when the current run ends. */
  get finished(): Promise<void> {
    return this.run ?? Promise.resolve();
  }

  /**
   * Starts playback from `startIndex`. Returns as soon as the run is under
   * way; the run reports progress through the listener.
   */
  play(options: PlayOptions): void {
    this.runId += 1;
    const run = this.runId;
    this.stopped = false;
    const { chunks } = options;
    const start = clampIndex(options.startIndex ?? 0, chunks.length);
    this.setStatus('loading');
    this.run = this.loop(run, options, chunks, start);
  }

  /**
   * Applies a new rate to the running utterance. Returns false when the engine
   * cannot change it live, so the caller restarts the chunk instead.
   */
  async setRate(rate: number): Promise<boolean> {
    const setRate = this.deps.engine.setRate;
    if (!setRate) return false;
    try {
      return await setRate.call(this.deps.engine, rate);
    } catch {
      return false;
    }
  }

  async pause(): Promise<void> {
    this.stopped = true;
    this.runId += 1;
    try {
      await this.deps.engine.stop();
    } finally {
      this.setStatus('paused');
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.runId += 1;
    try {
      await this.deps.engine.stop();
    } finally {
      this.setStatus('idle');
    }
  }

  private async loop(
    run: number,
    options: PlayOptions,
    chunks: SpeechChunk[],
    start: number,
  ): Promise<void> {
    const request = (index: number) => ({
      chunk: chunks[index],
      voiceId: options.voiceId,
      language: options.language,
      rate: this.deps.getRate(),
    });
    // A queueing engine keeps the next utterance behind the current one, so
    // the gap between chunks is the engine's own switch time, not a synthesis
    // round trip.
    const queues = this.deps.engine.queues === true;
    let index = start;
    /** A chunk the engine was already asked to speak, for queueing engines. */
    let queued: Promise<void> | null = null;

    while (index < chunks.length) {
      if (this.stopped || run !== this.runId) return;
      const sleep = this.deps.getSleepState();
      if (isSleepTimerExpired(sleep, this.deps.nowMs())) {
        // A chunk may be queued behind the one that just finished; the
        // engine has to be told, or it would keep speaking.
        await this.clearQueue();
        this.setStatus('paused');
        this.listener.onDone?.('sleep');
        return;
      }
      this.setStatus('playing');
      this.listener.onChunk?.(index);
      this.deps.onProgress(index);

      const speaking = queued ?? this.deps.engine.speak(request(index));
      queued = null;

      const nextIndex = index + 1;
      if (queues && nextIndex < chunks.length) {
        // Ask for the next chunk now: the engine prepares it while this one
        // plays. The rejection is handled here so a failure in the lookahead
        // never surfaces as an unhandled rejection.
        queued = this.deps.engine.speak(request(nextIndex));
        void queued.catch(() => undefined);
      } else {
        // The engine plays one file at a time, so the next chunks are
        // synthesized ahead instead: the file is ready when it is needed.
        const upcoming = [nextIndex, nextIndex + 1]
          .filter((next) => next < chunks.length)
          .map((next) => request(next));
        try {
          this.deps.engine.prefetch?.(upcoming);
        } catch {
          // Prefetch is best-effort; the foreground speak carries errors.
        }
      }

      try {
        await speaking;
      } catch (error) {
        if (run !== this.runId || this.stopped || error instanceof NarrationStoppedError) {
          this.setStatus('paused');
          this.listener.onDone?.('stopped');
          return;
        }
        this.setStatus('error');
        this.listener.onError?.(error instanceof Error ? error : new Error(String(error)));
        await this.clearQueue();
        return;
      }
      index = nextIndex;
    }

    if (run !== this.runId || this.stopped) return;
    if (this.deps.getSleepState().mode === 'endOfChapter') {
      this.setStatus('paused');
      this.listener.onDone?.('endOfChapter');
      return;
    }
    this.setStatus('idle');
    this.listener.onDone?.('finished');
  }

  /** Drops a chunk the engine was asked to speak ahead of time. */
  private async clearQueue(): Promise<void> {
    try {
      await this.deps.engine.stop();
    } catch {
      // The engine is going away anyway.
    }
  }

  private setStatus(status: NarrationStatus): void {
    this.status = status;
    this.listener.onStatus?.(status);
  }
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(Math.max(0, Math.floor(index)), length - 1);
}

/**
 * Maps a seconds-based skip onto a chunk index using spoken-duration
 * estimates, so ±15s skip works even though engines report no timing.
 */
export function chunkIndexAfterSeconds(
  chunks: SpeechChunk[],
  fromIndex: number,
  seconds: number,
  rate: number,
): number {
  if (chunks.length === 0) return 0;
  if (seconds >= 0) {
    let remaining = seconds;
    let index = clampIndex(fromIndex, chunks.length);
    while (index < chunks.length - 1) {
      remaining -= estimateChunkSeconds(chunks[index].text, rate);
      if (remaining <= 0) break;
      index += 1;
    }
    return index;
  }
  let remaining = -seconds;
  let index = clampIndex(fromIndex, chunks.length);
  // The current chunk is spoken from its start, so its own length comes off
  // first. A skip shorter than the chunk rewinds to the start of it.
  remaining -= estimateChunkSeconds(chunks[index].text, rate);
  while (remaining > 0 && index > 0) {
    index -= 1;
    remaining -= estimateChunkSeconds(chunks[index].text, rate);
  }
  return index;
}
