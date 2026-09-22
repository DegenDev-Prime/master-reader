import { describe, expect, it } from 'vitest';

import { HttpError, NotFoundError, ParseError, RateLimitError, TimeoutError } from './errors';
import { HttpClient, type FetchLike, type HttpClientOptions } from './http';

const noSleep = async () => {};

function makeClient(fetchImpl: FetchLike, overrides: Partial<HttpClientOptions> = {}): HttpClient {
  return new HttpClient({
    baseUrl: 'https://example.test/api',
    userAgent: 'test-agent',
    fetch: fetchImpl,
    sleep: noSleep,
    backoff: { baseMs: 1, jitterRatio: 0 },
    retries: 2,
    ...overrides,
  });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('HttpClient', () => {
  it('joins the base url, encodes the query and sends the user agent', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = makeClient(async (url, init) => {
      calls.push({ url, init });
      return json({ ok: true });
    });

    const data = await client.get<{ ok: boolean }>('3/constants', {
      query: { q: 'a b', page: 2, flag: true, skipped: undefined },
    });

    expect(data).toEqual({ ok: true });
    expect(calls[0].url).toBe('https://example.test/api/3/constants?q=a%20b&page=2&flag=true');
    expect((calls[0].init?.headers as Record<string, string>)['user-agent']).toBe('test-agent');
  });

  it('retries 5xx responses and then succeeds', async () => {
    let attempts = 0;
    const client = makeClient(async () => {
      attempts += 1;
      return attempts < 2 ? new Response('nope', { status: 503 }) : json({ ok: 1 });
    });

    await expect(client.get('1/top')).resolves.toEqual({ ok: 1 });
    expect(attempts).toBe(2);
  });

  it('throws HttpError once retries are exhausted', async () => {
    const client = makeClient(async () => new Response('bad', { status: 502 }));
    await expect(client.get('1/top')).rejects.toBeInstanceOf(HttpError);
  });

  it('does not retry 404 responses', async () => {
    let attempts = 0;
    const client = makeClient(async () => {
      attempts += 1;
      return new Response('missing', { status: 404 });
    });

    await expect(client.get('1/top')).rejects.toBeInstanceOf(NotFoundError);
    expect(attempts).toBe(1);
  });

  it('honours Retry-After on 429 before retrying', async () => {
    const slept: number[] = [];
    let attempts = 0;
    const client = makeClient(
      async () => {
        attempts += 1;
        return attempts < 2
          ? new Response('slow down', { status: 429, headers: { 'retry-after': '2' } })
          : json({ ok: 1 });
      },
      { sleep: async (ms) => void slept.push(ms), retries: 1 },
    );

    await expect(client.get('1/top')).resolves.toEqual({ ok: 1 });
    expect(slept).toEqual([2000]);
  });

  it('throws RateLimitError when 429 persists', async () => {
    const client = makeClient(
      async () => new Response('slow down', { status: 429, headers: { 'retry-after': '1' } }),
      { retries: 0 },
    );

    await expect(client.get('1/top')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('retries network failures', async () => {
    let attempts = 0;
    const client = makeClient(async () => {
      attempts += 1;
      if (attempts < 2) throw new Error('boom');
      return json({ ok: 1 });
    });

    await expect(client.get('1/top')).resolves.toEqual({ ok: 1 });
    expect(attempts).toBe(2);
  });

  it('times out hung requests', async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });

    const client = makeClient(fetchImpl, { retries: 0, timeoutMs: 10 });
    await expect(client.get('slow')).rejects.toBeInstanceOf(TimeoutError);
  });

  it('sends cookies captured from earlier responses', async () => {
    const headers: Record<string, string>[] = [];
    const client = makeClient(async (_url, init) => {
      headers.push(init?.headers as Record<string, string>);
      return new Response('{}', { status: 200, headers: { 'set-cookie': 'sid=1' } });
    });

    await client.get('a');
    await client.get('b');

    expect(headers[0].cookie).toBeUndefined();
    expect(headers[1].cookie).toBe('sid=1');
  });

  it('wraps invalid JSON in a ParseError', async () => {
    const client = makeClient(async () => new Response('not json', { status: 200 }));
    await expect(client.get('1/top')).rejects.toBeInstanceOf(ParseError);
  });
});
