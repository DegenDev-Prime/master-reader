import { describe, expect, it, vi } from 'vitest';

import type { ExtensionManifest } from './manifest';
import type { ExtensionRuntime } from './runtime';
import { createExtensionSource } from './source';

const manifest: ExtensionManifest = {
  id: 'com.example.source',
  name: 'Example',
  version: '1.0.0',
  lang: 'en',
  baseUrl: 'https://example.com',
  capabilities: ['popular', 'latest', 'search'],
};

function fakeRuntime(responses: Record<string, unknown>) {
  const call = vi.fn(async (method: string) => responses[method]);
  return {
    runtime: { ready: Promise.resolve(manifest), call } as unknown as ExtensionRuntime,
    call,
  };
}

describe('createExtensionSource', () => {
  it('exposes the manifest as source info', () => {
    const { runtime } = fakeRuntime({});
    const source = createExtensionSource(manifest, runtime);
    expect(source.info).toEqual({
      id: 'com.example.source',
      name: 'Example',
      lang: 'en',
      baseUrl: 'https://example.com',
      capabilities: ['popular', 'latest', 'search'],
    });
    expect(source.isLoggedIn()).toBe(false);
  });

  it('stamps sourceId and defaults flags on listings', async () => {
    const { runtime, call } = fakeRuntime({
      getPopular: {
        page: 2,
        hasNext: true,
        items: [{ id: 7, title: 'A Tale' }],
      },
    });

    const source = createExtensionSource(manifest, runtime);
    const result = await source.getPopular({ page: 2 });

    expect(call).toHaveBeenCalledWith('getPopular', [{ page: 2 }]);
    expect(result.page).toBe(2);
    expect(result.hasNext).toBe(true);
    expect(result.items[0]).toMatchObject({
      sourceId: 'com.example.source',
      id: '7',
      title: 'A Tale',
      flags: {},
    });
  });

  it('normalises story pages and honours includeContent', async () => {
    const { runtime } = fakeRuntime({
      getStory: {
        id: '7',
        title: 'A Tale',
        seriesId: 'series-1',
        flags: {},
        pages: [{ content: 'one' }, { content: 'two' }],
      },
    });

    const source = createExtensionSource(manifest, runtime);
    const details = await source.getStory('7');

    expect(details?.seriesId).toBe('series-1');
    expect(details?.pages).toEqual([
      {
        sourceId: 'com.example.source',
        storyId: '7',
        index: 0,
        title: null,
        content: 'one',
        wordCount: null,
      },
      {
        sourceId: 'com.example.source',
        storyId: '7',
        index: 1,
        title: null,
        content: 'two',
        wordCount: null,
      },
    ]);

    const metaOnly = await source.getStory('7', { includeContent: false });
    expect(metaOnly?.pages).toBeUndefined();
  });

  it('returns null for missing stories', async () => {
    const { runtime } = fakeRuntime({ getStory: null });
    const source = createExtensionSource(manifest, runtime);
    await expect(source.getStory('missing')).resolves.toBeNull();
  });
});
