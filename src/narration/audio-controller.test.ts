import { describe, expect, it } from 'vitest';

import { AudioController, type AudioControllerState } from './audio-controller';
import type { AudioPlaybackSnapshot, AudioPlayerAdapter } from './audio-player';
import type { ClipSynthesizer, SynthResult } from './clip-worker';
import type { SpeechChunk } from './chunker';

const chunk = (index: number, text: string): SpeechChunk => ({
  id: `0:${index}`,
  pageIndex: 0,
  start: 0,
  end: text.length,
  text,
});

const chunks = [chunk(0, 'one'), chunk(1, 'two'), chunk(2, 'three')];
const immediate = async () => {};

function makePlayer() {
  let status: AudioPlaybackSnapshot = {
    playing: false,
    loaded: false,
    buffering: false,
    positionMs: 0,
    durationMs: 0,
    didJustFinish: false,
    error: null,
  };
  const listeners = new Set<(value: AudioPlaybackSnapshot) => void>();
  const calls: string[] = [];
  const loads: string[] = [];
  const seeks: number[] = [];
  const rates: number[] = [];

  const notify = () => {
    for (const listener of [...listeners]) listener(status);
  };
  const set = (patch: Partial<AudioPlaybackSnapshot>) => {
    status = { ...status, ...patch };
    notify();
  };

  const adapter: AudioPlayerAdapter = {
    async load(uri: string) {
      calls.push(`load:${uri}`);
      loads.push(uri);
      status = {
        ...status,
        loaded: true,
        playing: false,
        positionMs: 0,
        durationMs: 1000,
        didJustFinish: false,
      };
      notify();
    },
    async play() {
      calls.push('play');
      set({ playing: true, didJustFinish: false });
    },
    async pause() {
      calls.push('pause');
      set({ playing: false });
    },
    async seek(ms: number) {
      calls.push(`seek:${ms}`);
      seeks.push(ms);
      set({ positionMs: ms });
    },
    setRate(rate: number) {
      calls.push(`rate:${rate}`);
      rates.push(rate);
    },
    snapshot: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async unload() {
      calls.push('unload');
      set({ loaded: false, playing: false, positionMs: 0, durationMs: 0, didJustFinish: false });
    },
  };

  return {
    adapter,
    calls,
    loads,
    seeks,
    rates,
    snapshot: () => status,
    position: (ms: number) => set({ positionMs: ms }),
    finish: () => set({ playing: false, didJustFinish: true, positionMs: status.durationMs }),
  };
}

function immediateSynth(): ClipSynthesizer {
  return {
    synthesize: async (text) => ({ uri: `file:///${text}.wav`, durationMs: 1000 }),
  };
}

function makeController(player: ReturnType<typeof makePlayer>, synth = immediateSynth()) {
  const states: AudioControllerState[] = [];
  const clipEvents: number[] = [];
  const saves: [number, number][] = [];
  const protectedUris: string[][] = [];
  const controller = new AudioController({
    player: player.adapter,
    synth,
    delay: immediate,
    meta: { title: 'Story', artist: 'Master Reader' },
    errorMessage: 'narration.error',
    onState: (state) => states.push(state),
    onClip: (index) => clipEvents.push(index),
    onProtect: (uris) => protectedUris.push([...uris]),
    savePosition: (index, positionMs) => saves.push([index, positionMs]),
  });
  return {
    controller,
    states,
    clipEvents,
    saves,
    protectedUris,
    last: () => states[states.length - 1],
  };
}

