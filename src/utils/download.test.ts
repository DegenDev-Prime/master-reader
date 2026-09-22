import { describe, expect, it } from 'vitest';

import { computeStorySizeBytes, downloadProgressPercent } from './download';

describe('computeStorySizeBytes', () => {
  it('sums the content length of every page', () => {
    expect(computeStorySizeBytes([{ content: 'abc' }, { content: 'de' }])).toBe(5);
  });

  it('treats missing or null content as zero', () => {
    expect(computeStorySizeBytes([{ content: null }, {}, { content: 'x' }])).toBe(1);
  });

  it('returns zero for an empty list', () => {
    expect(computeStorySizeBytes([])).toBe(0);
  });
});

describe('downloadProgressPercent', () => {
  it('rounds the completed fraction', () => {
    expect(downloadProgressPercent(1, 4)).toBe(25);
    expect(downloadProgressPercent(3, 4)).toBe(75);
    expect(downloadProgressPercent(4, 4)).toBe(100);
  });

  it('guards against unknown or zero totals', () => {
    expect(downloadProgressPercent(1, 0)).toBe(0);
    expect(downloadProgressPercent(1, null)).toBe(0);
    expect(downloadProgressPercent(1, undefined)).toBe(0);
  });
});
