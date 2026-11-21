import type { AudioPlaybackSnapshot, AudioPlayerAdapter } from './audio-player';
import { clipDurationMs, nextPlayableIndex, type ClipEntry, type ClipStack } from './clip-stack';
import { ClipWorker, type ClipSynthesizer } from './clip-worker';
import type { SpeechChunk } from './chunker';

export type AudioPhase = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type AudioControllerState = {
  phase: AudioPhase;
  clipIndex: number;
  clipId: string | null;
  positionMs: number;
  durationMs: number;
  /** Consecutive ready clips after the playhead. */
  bufferedAhead: number;
  error: string | null;
};

export type AudioControllerOptions = {
  player: AudioPlayerAdapter;
  synth: ClipSynthesizer;
  meta?: { title: string; artist: string };
  lookahead?: number;
  delay?: (ms: number) => Promise<void>;
  /** Playback rate; synthesis always runs at 1x so clips stay reusable. */
  rate?: number;
  /** Backend-specific ceiling for one synthesis call. */
  synthTimeoutMs?: number;
  /** Localized message shown when synthesis or playback fails. */
  errorMessage: string;
  onState: (state: AudioControllerState) => void;
  onClip?: (index: number) => void;
  /** Keeps the current clip and its lookahead out of the synth cache sweep. */
  onProtect?: (uris: readonly string[]) => void;
  savePosition?: (index: number, positionMs: number) => void;
};

type Intent = 'idle' | 'playing' | 'paused';

/**
 * Owns playback and is the only writer of `play`/`pause`. Synthesis stays in
 * `ClipWorker`; the player only ever holds the clip at the cursor.
 */
export class AudioController {
  private readonly player: AudioPlayerAdapter;
  private readonly meta: { title: string; artist: string };
  private readonly worker: ClipWorker;
  private readonly lookahead: number;
  private readonly errorMessage: string;
  private readonly onState: (state: AudioControllerState) => void;
  private readonly onClip?: (index: number) => void;
  private readonly onProtect?: (uris: readonly string[]) => void;
  private readonly savePosition?: (index: number, positionMs: number) => void;
  private readonly unsubscribe: () => void;

  private stack: ClipStack | null = null;
  private intent: Intent = 'idle';
  private clipIndex = 0;
  private positionMs = 0;
  private pendingSeekMs = 0;
  private loadedClipIndex: number | null = null;
  private error: string | null = null;
  private sessionId = 0;
  private starting: Promise<void> | null = null;
  private loading: { index: number; session: number; promise: Promise<void> } | null = null;
  private rate: number;
  private finishing = false;
  private skipping = false;
  private destroyed = false;

  constructor(options: AudioControllerOptions) {
    this.player = options.player;
    this.meta = options.meta ?? { title: '', artist: '' };
    this.lookahead = Math.max(0, options.lookahead ?? 2);
    this.rate = Math.min(3, Math.max(0.25, options.rate ?? 1));
    this.errorMessage = options.errorMessage;
    this.onState = options.onState;
    this.onClip = options.onClip;
    this.onProtect = options.onProtect;
    this.savePosition = options.savePosition;
    this.worker = new ClipWorker({
      synth: options.synth,
      lookahead: this.lookahead,
      delay: options.delay,
      synthTimeoutMs: options.synthTimeoutMs,
      onUpdate: (stack) => this.onWorkerUpdate(stack),
    });
    this.unsubscribe = this.player.subscribe((snapshot) => this.onPlayerSnapshot(snapshot));
  }

  /** Resets the session, places the cursor and prefetches. Never autoplays. */
  async load(chunks: readonly SpeechChunk[], startIndex = 0, startMs = 0): Promise<void> {
    const last = Math.max(0, chunks.length - 1);
    const index = Math.min(Math.max(0, Math.floor(startIndex)), last);
    this.intent = chunks.length === 0 ? 'idle' : 'paused';
    this.error = null;
    this.clipIndex = index;
    this.positionMs = Math.max(0, Math.floor(startMs));
    this.pendingSeekMs = this.positionMs;
    this.loadedClipIndex = null;
    this.sessionId += 1;

    this.worker.stop();
    this.worker.load(this.sessionId, chunks, index);
    if (chunks.length > 0) {
      void this.worker.warmUp().catch(() => undefined);
      this.onClip?.(index);
    }

    await this.player.pause();
    await this.player.unload().catch(() => undefined);
    this.player.setRate(this.rate);
    this.emit();
  }

  /** Playback-time speed: it never invalidates synthesized clips. */
  setRate(rate: number): void {
    this.rate = Math.min(3, Math.max(0.25, rate));
    this.player.setRate(this.rate);
  }

