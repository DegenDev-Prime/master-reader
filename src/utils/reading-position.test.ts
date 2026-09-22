import { describe, expect, it } from 'vitest';

import {
  clampPageIndex,
  nextPageIndex,
  previousPageIndex,
  progressPercent,
} from './reading-position';

describe('clampPageIndex', () => {
  it('keeps the index inside the page range', () => {
    expect(clampPageIndex(0, 5)).toBe(0);
    expect(clampPageIndex(4, 5)).toBe(4);
    expect(clampPageIndex(9, 5)).toBe(4);
    expect(clampPageIndex(-3, 5)).toBe(0);
  });

  it('handles empty documents and non-finite input', () => {
    expect(clampPageIndex(3, 0)).toBe(0);
    expect(clampPageIndex(Number.NaN, 5)).toBe(0);
  });
});

describe('page navigation', () => {
  it('advances without overrunning the last page', () => {
    expect(nextPageIndex(0, 3)).toBe(1);
    expect(nextPageIndex(2, 3)).toBe(2);
  });

  it('retreats without going below zero', () => {
    expect(previousPageIndex(2)).toBe(1);
    expect(previousPageIndex(0)).toBe(0);
  });
});

describe('progressPercent', () => {
  it('reports the completion percentage', () => {
    expect(progressPercent(0, 4)).toBe(25);
    expect(progressPercent(3, 4)).toBe(100);
  });

  it('guards against empty documents', () => {
    expect(progressPercent(0, 0)).toBe(0);
  });
});
