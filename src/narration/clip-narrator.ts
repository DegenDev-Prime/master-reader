import {
  audioDuration,
  audioPosition,
  isAudioPlaying,
  pauseAudio,
  playAudioFile,
  seekAudio,
  setAudioRate,
  subscribeAudioStatus,
  unloadAudioPlayer,
} from './audio-output';
import { clipAt, nextPlayableIndex, type ClipStack } from './clip-stack';
import { ClipWorker, type ClipSynthesizer } from './clip-worker';
import type { SpeechChunk } from './chunker';
import { NarrationStoppedError } from './engine';
import type { NarratorListener, PlayOptions } from './service';
import { isSleepTimerExpired, type SleepTimerState } from './sleep-timer';
import type { NarrationStatus } from './types';

export type ClipPlayer = {
  play: (
    uri: string,
    meta: { title: string; artist: string },
    rate: number,
    isAborted: () => boolean,
    startSeconds?: number,
    onStart?: () => void,
  ) => Promise<void>;
  pause: () => Promise<void>;
  isPlaying: () => boolean;
  setRate: (rate: number) => boolean;
  positionSeconds: () => number | null;
  durationSeconds?: () => number | null;
  seek?: (seconds: number) => Promise<void>;
  subscribe?: (listener: (status: AudioPlaybackStatus) => void) => () => void;
  unload?: () => Promise<void>;
};

export type AudioPlaybackStatus = {
  playing: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  positionSeconds: number;
  durationSeconds: number;
  error: string | null;
};

export type ClipNarratorDeps = {
  synth: ClipSynthesizer;
  title: () => string;
  artist: () => string;
  getSleepState: () => SleepTimerState;
  nowMs: () => number;
  getRate: () => number;
  onProgress: (chunkIndex: number) => void;
  player?: ClipPlayer;
  /** Keeps the cached WAVs around the cursor out of the LRU sweep. */
  protect?: (uris: string[]) => void;
  /** Injected for tests; production uses a real timer. */
  retryDelay?: (ms: number) => Promise<void>;
};

const defaultPlayer: ClipPlayer = {
  play: playAudioFile,
  pause: async () => {
    await pauseAudio();
  },
  isPlaying: isAudioPlaying,
  setRate: setAudioRate,
  positionSeconds: audioPosition,
  durationSeconds: audioDuration,
  seek: seekAudio,
  subscribe: subscribeAudioStatus,
  unload: unloadAudioPlayer,
};

/**
 * Plays the clip stack. The text spine is append-only; the cursor is the only
 * playback position. A clip is played only after the worker marks it ready,
 * and a permanently failed clip is skipped rather than ending the session.
 */
export class ClipNarrator {
  private readonly deps: ClipNarratorDeps;
  private readonly listener: NarratorListener;
  private readonly player: ClipPlayer;
  private readonly worker: ClipWorker;

  private stack: ClipStack | null = null;
  private sourceChunks: readonly SpeechChunk[] | null = null;
  private sessionId = 0;
  private index = 0;
  private intoMs = 0;
  private lastPageIndex: number | null = null;
  private playing = false;
  private busy = false;
  private started = false;
  private token = 0;
  private unsubscribeStatus: (() => void) | null = null;
  private status: NarrationStatus = 'idle';
  private readonly playbackFailures = new Map<number, number>();
  private readonly warned = new Set<number>();

  constructor(deps: ClipNarratorDeps, listener: NarratorListener = {}) {
    this.deps = deps;
    this.listener = listener;
    this.player = deps.player ?? defaultPlayer;
    this.worker = new ClipWorker({
      synth: deps.synth,
      delay: deps.retryDelay,
      onUpdate: (stack) => this.onStack(stack),
    });
    this.unsubscribeStatus =
      this.player.subscribe?.((status) => {
        if (!this.started) return;
        this.listener.onPlaybackStatus?.(status);
      }) ?? null;
  }

  get currentStatus(): NarrationStatus {
    return this.status;
  }

  play(options: PlayOptions): void {
    const sameSpine = this.sourceChunks === options.chunks;
    const start = clampIndex(options.startIndex ?? 0, options.chunks.length);
    this.playing = true;
    this.busy = false;
    this.started = false;
    this.token += 1;
    void this.player.pause();
    this.index = start;
    this.intoMs = Math.max(0, options.startOffsetSeconds ?? 0) * 1000;
    this.sourceChunks = options.chunks;

    if (!sameSpine || !this.stack) {
      this.sessionId += 1;
      this.lastPageIndex = null;
      this.playbackFailures.clear();
      this.warned.clear();
      this.worker.load(this.sessionId, options.chunks, start);
    } else {
      this.syncChunks();
      this.worker.setPlayIndex(start);
    }
    this.setStatus('loading');
    void this.maybePlay();
  }

  async pause(): Promise<void> {
    this.playing = false;
    this.started = false;
    this.token += 1;
    this.busy = false;
    const position = this.player.positionSeconds();
    if (position != null) this.intoMs = position * 1000;
    await this.player.pause();
    this.setStatus('paused');
  }

  async stop(): Promise<void> {
    this.playing = false;
    this.started = false;
    this.token += 1;
    this.busy = false;
    this.worker.stop();
    this.stack = null;
    this.sourceChunks = null;
    await this.player.pause();
    this.setStatus('idle');
  }

  /** New chunks were appended to the spine by the chapter loader. */
  append(chunks: readonly SpeechChunk[]): void {
    if (this.sourceChunks !== chunks) this.sourceChunks = chunks;
    this.syncChunks();
    if (this.playing) void this.maybePlay();
  }

