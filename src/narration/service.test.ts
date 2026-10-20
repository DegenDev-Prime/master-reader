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

function fakeEngine(spoken: string[]): NarratorEngine {
  return {
    id: 'system',
    listVoices: async () => [],
    speak: async ({ chunk }) => {
      spoken.push(chunk.id);
    },
    stop: async () => {},
    isSpeaking: async () => false,
  };
}

const idleSleep = (): SleepTimerState => ({ mode: 'off' });

describe('Narrator', () => {
  it('plays every chunk in order and reports progress', async () => {
    const spoken: string[] = [];
    const progress: number[] = [];
    const done: string[] = [];
    const narrator = new Narrator(
      {
        engine: fakeEngine(spoken),
        getSleepState: idleSleep,
        nowMs: () => 0,
        onProgress: (i) => progress.push(i),
      },
      { onDone: (reason) => done.push(reason) },
    );

    await narrator.play({ chunks: makeChunks(3), rate: 1 });
    expect(spoken).toEqual(['0:0', '0:1', '0:2']);
    expect(progress).toEqual([0, 1, 2]);
    expect(done).toEqual(['finished']);
    expect(narrator.currentStatus).toBe('idle');
  });

  it('starts from a saved chunk index', async () => {
    const spoken: string[] = [];
    const narrator = new Narrator(
      {
        engine: fakeEngine(spoken),
        getSleepState: idleSleep,
        nowMs: () => 0,
        onProgress: () => {},
      },
      {},
    );
    await narrator.play({ chunks: makeChunks(3), rate: 1, startIndex: 2 });
    expect(spoken).toEqual(['0:2']);
  });

  it('pauses when the sleep timer expires', async () => {
    const spoken: string[] = [];
    const done: string[] = [];
    const narrator = new Narrator(
      {
        engine: fakeEngine(spoken),
        getSleepState: () => ({ mode: 'minutes', endsAtMs: 0 }),
        nowMs: () => 999,
        onProgress: () => {},
      },
      { onDone: (reason) => done.push(reason) },
    );
    await narrator.play({ chunks: makeChunks(3), rate: 1 });
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
    const narrator = new Narrator(
      { engine, getSleepState: idleSleep, nowMs: () => 0, onProgress: () => {} },
      {},
    );
    await narrator.play({ chunks: makeChunks(2), rate: 1 });
    expect(narrator.currentStatus).toBe('paused');
  });

  it('surfaces engine errors', async () => {
    const engine = fakeEngine([]);
    engine.speak = async () => {
      throw new Error('boom');
    };
    const errors: Error[] = [];
    const narrator = new Narrator(
      { engine, getSleepState: idleSleep, nowMs: () => 0, onProgress: () => {} },
      { onError: (error) => errors.push(error) },
    );
    await narrator.play({ chunks: makeChunks(1), rate: 1 });
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
    const narrator = new Narrator(
      { engine, getSleepState: idleSleep, nowMs: () => 0, onProgress: () => {} },
      {},
    );
    const first = narrator.play({ chunks: makeChunks(2), rate: 1 });
    const second = narrator.play({ chunks: makeChunks(1), rate: 1 });
    release();
    await Promise.all([first, second]);
    expect(spoken.filter((id) => id === '0:1')).toEqual([]);
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

  it('is a no-op for zero seconds', () => {
    const chunks = makeChunks(4);
    expect(chunkIndexAfterSeconds(chunks, 1, 0, 1)).toBe(1);
  });
});
