import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { NarrationStoppedError } from './engine';
import { createEndDetector } from './playback-end';

export type AudioTrackMeta = {
  title: string;
  artist: string;
};

export type AudioPlaybackState = {
  playing: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  /** Position inside the loaded clip, in seconds. */
  positionSeconds: number;
  /** Exact loaded duration, in seconds (0 before it is known). */
  durationSeconds: number;
  error: string | null;
};

const POLL_MS = 60;
const LOAD_TIMEOUT_MS = 20_000;
const MIN_RATE = 0.5;
const MAX_RATE = 2;

let player: AudioPlayer | null = null;
let modeReady = false;
let lockScreenKey = '';
let statusSubscription: { remove(): void } | null = null;
let lastStatus: AudioPlaybackState = {
  playing: false,
  isLoaded: false,
  isBuffering: false,
  positionSeconds: 0,
  durationSeconds: 0,
  error: null,
};
const statusListeners = new Set<(status: AudioPlaybackState) => void>();

function toPlaybackState(status: {
  playing: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
}): AudioPlaybackState {
  return {
    playing: status.playing,
    isLoaded: status.isLoaded,
    isBuffering: status.isBuffering,
    positionSeconds: Number.isFinite(status.currentTime) ? status.currentTime : 0,
    durationSeconds: Number.isFinite(status.duration) ? status.duration : 0,
    error: status.error,
  };
}

function publishStatus(status: AudioPlaybackState): void {
  lastStatus = status;
  for (const listener of statusListeners) listener(status);
}

/** Current player status, for views that cannot subscribe. */
export function audioStatus(): AudioPlaybackState {
  return lastStatus;
}

/**
 * One player-wide status subscription for the whole app. This is what lets the
 * UI follow lockscreen/notification play-pause and real playback position.
 */
export function subscribeAudioStatus(listener: (status: AudioPlaybackState) => void): () => void {
  statusListeners.add(listener);
  void ensurePlayer();
  return () => {
    statusListeners.delete(listener);
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampRate(rate: number): number {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

/** Idempotent audio-session setup: background playback + lockscreen controls. */
async function ensurePlayer(): Promise<AudioPlayer> {
  if (!modeReady) {
    await setAudioModeAsync({
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
    }).catch(() => undefined);
    modeReady = true;
  }
  player ??= createAudioPlayer(null, { updateInterval: 200 });
  if (!statusSubscription) {
    statusSubscription = player.addListener('playbackStatusUpdate', (status) => {
      publishStatus(toPlaybackState(status));
    });
  }
  return player;
}

/**
 * Registers the media session once per story/voice, not once per clip. The
 * notification is what keeps Android playback alive in the background.
 */
function applyLockScreenMeta(current: AudioPlayer, meta: AudioTrackMeta): void {
  const key = `${meta.title}|${meta.artist}`;
  if (key === lockScreenKey) return;
  lockScreenKey = key;
  current.setActiveForLockScreen(true, { title: meta.title, artist: meta.artist });
}

/**
 * Plays a local audio file to completion. Resolves at the end of the file and
 * rejects with `NarrationStoppedError` when `isAborted` flips (pause, stop, or
 * a newer chunk taking over).
 *
 * The end of a file is detected from the player's own `didJustFinish` event.
 * The position of a finished item is not reset by the player, so a plain
 * `currentTime >= duration` check reports the *previous* chunk as finished the
 * moment the next one is loaded, which restarts the same file over and over.
 * The position fallback is therefore only used once the new item has been seen
 * at its start.
 */
export async function playAudioFile(
  uri: string,
  meta: AudioTrackMeta,
  rate: number,
  isAborted: () => boolean,
  startSeconds = 0,
  onStart?: () => void,
): Promise<void> {
  const current = await ensurePlayer();
  current.replace({ uri });
  current.setPlaybackRate(clampRate(rate));
  applyLockScreenMeta(current, meta);
  current.play();
  if (startSeconds > 0) {
    await current.seekTo(startSeconds).catch(() => undefined);
  }

  const startedAt = Date.now();
  const detector = createEndDetector();
  let finished = false;
  let started = false;
  const markStarted = () => {
    if (started) return;
    started = true;
    onStart?.();
  };

  const subscription = current.addListener('playbackStatusUpdate', (status) => {
    if (status.playing) markStarted();
    if (detector.observe(status)) finished = true;
  });

  try {
    while (!finished) {
      if (current.playing) markStarted();
      if (isAborted()) {
        current.pause();
        throw new NarrationStoppedError();
      }
      if (
        detector.positionFinished({
          isLoaded: current.isLoaded,
          duration: current.duration,
          currentTime: current.currentTime,
        })
      ) {
        break;
      }
      // A lockscreen/notification pause must not look like a failed load:
      // wait for the system to resume instead of timing out.
      if (started && current.isLoaded && !current.playing) {
        await sleep(POLL_MS);
        continue;
      }
      if (!started && Date.now() - startedAt > LOAD_TIMEOUT_MS) {
        throw new Error('Audio failed to load.');
      }
      await sleep(POLL_MS);
    }
  } finally {
    subscription.remove();
  }
}

export async function pauseAudio(): Promise<void> {
  player?.pause();
}

export async function resumeAudio(): Promise<void> {
  player?.play();
}

export function isAudioPlaying(): boolean {
  return Boolean(player?.playing);
}

/**
 * Changes the rate of the running playback. Returns false when nothing is
 * loaded, so the caller can fall back to restarting the chunk.
 */
export function setAudioRate(rate: number): boolean {
  if (!player) return false;
  player.setPlaybackRate(clampRate(rate));
  return true;
}

/** Position of the running playback in seconds, or null when idle. */
export function audioPosition(): number | null {
  if (!player || !player.isLoaded) return null;
  return player.currentTime;
}

/** Exact loaded duration in seconds, or null before the file is ready. */
export function audioDuration(): number | null {
  if (!player || !player.isLoaded || !Number.isFinite(player.duration)) return null;
  return player.duration;
}

/** Seeks inside the loaded clip; used for mid-clip resume and skips. */
export async function seekAudio(seconds: number): Promise<void> {
  if (!player) return;
  await player.seekTo(Math.max(0, seconds)).catch(() => undefined);
}

/** Dismisses the notification, releases the native player and resets the session. */
export async function unloadAudioPlayer(): Promise<void> {
  if (!player) return;
  try {
    player.clearLockScreenControls();
    player.pause();
    player.remove();
  } catch {
    // Already released.
  }
  player = null;
  lockScreenKey = '';
  statusSubscription?.remove();
  statusSubscription = null;
  publishStatus({
    playing: false,
    isLoaded: false,
    isBuffering: false,
    positionSeconds: 0,
    durationSeconds: 0,
    error: null,
  });
}