  async play(): Promise<void> {
    if (!this.hasClips()) return;
    this.error = null;
    this.intent = 'playing';
    this.skipDeadClip();
    this.emit();
    await this.maybeStart();
  }

  async pause(): Promise<void> {
    if (!this.stack) return;
    this.intent = 'paused';
    if (this.starting) await this.starting;
    await this.player.pause();
    this.syncPosition();
    this.savePosition?.(this.clipIndex, this.positionMs);
    this.emit();
  }

  async toggle(): Promise<void> {
    if (this.intent === 'playing') return this.pause();
    return this.play();
  }

  /** Moves exactly one playable clip and starts it if the session is playing. */
  async skipForward(): Promise<void> {
    await this.skip(1);
  }

  /** Moves exactly one playable clip backwards. */
  async skipBackward(): Promise<void> {
    await this.skip(-1);
  }

  async destroy(): Promise<void> {
    if (this.stack) this.savePosition?.(this.clipIndex, this.positionMs);
    this.intent = 'idle';
    this.unsubscribe();
    await this.worker.release();
    this.stack = null;
    this.loading = null;
    this.loadedClipIndex = null;
    this.positionMs = 0;
    this.error = null;
    this.onProtect?.([]);
    this.emit();
    this.destroyed = true;
    await this.player.unload().catch(() => undefined);
  }

  /** Resolves when synthesis has drained and any pending player load finished. */
  async whenIdle(): Promise<void> {
    await this.worker.whenIdle();
    while (this.starting) await this.starting;
  }

  private hasClips(): boolean {
    return (this.stack?.clips.length ?? 0) > 0;
  }

  private currentClip(): ClipEntry | null {
    return this.stack?.clips[this.clipIndex] ?? null;
  }

  private phase(): AudioPhase {
    if (this.error) return 'error';
    if (!this.hasClips() || this.intent === 'idle') return 'idle';
    if (this.intent === 'playing') {
      return this.loadedClipIndex === this.clipIndex ? 'playing' : 'loading';
    }
    return this.currentClip()?.phase === 'ready' ? 'paused' : 'loading';
  }

  private bufferedAhead(): number {
    const stack = this.stack;
    if (!stack) return 0;
    let count = 0;
    for (let index = this.clipIndex + 1; index < stack.clips.length; index += 1) {
      if (stack.clips[index]?.phase !== 'ready') break;
      count += 1;
    }
    return count;
  }

  private protectedUris(): string[] {
    const stack = this.stack;
    if (!stack) return [];
    const uris: string[] = [];
    for (let index = this.clipIndex; index <= this.clipIndex + this.lookahead; index += 1) {
      const audio = stack.clips[index]?.audio;
      if (audio) uris.push(audio.uri);
    }
    return uris;
  }

  private emit(): void {
    if (this.destroyed) return;
    this.onProtect?.(this.protectedUris());
    const stack = this.stack;
    const snapshot = this.player.snapshot();
    const loaded =
      this.loadedClipIndex !== null && this.loadedClipIndex === this.clipIndex && snapshot.loaded;
    const chunk = stack?.chunks[this.clipIndex] ?? null;
    this.onState({
      phase: this.phase(),
      clipIndex: this.clipIndex,
      clipId: chunk?.id ?? null,
      positionMs: loaded ? Math.max(0, snapshot.positionMs) : this.positionMs,
      durationMs:
        loaded && snapshot.durationMs > 0
          ? snapshot.durationMs
          : stack
            ? clipDurationMs(stack, this.clipIndex)
            : 0,
      bufferedAhead: this.bufferedAhead(),
      error: this.error,
    });
  }

  private syncPosition(): void {
    const snapshot = this.player.snapshot();
    if (this.loadedClipIndex === this.clipIndex && snapshot.loaded) {
      this.positionMs = Math.max(0, snapshot.positionMs);
    }
  }

  private onWorkerUpdate(stack: ClipStack): void {
    if (this.destroyed) return;
    this.stack = stack;
    this.skipDeadClip();
    this.emit();
    if (this.intent === 'playing') void this.maybeStart();
  }

  private onPlayerSnapshot(snapshot: AudioPlaybackSnapshot): void {
    if (this.destroyed) return;
    if (this.loadedClipIndex === this.clipIndex && snapshot.loaded) {
      this.positionMs = Math.max(0, snapshot.positionMs);
    }
    if (snapshot.error) this.error = this.errorMessage;
    this.emit();
    const finished =
      snapshot.didJustFinish &&
      this.intent === 'playing' &&
      !this.finishing &&
      this.loadedClipIndex === this.clipIndex;
    if (finished) {
      this.finishing = true;
      void this.advance().finally(() => {
        this.finishing = false;
      });
    }
  }