describe('AudioController', () => {
  it('pauses instantly and resumes without reloading or seeking', async () => {
    const player = makePlayer();
    const { controller, last } = makeController(player);

    await controller.load(chunks);
    await controller.whenIdle();
    await controller.play();
    expect(player.loads).toEqual(['file:///one.wav']);

    player.position(4200);
    const before = player.calls.length;
    await controller.pause();
    await controller.play();

    expect(player.calls.slice(before)).toEqual(['pause', 'play']);
    expect(player.loads).toHaveLength(1);
    expect(player.seeks).toEqual([]);
    expect(player.snapshot().playing).toBe(true);
    expect(last()).toMatchObject({ phase: 'playing', clipIndex: 0, positionMs: 4200 });
  });

  it('starts playback once the current clip is ready, not before', async () => {
    const player = makePlayer();
    let release!: (result: SynthResult) => void;
    const synth: ClipSynthesizer = {
      synthesize: (text) =>
        text === 'one'
          ? new Promise<SynthResult>((resolve) => {
              release = resolve;
            })
          : Promise.resolve({ uri: `file:///${text}.wav`, durationMs: 1000 }),
    };
    const { controller, last } = makeController(player, synth);

    await controller.load(chunks);
    await controller.play();
    expect(player.loads).toEqual([]);
    expect(last()?.phase).toBe('loading');

    release({ uri: 'file:///one.wav', durationMs: 1000 });
    await controller.whenIdle();

    expect(player.loads).toEqual(['file:///one.wav']);
    expect(last()).toMatchObject({ phase: 'playing', clipIndex: 0 });
  });

  it('advances the cursor on finish and plays the prefetched next clip', async () => {
    const player = makePlayer();
    const { controller, last, saves } = makeController(player);

    await controller.load(chunks);
    await controller.whenIdle();
    await controller.play();

    player.finish();
    await controller.whenIdle();

    expect(player.loads).toEqual(['file:///one.wav', 'file:///two.wav']);
    expect(last()).toMatchObject({ phase: 'playing', clipIndex: 1, positionMs: 0 });
    expect(saves).toContainEqual([1, 0]);
  });

  it('skips forward to the next ready clip immediately', async () => {
    const player = makePlayer();
    const { controller, last } = makeController(player);

    await controller.load(chunks);
    await controller.whenIdle();
    await controller.play();
    await controller.skipForward();

    expect(player.loads).toEqual(['file:///one.wav', 'file:///two.wav']);
    expect(last()).toMatchObject({ phase: 'playing', clipIndex: 1, positionMs: 0 });
  });

  it('skips backward to the previous ready clip immediately', async () => {
    const player = makePlayer();
    const { controller, last } = makeController(player);

    await controller.load(chunks);
    await controller.whenIdle();
    await controller.play();
    await controller.skipForward();
    await controller.skipBackward();

    expect(player.loads).toEqual(['file:///one.wav', 'file:///two.wav', 'file:///one.wav']);
    expect(last()).toMatchObject({ phase: 'playing', clipIndex: 0, positionMs: 0 });
  });

  it('preloads a skipped clip while paused without playing it', async () => {
    const player = makePlayer();
    const { controller, last } = makeController(player);

    await controller.load(chunks);
    await controller.whenIdle();
    await controller.skipForward();

    expect(player.loads).toEqual(['file:///two.wav']);
    expect(player.calls).not.toContain('play');
    expect(last()).toMatchObject({ phase: 'paused', clipIndex: 1, positionMs: 0 });
  });

  it('keeps prefetching while paused and does not autoplay on load', async () => {
    const player = makePlayer();
    const { controller, states, last } = makeController(player);

    await controller.load(chunks);
    await controller.whenIdle();

    expect(player.calls).not.toContain('play');
    expect(states.some((state) => state.phase === 'loading')).toBe(true);
    expect(last()).toMatchObject({ phase: 'paused', clipIndex: 0, bufferedAhead: 2 });
  });

  it('skips a clip that fails for good', async () => {
    const player = makePlayer();
    const synth: ClipSynthesizer = {
      synthesize: async (text) => {
        if (text === 'one') throw new Error('synth failed');
        return { uri: `file:///${text}.wav`, durationMs: 1000 };
      },
    };
    const { controller, last } = makeController(player, synth);

    await controller.load(chunks);
    await controller.play();
    await controller.whenIdle();

    expect(player.loads).toEqual(['file:///two.wav']);
    expect(last()).toMatchObject({ phase: 'playing', clipIndex: 1 });
  });

  it('reports loading, paused, playing and paused in order', async () => {
    const player = makePlayer();
    const { controller, states } = makeController(player);

    await controller.load(chunks);
    await controller.whenIdle();
    await controller.play();
    await controller.pause();

    const phases = states.map((state) => state.phase);
    expect(phases[0]).toBe('loading');
    expect(phases).toContain('paused');
    expect(phases.lastIndexOf('playing')).toBeGreaterThan(phases.indexOf('paused'));
    expect(phases.at(-1)).toBe('paused');
  });

  it('applies the playback rate without re-synthesizing', async () => {
    const player = makePlayer();
    const { controller } = makeController(player);

    await controller.load(chunks);
    await controller.whenIdle();
    await controller.play();
    controller.setRate(1.5);

    expect(player.rates.at(-1)).toBe(1.5);
    expect(player.loads).toHaveLength(1);
  });

  it('does not reload a clip that was preloaded while paused', async () => {
    const player = makePlayer();
    const { controller } = makeController(player);

    await controller.load(chunks);
    await controller.whenIdle();
    await controller.skipForward();
    await controller.play();

    expect(player.loads).toEqual(['file:///two.wav']);
    expect(player.snapshot().playing).toBe(true);
  });

  it('protects the playhead and its lookahead from cache eviction', async () => {
    const player = makePlayer();
    const { controller, protectedUris } = makeController(player);

    await controller.load(chunks);
    await controller.whenIdle();

    expect(protectedUris.at(-1)).toEqual([
      'file:///one.wav',
      'file:///two.wav',
      'file:///three.wav',
    ]);

    await controller.destroy();
    expect(protectedUris.at(-1)).toEqual([]);
  });

  it('shows a localized error instead of the synth message', async () => {
    const player = makePlayer();
    const { controller, last } = makeController(player, {
      synthesize: async () => {
        throw new Error('secret native detail');
      },
    });

    await controller.load([chunks[0]]);
    await controller.play();
    await controller.whenIdle();

    expect(last()?.error).toBe('narration.error');
    expect(last()?.phase).toBe('error');
  });

  it('stops the worker, detaches, and unloads on destroy', async () => {
    const player = makePlayer();
    const { controller, states } = makeController(player);

    await controller.load(chunks);
    await controller.play();
    const before = player.calls.length;
    await controller.destroy();

    expect(player.calls.slice(before)).toEqual(['unload']);
    expect(states.at(-1)?.phase).toBe('idle');

    const emitted = states.length;
    player.finish();
    expect(states.length).toBe(emitted);
  });
});
