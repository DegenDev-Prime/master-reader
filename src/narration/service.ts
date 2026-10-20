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
  onProgress: (chunkIndex: number) => void;
};

/**
 * Chunk-by-chunk playback orchestration. Engine-agnostic and free of RN/DB
 * imports: the host injects the engine, clock, sleep state and progress sink,
 * which keeps this unit-testable with a fake engine.
 */
export class Narrator {
  private runId = 0;
  private stopped = true;
  private status: NarrationStatus = 'idle';

  constructor(
    private readonly deps: NarratorDeps,
    private readonly listener: NarratorListener = {},
  ) {}

  get currentStatus(): NarrationStatus {
    return this.status;
  }

  async play(options: PlayOptions): Promise<void> {
    this.runId += 1;
    const run = this.runId;
    this.stopped = false;
    const { chunks } = options;
    const start = clampIndex(options.startIndex ?? 0, chunks.length);
    this.setStatus('loading');

    let index = start;
    while (index < chunks.length) {
      if (this.stopped || run !== this.runId) return;
      const sleep = this.deps.getSleepState();
      if (isSleepTimerExpired(sleep, this.deps.nowMs())) {
        this.setStatus('paused');
        this.listener.onDone?.('sleep');
        return;
      }
      this.setStatus('playing');
      this.listener.onChunk?.(index);
      this.deps.onProgress(index);
      const upcoming = [index + 1, index + 2]
        .filter((next) => next < chunks.length)
        .map((next) => ({
          chunk: chunks[next],
          voiceId: options.voiceId,
          language: options.language,
          rate: options.rate,
        }));
      try {
        const speaking = this.deps.engine.speak({
          chunk: chunks[index],
          voiceId: options.voiceId,
          language: options.language,
          rate: options.rate,
        });
        try {
          this.deps.engine.prefetch?.(upcoming);
        } catch {
          // Prefetch is best-effort; the foreground speak carries errors.
        }
        await speaking;
      } catch (error) {
        if (run !== this.runId || this.stopped || error instanceof NarrationStoppedError) {
          this.setStatus('paused');
          this.listener.onDone?.('stopped');
          return;
        }
        this.setStatus('error');
        this.listener.onError?.(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      index += 1;
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
  while (index > 0) {
    remaining -= estimateChunkSeconds(chunks[index].text, rate);
    if (remaining <= 0) break;
    index -= 1;
  }
  return index;
}