  /** Seeks inside the loaded clip without replacing or re-synthesising it. */
  async seekWithin(seconds: number): Promise<boolean> {
    if (!this.playing || !this.started || !this.player.seek) return false;
    this.intoMs = Math.max(0, seconds) * 1000;
    await this.player.seek(this.intoMs / 1000);
    return true;
  }

  /** User retry for a clip the worker marked dead. */
  retry(index: number): void {
    this.warned.delete(index);
    this.playbackFailures.delete(index);
    this.worker.retry(index);
    if (index === this.index) {
      this.setStatus('loading');
      if (this.playing) void this.maybePlay();
    }
  }

  async setRate(rate: number): Promise<boolean> {
    return this.player.setRate(rate);
  }

  async warmUp(): Promise<void> {
    await this.worker.warmUp();
  }

  async release(): Promise<void> {
    this.unsubscribeStatus?.();
    this.unsubscribeStatus = null;
    await this.worker.release();
    await this.player.unload?.();
  }

  /** Test seam: resolves when the synthesis worker has drained. */
  async whenIdle(): Promise<void> {
    await this.worker.whenIdle();
  }

  private syncChunks(): void {
    if (!this.sourceChunks || !this.stack) return;
    if (this.sourceChunks.length > this.stack.chunks.length) {
      this.worker.append(this.sourceChunks.slice(this.stack.chunks.length));
    }
  }

  private onStack(stack: ClipStack): void {
    this.stack = stack;
    this.deps.protect?.(
      stack.clips
        .slice(this.index, this.index + 3)
        .map((clip) => clip.audio?.uri)
        .filter((uri): uri is string => Boolean(uri)),
    );
    for (const clip of stack.clips) {
      if (clip.phase !== 'dead' || this.warned.has(clip.index)) continue;
      this.warned.add(clip.index);
      this.listener.onWarning?.(clip.index);
    }
    if (this.playing) void this.maybePlay();
  }

  private async maybePlay(): Promise<void> {
    if (!this.playing || this.busy) return;
    this.syncChunks();
    const stack = this.stack;
    if (!stack) return;
    if (stack.clips.length === 0) {
      this.finish();
      return;
    }

    let index = this.index;
    while (index < stack.clips.length && stack.clips[index].phase === 'dead') index += 1;
    if (index >= stack.clips.length) {
      this.exhausted(stack);
      return;
    }
    if (index !== this.index) {
      this.index = index;
      this.worker.setPlayIndex(index);
    }

    const clip = clipAt(stack, index);
    const chunk = stack.chunks[index];
    if (!clip || !chunk) return;
    if (clip.phase !== 'ready' || !clip.audio) {
      this.setStatus('loading');
      return;
    }

    const sleep = this.deps.getSleepState();
    if (isSleepTimerExpired(sleep, this.deps.nowMs())) {
      await this.pauseFor('sleep');
      return;
    }
    if (
      sleep.mode === 'endOfChapter' &&
      this.lastPageIndex != null &&
      chunk.pageIndex !== this.lastPageIndex
    ) {
      await this.pauseFor('endOfChapter');
      return;
    }

    this.busy = true;
    const token = ++this.token;

    try {
      await this.player.play(
        clip.audio.uri,
        { title: this.deps.title(), artist: this.deps.artist() },
        this.deps.getRate(),
        () => token !== this.token || !this.playing,
        this.intoMs / 1000,
        () => {
          if (token !== this.token || !this.playing) return;
          this.started = true;
          this.setStatus('playing');
          this.listener.onChunk?.(index);
          this.deps.onProgress(index);
        },
      );
      if (token !== this.token || !this.playing) return;
      this.started = false;
      this.lastPageIndex = chunk.pageIndex;
      this.index = index + 1;
      this.intoMs = 0;
      this.worker.setPlayIndex(this.index);
    } catch (error) {
      if (token !== this.token || !this.playing) return;
      this.started = false;
      if (error instanceof NarrationStoppedError) {
        this.setStatus('paused');
        return;
      }
      this.playbackFailed(index);
    } finally {
      if (token === this.token) this.busy = false;
    }

    if (this.playing) void this.maybePlay();
  }

  private playbackFailed(index: number): void {
    const failures = (this.playbackFailures.get(index) ?? 0) + 1;
    this.playbackFailures.set(index, failures);
    if (failures > 1) {
      this.playbackFailures.delete(index);
      this.worker.discard(index);
      this.index = index + 1;
    } else {
      this.worker.retry(index);
    }
    this.setStatus('loading');
  }

  private async pauseFor(reason: 'sleep' | 'endOfChapter'): Promise<void> {
    this.playing = false;
    this.started = false;
    this.token += 1;
    this.busy = false;
    await this.player.pause();
    this.setStatus('paused');
    this.listener.onDone?.(reason);
  }

  private exhausted(stack: ClipStack): void {
    if (nextPlayableIndex(stack, 0) == null) {
      this.playing = false;
      this.setStatus('error');
      this.listener.onError?.(new Error('No narration clips could be generated.'));
      return;
    }
    this.finish();
  }

  private finish(): void {
    this.playing = false;
    this.setStatus('idle');
    this.listener.onDone?.('finished');
  }

  private setStatus(status: NarrationStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.listener.onStatus?.(status);
  }
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(Math.max(0, Math.floor(index)), length - 1);
}
