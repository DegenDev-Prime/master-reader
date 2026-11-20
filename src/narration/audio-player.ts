import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';

import { t } from '@/i18n';

export type AudioPlaybackSnapshot = {
  playing: boolean;
  loaded: boolean;
  buffering: boolean;
  positionMs: number;
  durationMs: number;
  didJustFinish: boolean;
  error: string | null;
};

export type AudioPlayerAdapter = {
  load(uri: string, meta: { title: string; artist: string }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(ms: number): Promise<void>;
  setRate(rate: number): void;
  snapshot(): AudioPlaybackSnapshot;
  subscribe(listener: (snapshot: AudioPlaybackSnapshot) => void): () => void;
  unload(): Promise<void>;
};

type TrackMeta = { title: string; artist: string };

type PendingLoad = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const UPDATE_INTERVAL_MS = 200;
const LOAD_TIMEOUT_MS = 10_000;

let player: AudioPlayer | null = null;
let modeSetup: Promise<void> | null = null;
let statusSubscription: { remove(): void } | null = null;
let pendingLoad: PendingLoad | null = null;
let lockScreenKey = '';
let latestFinish = false;
let latestError: string | null = null;
const listeners = new Set<(snapshot: AudioPlaybackSnapshot) => void>();

function toMs(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : 0;
}

function snapshot(): AudioPlaybackSnapshot {
  return {
    playing: player?.playing ?? false,
    loaded: player?.isLoaded ?? false,
    buffering: player?.isBuffering ?? false,
    positionMs: toMs(player?.currentTime ?? 0),
    durationMs: toMs(player?.duration ?? 0),
    didJustFinish: latestFinish,
    error: latestError,
  };
}

function publish(): void {
  const current = snapshot();
  for (const listener of listeners) listener(current);
}

function finishLoad(pending: PendingLoad, error?: Error): void {
  clearTimeout(pending.timer);
  if (pendingLoad === pending) pendingLoad = null;
  if (error) pending.reject(error);
  else pending.resolve();
}

function settlePending(error?: Error): void {
  if (pendingLoad) finishLoad(pendingLoad, error);
}

function handleStatus(status: AudioStatus): void {
  latestFinish = status.didJustFinish;
  latestError = status.error;
  if (status.error) settlePending(new Error(status.error));
  else if (status.isLoaded) settlePending();
  publish();
  // expo-audio keeps didJustFinish true until the next status tick; leaving it
  // set makes a later seek/load look like a second finish.
  latestFinish = false;
}

function ensureAudioMode(): Promise<void> {
  modeSetup ??= setAudioModeAsync({
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
    playsInSilentMode: true,
  }).catch(() => undefined);
  return modeSetup;
}

function ensurePlayer(): AudioPlayer {
  if (player) return player;
  const created = createAudioPlayer(null, { updateInterval: UPDATE_INTERVAL_MS });
  player = created;
  statusSubscription = created.addListener('playbackStatusUpdate', handleStatus);
  return created;
}

/** Notification metadata identifies the story, so it is set per story, not per chunk. */
function applyLockScreenMeta(current: AudioPlayer, meta: TrackMeta): void {
  const key = `${meta.title}|${meta.artist}`;
  if (key === lockScreenKey) return;
  lockScreenKey = key;
  current.setActiveForLockScreen(true, { title: meta.title, artist: meta.artist });
}

async function load(uri: string, meta: TrackMeta): Promise<void> {
  const current = ensurePlayer();
  await ensureAudioMode();
  applyLockScreenMeta(current, meta);
  latestFinish = false;
  latestError = null;
  current.replace({ uri });
  await new Promise<void>((resolve, reject) => {
    const pending: PendingLoad = {
      resolve,
      reject,
      timer: setTimeout(
        () => finishLoad(pending, new Error(t('narration.error'))),
        LOAD_TIMEOUT_MS,
      ),
    };
    pendingLoad = pending;
  });
}

async function play(): Promise<void> {
  player?.play();
}

/** Pause keeps the loaded file and its position so play() resumes in place. */
async function pause(): Promise<void> {
  player?.pause();
}

async function seek(ms: number): Promise<void> {
  if (!player) return;
  await player.seekTo(Math.max(0, ms) / 1000);
}

function setRate(rate: number): void {
  if (!player) return;
  player.setPlaybackRate(Math.min(3, Math.max(0.25, rate)), 'high');
}

function subscribe(listener: (snapshot: AudioPlaybackSnapshot) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function unload(): Promise<void> {
  settlePending(new Error(t('narration.error')));
  const current = player;
  player = null;
  statusSubscription?.remove();
  statusSubscription = null;
  lockScreenKey = '';
  latestFinish = false;
  latestError = null;
  if (current) {
    try {
      current.clearLockScreenControls();
      current.pause();
      current.remove();
    } catch {
      // The native player was already released.
    }
  }
  publish();
}

const adapter: AudioPlayerAdapter = {
  load,
  play,
  pause,
  seek,
  setRate,
  snapshot,
  subscribe,
  unload,
};

/** One process-wide player, so every caller shares the same playback and status. */
export function createAudioPlayerAdapter(): AudioPlayerAdapter {
  return adapter;
}
