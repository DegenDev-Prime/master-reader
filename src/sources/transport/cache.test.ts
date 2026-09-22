import { describe, expect, it } from 'vitest';

import { cacheDirective, isFresh, parseMaxAgeMs } from './cache';

describe('isFresh', () => {
  it('treats an entry with a future expiry as fresh', () => {
    expect(isFresh({ status: 200, body: '{}', expiresAt: 2000 }, 1000)).toBe(true);
    expect(isFresh({ status: 200, body: '{}', expiresAt: 500 }, 1000)).toBe(false);
  });

  it('treats a null expiry as always stale', () => {
    expect(isFresh({ status: 200, body: '{}', expiresAt: null }, 1000)).toBe(false);
  });
});

describe('parseMaxAgeMs', () => {
  it('parses max-age and s-maxage', () => {
    expect(parseMaxAgeMs('public, max-age=60')).toBe(60_000);
    expect(parseMaxAgeMs('s-maxage=120')).toBe(120_000);
    expect(parseMaxAgeMs('no-store')).toBeNull();
    expect(parseMaxAgeMs(null)).toBeNull();
  });
});

describe('cacheDirective', () => {
  const headers = (value: string) => new Headers({ 'cache-control': value });

  it('uses max-age when present', () => {
    expect(cacheDirective(headers('max-age=60'), 1000)).toEqual({ store: true, expiresAt: 61_000 });
  });

  it('falls back to the default TTL', () => {
    expect(cacheDirective(headers('public'), 1000, 5000)).toEqual({
      store: true,
      expiresAt: 6000,
    });
  });

  it('refuses to store no-store responses', () => {
    expect(cacheDirective(headers('no-store'), 1000)).toEqual({ store: false, expiresAt: null });
  });
});
