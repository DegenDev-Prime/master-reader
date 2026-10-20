import { describe, expect, it } from 'vitest';

import {
  chunkOffsets,
  estimateDurationMs,
  formatChapterLength,
  formatDuration,
  playerTiming,
} from './player-estimates';

describe('estimateDurationMs', () => {
  it('scales with the word count', () => {
    const words = Array.from({ length: 150 }, () => 'word').join(' ');
    expect(estimateDurationMs(words, 1)).toBe(60_000);
  });

  it('gets faster at a higher speed', () => {
    const words = Array.from({ length: 150 }, () => 'word').join(' ');
    expect(estimateDurationMs(words, 2)).toBe(30_000);
  });

  it('treats empty text as no time', () => {
    expect(estimateDurationMs('', 1)).toBe(0);
  });
});

describe('playerTiming', () => {
  const chunks = [
    { text: 'one two three four five six seven eight nine ten' },
    { text: 'eleven twelve thirteen fourteen fifteen sixteen' },
    { text: 'seventeen eighteen nineteen twenty' },
  ];

  it('reports zero for an empty session', () => {
    expect(playerTiming([], 0)).toEqual({
      elapsedMs: 0,
      totalMs: 0,
      remainingMs: 0,
      fraction: 0,
    });
  });

  it('grows the elapsed time with the chunk index', () => {
    const first = playerTiming(chunks, 0);
    const second = playerTiming(chunks, 1);
    const last = playerTiming(chunks, 2);

    expect(first.elapsedMs).toBeLessThan(second.elapsedMs);
    expect(second.elapsedMs).toBeLessThan(last.elapsedMs);
    expect(last.fraction).toBeGreaterThan(0.9);
    expect(first.fraction).toBeLessThan(0.5);
  });

  it('clamps an out-of-range index', () => {
    const clamped = playerTiming(chunks, 99);
    expect(clamped.fraction).toBeLessThanOrEqual(1);
    expect(clamped.remainingMs).toBeGreaterThanOrEqual(0);
  });

  it('agrees with the timeline the skip controls use', () => {
    const offsets = chunkOffsets(chunks, 1);
    const timing = playerTiming(chunks, 1, 1);
    // The current chunk is taken to be half spoken, so the clock sits halfway
    // through it. A skip that uses the same timeline lands where the clock
    // says it should.
    const half = (offsets[1] + (offsets[2] - offsets[1]) / 2) * 1000;
    expect(Math.abs(timing.elapsedMs - half)).toBeLessThan(2);
  });
});

describe('playerTiming with a known position', () => {
  const chunks = [
    { text: 'one two three four five six seven eight nine ten' },
    { text: 'eleven twelve thirteen fourteen fifteen sixteen' },
    { text: 'seventeen eighteen nineteen twenty' },
  ];

  it('counts the position inside the current chunk', () => {
    const atStart = playerTiming(chunks, 1, 1, 0);
    const later = playerTiming(chunks, 1, 1, 1.5);
    expect(later.elapsedMs).toBeGreaterThan(atStart.elapsedMs);
  });

  it('never counts more than the chunk itself', () => {
    const beyond = playerTiming(chunks, 1, 1, 999);
    expect(beyond.elapsedMs).toBeLessThanOrEqual(beyond.totalMs);
  });
});

describe('chunkOffsets', () => {
  it('starts the first chunk at zero and adds up the lengths', () => {
    const chunks = [
      { text: 'one two three four five six seven eight nine ten' },
      { text: 'eleven twelve thirteen fourteen fifteen sixteen' },
    ];
    const offsets = chunkOffsets(chunks, 1);
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBeGreaterThan(offsets[0]);
  });
});

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(14 * 60_000 + 2_000)).toBe('14:02');
  });

  it('formats hours', () => {
    expect(formatDuration(3_723_000)).toBe('1:02:03');
  });

  it('formats zero', () => {
    expect(formatDuration(0)).toBe('0:00');
  });
});

describe('formatChapterLength', () => {
  it('rounds to whole minutes', () => {
    expect(formatChapterLength(300)).toBe('2 min');
    expect(formatChapterLength(30)).toBe('1 min');
  });

  it('returns null without a word count', () => {
    expect(formatChapterLength(null)).toBeNull();
    expect(formatChapterLength(0)).toBeNull();
  });
});
