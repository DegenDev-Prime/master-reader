import { describe, expect, it } from 'vitest';

import { chunkIndexAfterSeconds, Narrator } from './service';
import type { NarratorEngine } from './engine';
import type { SpeechChunk } from './chunker';
import type { SleepTimerState } from './sleep-timer';

function makeChunks(count: number): SpeechChunk[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `0:${i}`,
    pageIndex: 0,
    start: i * 10,
    end: i * 10 + 9,
    text: `Sentence number ${i} here today.`,
  }));
}

function fakeEngine(spoken: string[], queues = false): NarratorEngine {
  return {
    id: 'system',
    queues,
    listVoices: async () => [],
    speak: async ({ chunk }) => {
      spoken.push(chunk.id);
    },
    stop: async () => {},
    isSpeaking: async () => false,
  };
}

const idleSleep = (): SleepTimerState => ({ mode: 'off' });

type Deps = ConstructorParameters<typeof Narrator>[0];

function deps(engine: NarratorEngine, extra: Partial<Deps> = {}): Deps {
  return {
    engine,
    getSleepState: idleSleep,
    nowMs: () => 0,
    getRate: () => 1,
    onProgress: () => {},
    ...extra,
  };
}

describe('Narrator', () => {
  it('plays every chunk in order and reports progress', async () => {
    const spoken: string[] = [];
    const progress: number[] = [];
    const done: string[] = [];
    const narrator = new Narrator(
      deps(fakeEngine(spoken), { onProgress: (i) => progress.push(i) }),
      { onDone: (reason) => done.push(reason) },
    );

    narrator.play({ chunks: makeChunks(3), rate: 1 });
    await narrator.finished;
    expect(spoken).toEqual(['0:0', '0:1', '0:2']);
    expect(progress).toEqual([0, 1, 2]);
    expect(done).toEqual(['finished']);
    expect(narrator.currentStatus).toBe('idle');
  });

  it('returns from play before the run ends', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const engine = fakeEngine([]);
    engine.speak = async () => {
      await gate;
    };
    const narrator = new Narrator(deps(engine), {});

    // The call returns while the run is still going: awaiting it would keep
    // every caller pending for a whole chapter.
    narrator.play({ chunks: makeChunks(2), rate: 1 });
    expect(narrator.currentStatus).not.toBe('idle');
    release();
    await narrator.finished;
  });

  it('starts from a saved chunk index', async () => {
    const spoken: string[] = [];
    const narrator = new Narrator(deps(fakeEngine(spoken)), {});
    narrator.play({ chunks: makeChunks(3), rate: 1, startIndex: 2 });
    await narrator.finished;
    expect(spoken).toEqual(['0:2']);
  });

  it('pauses when the sleep timer expires', async () => {
    const spoken: string[] = [];
    const done: string[] = [];
    const narrator = new Narrator(
      deps(fakeEngine(spoken), {
        getSleepState: () => ({ mode: 'minutes', endsAtMs: 0 }),
        nowMs: () => 999,
      }),
      { onDone: (reason) => done.push(reason) },
    );
    narrator.play({ chunks: makeChunks(3), rate: 1 });
    await narrator.finished;
    expect(spoken).toEqual([]);
    expect(done).toEqual(['sleep']);
    expect(narrator.currentStatus).toBe('paused');
  });

  it('treats engine stop as a pause', async () => {
    const engine = fakeEngine([]);
    engine.speak = async () => {
      const { NarrationStoppedError } = await import('./engine');
      throw new NarrationStoppedError();
    };
    const narrator = new Narrator(deps(engine), {});
    narrator.play({ chunks: makeChunks(2), rate: 1 });
    await narrator.finished;
    expect(narrator.currentStatus).toBe('paused');
  });

  it('surfaces engine errors', async () => {
    const engine = fakeEngine([]);
    engine.speak = async () => {
      throw new Error('boom');
    };
    const errors: Error[] = [];
    const narrator = new Narrator(deps(engine), { onError: (error) => errors.push(error) });
    narrator.play({ chunks: makeChunks(1), rate: 1 });
    await narrator.finished;
    expect(narrator.currentStatus).toBe('error');
    expect(errors.map((e) => e.message)).toEqual(['boom']);
  });

  it('stale runs do not emit after a newer play starts', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spoken: string[] = [];
    const engine = fakeEngine(spoken);
    engine.speak = async ({ chunk }) => {
      spoken.push(chunk.id);
      await gate;
    };
    const narrator = new Narrator(deps(engine), {});

    narrator.play({ chunks: makeChunks(2), rate: 1 });
    narrator.play({ chunks: makeChunks(1), rate: 1 });
    release();
    await narrator.finished;
    expect(spoken.filter((id) => id === '0:1')).toEqual([]);
  });

  it('gives a queueing engine the next chunk before the current one ends', async () => {
    const spoken: string[] = [];
    const engine = fakeEngine(spoken, true);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    engine.speak = async ({ chunk }) => {
      spoken.push(chunk.id);
      await gate;
    };
    const narrator = new Narrator(deps(engine), {});

    narrator.play({ chunks: makeChunks(3), rate: 1 });
    // The engine was asked for the second chunk while the first is still
    // playing, so the platform TTS can synthesize it in the background.
    await Promise.resolve();
    expect(spoken).toEqual(['0:0', '0:1']);
    release();
    await narrator.finished;
    expect(spoken).toEqual(['0:0', '0:1', '0:2']);
  });

  it('does not queue ahead for an engine that plays one file at a time', async () => {
    const spoken: string[] = [];
    const engine = fakeEngine(spoken);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    engine.speak = async ({ chunk }) => {
      spoken.push(chunk.id);
      await gate;
    };
    const narrator = new Narrator(deps(engine), {});

    narrator.play({ chunks: makeChunks(3), rate: 1 });
    await Promise.resolve();
    expect(spoken).toEqual(['0:0']);
    release();
    await narrator.finished;
  });

  it('applies a live rate change when the engine supports it', async () => {
    const rates: number[] = [];
    const engine = fakeEngine([]);
    engine.setRate = async (rate) => {
      rates.push(rate);
      return true;
    };
    const narrator = new Narrator(deps(engine), {});

    expect(await narrator.setRate(1.5)).toBe(true);
    expect(rates).toEqual([1.5]);
  });

  it('reports that the rate cannot be changed when the engine has no setter', async () => {
    const narrator = new Narrator(deps(fakeEngine([])), {});
    expect(await narrator.setRate(1.5)).toBe(false);
  });

  it('speaks each chunk at the current rate', async () => {
    const rates: number[] = [];
    const engine = fakeEngine([]);
    engine.speak = async ({ rate }) => {
      rates.push(rate);
    };
    let current = 1;
    const narrator = new Narrator(deps(engine, { getRate: () => current }), {});

    narrator.play({ chunks: makeChunks(2), rate: 1 });
    await narrator.finished;
    expect(rates).toEqual([1, 1]);

    current = 1.5;
    narrator.play({ chunks: makeChunks(1), rate: 1 });
    await narrator.finished;
    expect(rates).toEqual([1, 1, 1.5]);
  });
});

