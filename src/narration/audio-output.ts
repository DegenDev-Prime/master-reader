import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { NarrationStoppedError } from './engine';

export type AudioTrackMeta = {
  title: string;
  artist: string;
};

const POLL_MS = 250;
const END_MARGIN_S = 0.3;
const LOAD_TIMEOUT_MS = 20_000;

let player: AudioPlayer | null = null;
let modeReady = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  player ??= createAudioPlayer(null, { updateInterval: POLL_MS });
  return player;
}

/**
 * Plays a local audio file to completion. Resolves at the end of the file and
 * rejects with `NarrationStoppedError` when `isAborted` flips (pause, stop, or
 * a newer chunk taking over). Polling keeps the flow independent of event
 * delivery across engines and app states.
 */
export async function playAudioFile(
  uri: string,
  meta: AudioTrackMeta,
  rate: number,
  isAborted: () => boolean,
): Promise<void> {
  const current = await ensurePlayer();
  current.replace({ uri });
  current.setPlaybackRate(Math.min(2, Math.max(0.5, rate)));
  current.setActiveForLockScreen(true, { title: meta.title, artist: meta.artist });
  current.play();

  const startedAt = Date.now();
  for (;;) {
    if (isAborted()) {
      current.pause();
      throw new NarrationStoppedError();
    }
    if (current.isLoaded && current.duration > 0) {
      if (current.currentTime >= current.duration - END_MARGIN_S) return;
    } else if (Date.now() - startedAt > LOAD_TIMEOUT_MS) {
      throw new Error('Audio failed to load.');
    }
    await sleep(POLL_MS);
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
