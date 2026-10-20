import { describe, expect, it } from 'vitest';

import { buildSeriesQueue } from './queue';

const ITEMS = [
  { id: 'a', title: 'Ch 1', url: null, categoryId: null, categoryName: null },
  { id: 'b', title: 'Ch 2', url: null, categoryId: null, categoryName: null },
  { id: 'c', title: 'Ch 3', url: null, categoryId: null, categoryName: null },
];

describe('buildSeriesQueue', () => {
  it('chains from the current chapter forward', () => {
    const queue = buildSeriesQueue(
      ITEMS,
      new Map([
        ['a', 4],
        ['b', 2],
      ]),
      'b',
    );
    expect(queue.map((track) => track.storyId)).toEqual(['b', 'c']);
    expect(queue[0].pageCount).toBe(2);
    expect(queue[1].pageCount).toBe(0);
  });

  it('returns everything when the current chapter is unknown', () => {
    expect(buildSeriesQueue(ITEMS, new Map(), 'zzz').map((t) => t.storyId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('returns a single track at the final chapter', () => {
    expect(buildSeriesQueue(ITEMS, new Map(), 'c')).toHaveLength(1);
  });
});
