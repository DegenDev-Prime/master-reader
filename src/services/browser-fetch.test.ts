import { describe, expect, it } from 'vitest';

import {
  browserFetch,
  browserFetchAvailable,
  buildReadinessScript,
  parseBrowserPageMessage,
  setBrowserFetcher,
} from './browser-fetch';

describe('parseBrowserPageMessage', () => {
  it('parses a page message', () => {
    const raw = JSON.stringify({
      type: 'page',
      id: 'bf_1',
      url: 'https://x.test/',
      html: '<html></html>',
      ready: true,
    });
    expect(parseBrowserPageMessage(raw)).toEqual({
      type: 'page',
      id: 'bf_1',
      url: 'https://x.test/',
      html: '<html></html>',
      ready: true,
    });
  });

  it('rejects malformed or unrelated messages', () => {
    expect(parseBrowserPageMessage('not json')).toBeNull();
    expect(parseBrowserPageMessage(JSON.stringify({ type: 'other' }))).toBeNull();
    expect(parseBrowserPageMessage(JSON.stringify({ type: 'page' }))).toBeNull();
  });
});

describe('buildReadinessScript', () => {
  const script = buildReadinessScript({
    id: 'bf_9',
    waitForSelector: '.chapter-content',
    timeoutMs: 30_000,
    settleMs: 250,
  });

  it('embeds the request id, selector and timeouts', () => {
    expect(script).toContain('"bf_9"');
    expect(script).toContain('".chapter-content"');
    expect(script).toContain('30000');
    expect(script).toContain('250');
  });

  it('detects common Cloudflare interstitials', () => {
    expect(script).toContain('just a moment');
    expect(script).toContain('challenge-running');
    expect(script).toContain('cf-turnstile');
  });

  it('posts the outer HTML back to the host', () => {
    expect(script).toContain('ReactNativeWebView.postMessage');
    expect(script).toContain('documentElement');
  });
});

describe('browserFetch indirection', () => {
  it('reports availability and routes to the registered fetcher', async () => {
    expect(browserFetchAvailable()).toBe(false);
    setBrowserFetcher(async (request) => ({ url: request.url, html: '<p>ok</p>' }));
    expect(browserFetchAvailable()).toBe(true);
    await expect(browserFetch({ url: 'https://x.test/' })).resolves.toEqual({
      url: 'https://x.test/',
      html: '<p>ok</p>',
    });
    setBrowserFetcher(null);
    expect(browserFetchAvailable()).toBe(false);
    await expect(browserFetch({ url: 'https://x.test/' })).rejects.toThrow(/unavailable/i);
  });
});
