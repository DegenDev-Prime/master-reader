import { describe, expect, it } from 'vitest';

import { cacheFileName, selectEvictions, synthCacheKeyInput, type CacheIndex } from './synth-cache';

describe('synthCacheKeyInput', () => {
  it('is stable and separates engine, voice and text', () => {
    const base = synthCacheKeyInput('piper', 'amy', 'Hello world.');
    expect(synthCacheKeyInput('piper', 'amy', 'Hello world.')).toBe(base);
    expect(synthCacheKeyInput('kokoro', 'amy', 'Hello world.')).not.toBe(base);
    expect(synthCacheKeyInput('piper', 'ryan', 'Hello world.')).not.toBe(base);
    expect(synthCacheKeyInput('piper', 'amy', 'Other text.')).not.toBe(base);
  });
});

describe('cacheFileName', () => {
  it('produces wav filenames', () => {
    expect(cacheFileName('abc123')).toBe('abc123.wav');
  });
});

describe('selectEvictions', () => {
  const index: CacheIndex = {
    old: { bytes: 100, accessedAt: 1 },
    mid: { bytes: 100, accessedAt: 2 },
    new: { bytes: 100, accessedAt: 3 },
  };

  it('evicts least-recently-used first until the incoming file fits', () => {
    expect(selectEvictions(index, 150, 300)).toEqual(['old', 'mid']);
  });

  it('evicts nothing when everything fits', () => {
    expect(selectEvictions(index, 0, 300)).toEqual([]);
  });

  it('handles an empty index', () => {
    expect(selectEvictions({}, 10, 100)).toEqual([]);
  });
});
