import { describe, expect, it } from 'vitest';

import { emptyCounts, shouldImport } from './merge';

describe('shouldImport', () => {
  it('imports everything when replacing', () => {
    expect(shouldImport(true, 'replace')).toBe(true);
    expect(shouldImport(false, 'replace')).toBe(true);
  });

  it('overwrites existing records when merging', () => {
    expect(shouldImport(true, 'merge')).toBe(true);
    expect(shouldImport(false, 'merge')).toBe(true);
  });

  it('keeps existing records when skipping', () => {
    expect(shouldImport(true, 'skip')).toBe(false);
    expect(shouldImport(false, 'skip')).toBe(true);
  });
});

describe('emptyCounts', () => {
  it('starts at zero', () => {
    expect(emptyCounts()).toEqual({ imported: 0, skipped: 0 });
  });
});
