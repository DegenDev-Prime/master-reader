import { describe, expect, it } from 'vitest';

import { absoluteUrl, normalizePage, toNumberOrNull, toPagedResult } from './provider-utils';

describe('normalizePage', () => {
  it('defaults invalid pages to 1', () => {
    expect(normalizePage(undefined)).toBe(1);
    expect(normalizePage(0)).toBe(1);
    expect(normalizePage(-3)).toBe(1);
    expect(normalizePage(Number.NaN)).toBe(1);
  });

  it('floors valid pages', () => {
    expect(normalizePage(2.9)).toBe(2);
  });
});

describe('absoluteUrl', () => {
  it('resolves relative and protocol-relative paths', () => {
    expect(absoluteUrl('https://a.com', '/b/c')).toBe('https://a.com/b/c');
    expect(absoluteUrl('https://a.com', 'b/c')).toBe('https://a.com/b/c');
    expect(absoluteUrl('https://a.com', '//cdn/x.jpg')).toBe('https://cdn/x.jpg');
  });

  it('keeps absolute URLs and nulls empties', () => {
    expect(absoluteUrl('https://a.com', 'https://z.com/x')).toBe('https://z.com/x');
    expect(absoluteUrl('https://a.com', null)).toBeNull();
  });
});

describe('toNumberOrNull', () => {
  it('parses numbers with separators', () => {
    expect(toNumberOrNull('1,234')).toBe(1234);
    expect(toNumberOrNull('4.85')).toBe(4.85);
  });

  it('returns null for missing or invalid input', () => {
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull('abc')).toBeNull();
  });
});

describe('toPagedResult', () => {
  it('wraps items with paging metadata', () => {
    expect(toPagedResult([], 2, true, 40)).toEqual({
      items: [],
      page: 2,
      hasNext: true,
      total: 40,
    });
  });
});
