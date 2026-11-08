import { describe, expect, it } from 'vitest';

import type { ClipStack } from './clip-stack';
import { ClipWorker } from './clip-worker';
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

function makeWorker(
  synthesize: (text: string) => Promise<{ uri: string; durationMs?: number }>,
  options: { lookahead?: number; delay?: (ms: number) => Promise<void> } = {},
) {
  let latest: ClipStack | null = null;
  const worker = new ClipWorker({
    synth: { synthesize },
    delay: options.delay ?? immediate,
    lookahead: options.lookahead ?? 2,
    onUpdate: (stack) => {
      latest = stack;
    },
  });
  return { worker, latest: () => latest };
}

describe('ClipWorker', () => {
  it('synthesizes the playhead first, then the lookahead', async () => {
    const calls: string[] = [];
    const { worker, latest } = makeWorker(async (text) => {
      calls.push(text);
      return { uri: `file:///${text}.wav`, durationMs: 1000 };
    });

    worker.load(1, chunks, 0);
    await worker.whenIdle();

    expect(calls).toEqual(['one', 'two', 'three']);
    expect(latest()?.clips.map((clip) => clip.phase)).toEqual(['ready', 'ready', 'ready']);
  });

  it('retries a failed clip with backoff, then succeeds', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const { worker } = makeWorker(
      async (text) => {
        attempts += 1;
        if (attempts < 3) throw new Error('synth failed');
        return { uri: `file:///${text}.wav` };
      },
      { lookahead: 0, delay: async (ms) => void delays.push(ms) },
    );

    worker.load(1, [chunks[0]], 0);
    await worker.whenIdle();

    expect(worker.snapshot?.clips[0].phase).toBe('ready');
    expect(worker.snapshot?.clips[0].attempts).toBe(2);
    expect(delays).toEqual([400, 800]);
  });

  it('marks a permanently failing clip dead and still fills the rest', async () => {
    const calls: string[] = [];
    const { worker, latest } = makeWorker(async (text) => {
      calls.push(text);
      if (text === 'one') throw new Error('always fails');
      return { uri: `file:///${text}.wav` };
    });

    worker.load(1, chunks, 0);
    await worker.whenIdle();

    expect(latest()?.clips[0].phase).toBe('dead');
    expect(latest()?.clips[1].phase).toBe('ready');
    expect(calls.filter((text) => text === 'one')).toHaveLength(3);
  });

  it('ignores a synth result after stop', async () => {
    let release!: (value: { uri: string }) => void;
    const { worker } = makeWorker(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    worker.load(1, [chunks[0]], 0);
    await Promise.resolve();
    worker.stop();
    release({ uri: 'file:///late.wav' });
    await worker.whenIdle();

    expect(worker.snapshot).toBeNull();
  });

  it('revives a dead clip when retry is requested', async () => {
    let fail = true;
    const { worker } = makeWorker(
      async (text) => {
        if (fail) throw new Error('nope');
        return { uri: `file:///${text}.wav` };
      },
      { lookahead: 0 },
    );

    worker.load(1, [chunks[0]], 0);
    await worker.whenIdle();
    expect(worker.snapshot?.clips[0].phase).toBe('dead');

    fail = false;
    worker.retry(0);
    await worker.whenIdle();
    expect(worker.snapshot?.clips[0].phase).toBe('ready');
  });
});
