import { describe, expect, it } from 'vitest';

import {
  appendChunks,
  clipDurationMs,
  clipIndexAtMs,
  createClipStack,
  markDead,
  markPending,
  markReady,
  markSynthesizing,
  nextPlayableIndex,
  planPrefetch,
  recordFailure,
  retryDelayMs,
  seekByMs,
  shouldRetry,
  totalDurationMs,
  type ClipStack,
} from './clip-stack';
import type { SpeechChunk } from './chunker';

const chunk = (index: number, text: string): SpeechChunk => ({
  id: `0:${index}`,
  pageIndex: 0,
  start: 0,
  end: text.length,
  text,
});

function stack(): ClipStack {
  return createClipStack(1, [chunk(0, 'one two three'), chunk(1, 'four five'), chunk(2, 'six')]);
}

describe('clip stack', () => {
  it('creates one clip per chunk and appends without renumbering', () => {
    const base = stack();
    expect(base.clips.map((clip) => clip.index)).toEqual([0, 1, 2]);

    const grown = appendChunks(base, [chunk(3, 'seven eight')]);
    expect(grown.clips.map((clip) => clip.index)).toEqual([0, 1, 2, 3]);
    expect(grown.clips[0].chunkId).toBe(base.clips[0].chunkId);
  });

  it('moves a clip through synthesis and readiness', () => {
    let current = markSynthesizing(stack(), 1);
    expect(current.clips[1].phase).toBe('synthesizing');

    current = markReady(current, 1, { uri: 'file:///one.wav', durationMs: 500 });
    expect(current.clips[1]).toMatchObject({ phase: 'ready', audio: { uri: 'file:///one.wav' } });
  });

  it('retries until the policy is exhausted, then marks the clip dead', () => {
    let current = stack();
    current = recordFailure(current, 0, 'boom');
    expect(current.clips[0]).toMatchObject({ phase: 'failed', attempts: 1 });
    expect(shouldRetry(current.clips[0].attempts)).toBe(true);

    current = recordFailure(current, 0, 'boom');
    expect(current.clips[0].phase).toBe('failed');

    current = recordFailure(current, 0, 'boom');
    expect(current.clips[0]).toMatchObject({ phase: 'dead', attempts: 3 });
    expect(shouldRetry(current.clips[0].attempts)).toBe(false);
  });

  it('does not revive ready or dead clips when marking pending', () => {
    const ready = markReady(stack(), 0, { uri: 'file:///one.wav' });
    expect(markPending(ready, 0).clips[0].phase).toBe('ready');
    expect(markPending(markDead(stack(), 0), 0).clips[0].phase).toBe('dead');
  });

  it('backoff grows exponentially and is capped', () => {
    expect([1, 2, 3, 4].map((attempt) => retryDelayMs(attempt))).toEqual([400, 800, 1600, 3200]);
    expect(retryDelayMs(8)).toBe(5000);
  });

  it('plans the playhead first, then only clips that still need work', () => {
    let current = stack();
    current = markReady(current, 1, { uri: 'file:///one.wav' });
    current = markDead(current, 2);
    expect(planPrefetch(current, 1, 2)).toEqual([]);
    expect(planPrefetch(current, 0, 2)).toEqual([0]);
  });

  it('skips dead clips in both directions', () => {
    const current = markDead(markDead(stack(), 1), 2);
    expect(nextPlayableIndex(current, 0)).toBe(0);
    expect(nextPlayableIndex(current, 1)).toBeNull();
    expect(nextPlayableIndex(current, 2, -1)).toBe(0);
    expect(nextPlayableIndex(current, 3, -1)).toBe(0);
  });
});

describe('clip timeline', () => {
  it('uses exact durations after synthesis and estimates before it', () => {
    let current = stack();
    current = markReady(current, 0, { uri: 'file:///one.wav', durationMs: 1000 });
    expect(clipDurationMs(current, 0)).toBe(1000);
    expect(clipDurationMs(current, 1)).toBeGreaterThan(0);
    expect(totalDurationMs(current)).toBeGreaterThan(1000);
  });

  it('applies playback speed to both exact and estimated clips', () => {
    const current = markReady(stack(), 0, { uri: 'file:///one.wav', durationMs: 1000 });
    expect(clipDurationMs(current, 0, 2)).toBe(500);
  });

  it('seeks forward and backward across clip boundaries', () => {
    const current = stack();
    const forward = seekByMs(current, 0, 0, 10_000);
    expect(forward.index).toBe(2);

    const back = seekByMs(current, 2, 0, -10_000);
    expect(back.index).toBe(0);
    expect(back.intoMs).toBe(0);
  });

  it('maps a timeline position back to a clip', () => {
    const current = stack();
    expect(clipIndexAtMs(current, 0)).toBe(0);
    expect(clipIndexAtMs(current, Number.MAX_SAFE_INTEGER)).toBe(2);
  });
});
