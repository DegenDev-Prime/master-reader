import { describe, expect, it } from 'vitest';

import type { ReadingProgress } from '@/models/story';

import { computeReadingStats, weekStartSeconds } from './stats';

const DAY = 24 * 60 * 60;
const NOW_MS = 1_800_000_000_000;
const NOW_S = Math.floor(NOW_MS / 1000);

const row = (overrides: Partial<ReadingProgress>): ReadingProgress => ({
  sourceId: 's',
  storyId: 'x',
  pageIndex: 0,
  pageCount: 10,
  scrollPct: 0,
  updatedAt: NOW_S,
  ...overrides,
});

describe('weekStartSeconds', () => {
  it('is exactly seven days back', () => {
    expect(weekStartSeconds(NOW_MS)).toBe(NOW_S - 7 * DAY);
  });
});

describe('computeReadingStats', () => {
  it('counts touched rows and finished chapters', () => {
    const progress = [
      row({ storyId: '1', pageIndex: 4, pageCount: 10, updatedAt: NOW_S - DAY }),
      row({ storyId: '2', pageIndex: 9, pageCount: 10, updatedAt: NOW_S - 2 * DAY }),
      row({ storyId: '3', pageIndex: 0, pageCount: null, updatedAt: NOW_S - DAY }),
    ];
    expect(computeReadingStats(progress, 'week', NOW_MS)).toEqual({
      chaptersRead: 3,
      chaptersFinished: 1,
    });
  });

  it('honors the week boundary for the week range', () => {
    const progress = [
      row({ storyId: 'old', updatedAt: NOW_S - 9 * DAY, pageIndex: 9, pageCount: 10 }),
      row({ storyId: 'new', updatedAt: NOW_S - 3 * DAY }),
    ];
    expect(computeReadingStats(progress, 'week', NOW_MS)).toEqual({
      chaptersRead: 1,
      chaptersFinished: 0,
    });
    expect(computeReadingStats(progress, 'all', NOW_MS)).toEqual({
      chaptersRead: 2,
      chaptersFinished: 1,
    });
  });

  it('is empty without progress', () => {
    expect(computeReadingStats([], 'all', NOW_MS)).toEqual({
      chaptersRead: 0,
      chaptersFinished: 0,
    });
  });
});
