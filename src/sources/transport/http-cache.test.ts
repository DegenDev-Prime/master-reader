import { describe, expect, it } from 'vitest';

import { InMemoryResponseCache } from './cache';
import { OfflineError } from './errors';
import { HttpClient, type FetchLike, type HttpClientOptions } from './http';

const noSleep = async () => {};

function makeClient(fetchImpl: FetchLike, overrides: Partial<HttpClientOptions> = {}): HttpClient {
  return new HttpClient({
    baseUrl: 'https://example.test/api',
    userAgent: 'test-agent',
    fetch: fetchImpl,
    sleep: noSleep,
    backoff: { baseMs: 1, jitterRatio: 0 },
    retries: 0,
    ...overrides,
  });
}

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('HttpClient caching', () => {
  it('serves fresh cached GET responses without touching the network', async () => {
    const cache = new InMemoryResponseCache();
    let calls = 0;
    const client = makeClient(
      async () => {
        calls += 1;
        return json({ n: calls });
      },
      { cache, now: () => 1000 },
    );

    const first = await client.get('1/top');
    const second = await client.get('1/top');

    expect(first).toEqual({ n: 1 });
    expect(second).toEqual({ n: 1 });
    expect(calls).toBe(1);
  });

  it('revalidates stale entries and reuses the body on 304', async () => {
    const cache = new InMemoryResponseCache();
    let calls = 0;
    let lastHeaders: Record<string, string> = {};

    const fetchImpl: FetchLike = async (_url, init) => {
      calls += 1;
      lastHeaders = init?.headers as Record<string, string>;
      if (calls === 1) return json({ n: 1 }, { etag: 'W/"1"' });
      return new Response(null, { status: 304 });
    };

    const fresh = makeClient(fetchImpl, { cache, now: () => 1000 });
    await fresh.get('1/top');

    const stale = makeClient(fetchImpl, { cache, now: () => 1000 + 20 * 60 * 1000 });
    const result = await stale.get('1/top');

    expect(result).toEqual({ n: 1 });
    expect(calls).toBe(2);
    expect(lastHeaders['if-none-match']).toBe('W/"1"');
  });

  it('serves stale cache when offline', async () => {
    const cache = new InMemoryResponseCache();
    const online = makeClient(async () => json({ n: 1 }), { cache, now: () => 1000 });
    await online.get('1/top');

    const offline = makeClient(async () => Promise.reject(new Error('no network')), {
      cache,
      now: () => 1000 + 60 * 60 * 1000,
      isOffline: () => true,
    });

    await expect(offline.get('1/top')).resolves.toEqual({ n: 1 });
  });

  it('throws OfflineError when offline with nothing cached', async () => {
    const client = makeClient(async () => Promise.reject(new Error('no network')), {
      cache: new InMemoryResponseCache(),
      isOffline: () => true,
    });

    await expect(client.get('1/top')).rejects.toBeInstanceOf(OfflineError);
  });

  it('falls back to cache when the network fails and an entry exists', async () => {
    const cache = new InMemoryResponseCache();
    const online = makeClient(async () => json({ n: 1 }), { cache, now: () => 1000 });
    await online.get('1/top');

    const failing = makeClient(async () => Promise.reject(new Error('down')), {
      cache,
      now: () => 1000 + 60 * 60 * 1000,
    });

    await expect(failing.get('1/top')).resolves.toEqual({ n: 1 });
  });

  it('does not cache when skipCache is set', async () => {
    const cache = new InMemoryResponseCache();
    let calls = 0;
    const client = makeClient(
      async () => {
        calls += 1;
        return json({ n: calls });
      },
      { cache, now: () => 1000 },
    );

    await client.get('1/top', { skipCache: true });
    await client.get('1/top', { skipCache: true });

    expect(calls).toBe(2);
    expect(cache.size).toBe(0);
  });
});