  private setCursor(index: number): void {
    this.clipIndex = index;
    this.positionMs = 0;
    this.pendingSeekMs = 0;
    this.loadedClipIndex = null;
    this.worker.setPlayIndex(index);
    this.onClip?.(index);
  }

  private async skip(direction: 1 | -1): Promise<void> {
    const stack = this.stack;
    if (!stack || !this.hasClips()) return;
    const target = nextPlayableIndex(stack, this.clipIndex + direction, direction);
    if (target == null || target === this.clipIndex) return;

    const wasPlaying = this.intent === 'playing';
    this.intent = 'paused';
    await this.player.pause();
    this.setCursor(target);
    this.savePosition?.(target, 0);
    this.emit();

    if (wasPlaying) {
      this.intent = 'playing';
      await this.maybeStart();
      return;
    }
    await this.preloadCurrent();
    this.emit();
  }

  private async preloadCurrent(): Promise<void> {
    if (await this.ensureLoaded()) this.pendingSeekMs = 0;
  }

  /**
   * One load per clip. Preload and play can race (skip while paused, then
   * play); both await the same promise instead of replacing the file twice.
   */
  private async ensureLoaded(): Promise<boolean> {
    if (this.loadedClipIndex === this.clipIndex) return true;
    const clip = this.currentClip();
    if (!clip || clip.phase !== 'ready' || !clip.audio) return false;

    const session = this.sessionId;
    const index = this.clipIndex;
    if (this.loading?.index === index && this.loading.session === session) {
      await this.loading.promise;
      return this.loadedClipIndex === this.clipIndex;
    }

    const uri = clip.audio.uri;
    const promise = (async () => {
      await this.player.load(uri, this.meta);
      if (this.destroyed || session !== this.sessionId || index !== this.clipIndex) return;
      this.loadedClipIndex = index;
      this.player.setRate(this.rate);
    })();
    this.loading = { index, session, promise };
    try {
      await promise;
    } finally {
      if (this.loading?.promise === promise) this.loading = null;
    }
    return this.loadedClipIndex === this.clipIndex;
  }

  private skipDeadClip(): void {
    const stack = this.stack;
    const clip = stack?.clips[this.clipIndex];
    if (!stack || !clip || clip.phase !== 'dead' || this.skipping) return;
    this.skipping = true;
    try {
      const next = nextPlayableIndex(stack, this.clipIndex + 1, 1);
      if (next == null) {
        this.intent = 'idle';
        this.error = this.errorMessage;
        this.loadedClipIndex = null;
        return;
      }
      this.savePosition?.(next, 0);
      this.setCursor(next);
    } finally {
      this.skipping = false;
    }
  }

  private async advance(): Promise<void> {
    const stack = this.stack;
    if (!stack) return;
    const finishedAt =
      this.positionMs > 0 ? this.positionMs : clipDurationMs(stack, this.clipIndex);
    const next = nextPlayableIndex(stack, this.clipIndex + 1, 1);
    if (next == null) {
      this.intent = 'idle';
      this.loadedClipIndex = null;
      this.positionMs = finishedAt;
      this.savePosition?.(this.clipIndex, finishedAt);
      this.emit();
      return;
    }
    this.savePosition?.(next, 0);
    this.setCursor(next);
    this.emit();
    await this.maybeStart();
  }

  private async maybeStart(): Promise<void> {
    if (this.starting) await this.starting;
    if (this.intent !== 'playing' || this.destroyed) return;
    if (this.player.snapshot().playing) return;
    const session = this.sessionId;
    const run = this.startPlayback().catch(() => {
      if (this.destroyed || session !== this.sessionId) return;
      this.error = this.errorMessage;
      this.emit();
    });
    this.starting = run;
    try {
      await run;
    } finally {
      if (this.starting === run) this.starting = null;
    }
  }

  private async startPlayback(): Promise<void> {
    const session = this.sessionId;
    const index = this.clipIndex;

    if (!(await this.ensureLoaded())) return;
    if (this.destroyed || session !== this.sessionId || index !== this.clipIndex) return;

    if (this.pendingSeekMs > 0) {
      const seekMs = this.pendingSeekMs;
      this.pendingSeekMs = 0;
      await this.player.seek(seekMs);
      if (this.destroyed || session !== this.sessionId || index !== this.clipIndex) return;
    }

    if (this.intent !== 'playing') {
      this.emit();
      return;
    }
    await this.player.play();
    this.emit();
  }
}