describe('chunkIndexAfterSeconds', () => {
  it('skips forward and backward by estimated duration', () => {
    const chunks = makeChunks(10);
    const forward = chunkIndexAfterSeconds(chunks, 2, 30, 1);
    expect(forward).toBeGreaterThan(2);
    const back = chunkIndexAfterSeconds(chunks, 5, -30, 1);
    expect(back).toBeLessThan(5);
  });

  it('clamps at the ends', () => {
    const chunks = makeChunks(3);
    expect(chunkIndexAfterSeconds(chunks, 0, 10_000, 1)).toBe(2);
    expect(chunkIndexAfterSeconds(chunks, 2, -10_000, 1)).toBe(0);
  });

  it('rewinds to the start of the current chunk when the skip is shorter', () => {
    // Each chunk is two seconds long, so the current chunk is one second in.
    const chunks = makeChunks(5);
    expect(chunkIndexAfterSeconds(chunks, 3, -1, 1)).toBe(3);
  });

  it('rewinds into the previous chunk when the skip is longer', () => {
    const chunks = makeChunks(5);
    const back = chunkIndexAfterSeconds(chunks, 3, -30, 1);
    expect(back).toBeLessThan(3);
    expect(back).toBeGreaterThanOrEqual(0);
  });

  it('rewinds to the previous chunk when the skip passes the start of it', () => {
    // Each chunk is two seconds long, so the current chunk is one second in;
    // a five second rewind lands two chunks back.
    const chunks = makeChunks(5);
    expect(chunkIndexAfterSeconds(chunks, 3, -5, 1)).toBe(1);
  });

  it('skips forward onto the next chunk when the skip passes its end', () => {
    const chunks = makeChunks(5);
    expect(chunkIndexAfterSeconds(chunks, 1, 2.5, 1)).toBe(2);
  });

  it('stays inside the session', () => {
    const chunks = makeChunks(3);
    expect(chunkIndexAfterSeconds(chunks, 0, -60, 1)).toBe(0);
    expect(chunkIndexAfterSeconds(chunks, 2, 600, 1)).toBe(2);
  });

  it('is a no-op for zero seconds', () => {
    const chunks = makeChunks(4);
    expect(chunkIndexAfterSeconds(chunks, 1, 0, 1)).toBe(1);
  });
});
