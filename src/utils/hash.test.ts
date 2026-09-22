import { describe, expect, it } from 'vitest';

import { hashParams, stableStringify } from './hash';

describe('stableStringify', () => {
  it('is insensitive to key order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('preserves array order', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('drops undefined values', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe('hashParams', () => {
  it('produces the same hash regardless of key order', () => {
    expect(hashParams({ page: 1, sort: 'newest' })).toBe(hashParams({ sort: 'newest', page: 1 }));
  });

  it('differs when values differ', () => {
    expect(hashParams({ page: 1 })).not.toBe(hashParams({ page: 2 }));
  });
});
