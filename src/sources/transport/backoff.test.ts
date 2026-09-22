import { describe, expect, it } from 'vitest';

import { computeBackoffDelay, parseRetryAfter } from './backoff';

describe('computeBackoffDelay', () => {
  it('grows exponentially and is capped', () => {
    const options = { baseMs: 100, factor: 2, maxMs: 1000, jitterRatio: 0 };
    expect(computeBackoffDelay(1, options)).toBe(100);
    expect(computeBackoffDelay(2, options)).toBe(200);
    expect(computeBackoffDelay(3, options)).toBe(400);
    expect(computeBackoffDelay(10, options)).toBe(1000);
  });

  it('applies bounded jitter', () => {
    const base = { baseMs: 100, factor: 2, jitterRatio: 0.25 };
    expect(computeBackoffDelay(3, { ...base, random: () => 0 })).toBe(400);
    expect(computeBackoffDelay(3, { ...base, random: () => 1 })).toBe(300);
  });

  it('never returns a negative delay', () => {
    expect(computeBackoffDelay(0, { baseMs: 100, jitterRatio: 2, random: () => 1 })).toBe(0);
  });
});

describe('parseRetryAfter', () => {
  it('parses delay-seconds', () => {
    expect(parseRetryAfter('2')).toBe(2000);
  });

  it('parses an HTTP date', () => {
    const now = Date.UTC(2021, 0, 1, 0, 0, 0);
    const header = new Date(now + 5000).toUTCString();
    expect(parseRetryAfter(header, now)).toBe(5000);
  });

  it('returns undefined for unparseable input', () => {
    expect(parseRetryAfter('soon')).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});
