import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { NarrationStoppedError } from './engine';
import { createEndDetector } from './playback-end';

export type AudioTrackMeta = {
  title: string;
  artist: string;
};

const POLL_MS = 60;
const LOAD_TIMEOUT_MS = 20_000;
const MIN_RATE = 0.5;
const MAX_RATE = 2;

let player: AudioPlayer | null = null;
let modeReady = false;

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
  return player;
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
): Promise<void> {
  const current = await ensurePlayer();
  current.replace({ uri });
  current.setPlaybackRate(clampRate(rate));
  current.setActiveForLockScreen(true, { title: meta.title, artist: meta.artist });
  current.play();

  const startedAt = Date.now();
  const detector = createEndDetector();
  let finished = false;

  const subscription = current.addListener('playbackStatusUpdate', (status) => {
    if (detector.observe(status)) finished = true;
  });

  try {
    while (!finished) {
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
      if (Date.now() - startedAt > LOAD_TIMEOUT_MS) {
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
}
