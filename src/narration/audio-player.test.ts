import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioStatus } from 'expo-audio';

import { createAudioPlayerAdapter } from './audio-player';

const { fake, listeners } = vi.hoisted(() => {
  const listeners: ((status: AudioStatus) => void)[] = [];
  const fake = {
    playing: false,
    isLoaded: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0,
    replace: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(async () => {}),
    setActiveForLockScreen: vi.fn(),
    clearLockScreenControls: vi.fn(),
    remove: vi.fn(),
    addListener: vi.fn((_event: string, handler: (status: AudioStatus) => void) => {
      listeners.push(handler);
      return { remove: vi.fn() };
    }),
  };
  return { fake, listeners };
});

vi.mock('expo-audio', () => ({
  createAudioPlayer: () => fake,
  setAudioModeAsync: vi.fn(async () => {}),
}));

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

const meta = { title: 'Story', artist: 'Voice' };

function emit(patch: Partial<AudioStatus>): void {
  const status = {
    id: 'player',
    currentTime: fake.currentTime,
    playbackState: 'ready',
    timeControlStatus: 'paused',
    reasonForWaitingToPlay: '',
    mute: false,
    duration: fake.duration,
    playing: fake.playing,
    loop: false,
    didJustFinish: false,
    isBuffering: fake.isBuffering,
    isLoaded: fake.isLoaded,
    playbackRate: 1,
    shouldCorrectPitch: true,
    isLive: false,
    currentOffsetFromLive: null,
    error: null,
    ...patch,
  } as AudioStatus;
  for (const listener of listeners) listener(status);
}

async function loadClip(uri = 'file:///clip.wav'): Promise<void> {
  const adapter = createAudioPlayerAdapter();
  const loading = adapter.load(uri, meta);
  await vi.waitFor(() => expect(fake.replace).toHaveBeenCalledWith({ uri }));
  fake.isLoaded = true;
  emit({ isLoaded: true });
  await loading;
}

describe('audio player adapter', () => {
  beforeEach(async () => {
    await createAudioPlayerAdapter().unload();
    vi.clearAllMocks();
    listeners.length = 0;
    fake.playing = false;
    fake.isLoaded = false;
    fake.isBuffering = false;
    fake.currentTime = 0;
    fake.duration = 0;
  });

  it('loads a clip and resolves once the status reports it', async () => {
    const adapter = createAudioPlayerAdapter();
    await loadClip();

    expect(adapter.snapshot()).toMatchObject({ loaded: true, playing: false, error: null });
    expect(fake.setActiveForLockScreen).toHaveBeenCalledWith(true, meta);
  });

  it('does not reset the lock screen metadata or the file per chunk of a story', async () => {
    await loadClip();
    await loadClip('file:///clip-2.wav');

    expect(fake.replace).toHaveBeenCalledTimes(2);
    expect(fake.setActiveForLockScreen).toHaveBeenCalledTimes(1);
  });

  it('pauses in place so playing again resumes the loaded clip', async () => {
    const adapter = createAudioPlayerAdapter();
    await loadClip();
    fake.duration = 2;
    fake.currentTime = 1.5;

    fake.playing = true;
    await adapter.play();
    expect(fake.play).toHaveBeenCalled();

    fake.playing = false;
    await adapter.pause();
    expect(fake.pause).toHaveBeenCalled();
    expect(fake.replace).toHaveBeenCalledTimes(1);
    expect(fake.remove).not.toHaveBeenCalled();
    expect(fake.currentTime).toBe(1.5);
    expect(adapter.snapshot()).toMatchObject({ playing: false, loaded: true, positionMs: 1500 });
  });

  it('seeks in seconds from a millisecond position', async () => {
    const adapter = createAudioPlayerAdapter();
    await loadClip();

    await adapter.seek(2500);
    expect(fake.seekTo).toHaveBeenCalledWith(2.5);
  });

  it('publishes status changes to every subscriber until they unsubscribe', async () => {
    const adapter = createAudioPlayerAdapter();
    await loadClip();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = adapter.subscribe(first);
    adapter.subscribe(second);

    fake.currentTime = 0.75;
    fake.playing = true;
    emit({ playing: true });

    expect(first).toHaveBeenCalledWith(expect.objectContaining({ positionMs: 750, playing: true }));
    expect(second).toHaveBeenCalledOnce();

    unsubscribe();
    emit({ playing: true });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('fails a load that never becomes ready', async () => {
    vi.useFakeTimers();
    try {
      const adapter = createAudioPlayerAdapter();
      const loading = adapter.load('file:///slow.wav', meta);
      const failure = expect(loading).rejects.toThrow('narration.error');
      await vi.advanceTimersByTimeAsync(10_000);
      await failure;
      expect(adapter.snapshot().loaded).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases the player and reports an empty snapshot when unloaded', async () => {
    const adapter = createAudioPlayerAdapter();
    await loadClip();
    const listener = vi.fn();
    adapter.subscribe(listener);

    await adapter.unload();

    expect(fake.clearLockScreenControls).toHaveBeenCalled();
    expect(fake.remove).toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith({
      playing: false,
      loaded: false,
      buffering: false,
      positionMs: 0,
      durationMs: 0,
      didJustFinish: false,
      error: null,
    });
  });
});
