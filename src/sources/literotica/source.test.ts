import { describe, expect, it } from 'vitest';

import { loadFixture } from '@/test-utils/fixtures';
import { HttpClient, NotFoundError, type FetchLike } from '../transport';
import { LiteroticaSource } from './index';

type Responder = () => unknown;

const routes: Record<string, Responder> = {
  '3/constants': () => loadFixture('constants.json'),
  '3/search/stories': () => loadFixture('v3-search.json'),
  '3/stories/': () => loadFixture('v3-story.json'),
  '3/tagsportal/by-name': () => loadFixture('tags-by-name.json'),
  '3/tagsportal/stories': () => loadFixture('v3-tag-portal.json'),
  '3/tagsportal/top': () => loadFixture('tags-top.json'),
};

function createSource(
  configuredRoutes: Record<string, Responder> = routes,
  options: { credentials?: { apikey?: string; appid?: string } } = {},
) {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    for (const [needle, responder] of Object.entries(configuredRoutes)) {
      if (url.includes(needle)) {
        return new Response(JSON.stringify(responder()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return new Response('not found', { status: 404 });
  };

  const http = new HttpClient({
    baseUrl: 'https://literotica.com/api',
    userAgent: 'test',
    fetch: fetchImpl,
    retries: 0,
    sleep: async () => {},
  });

  return { source: new LiteroticaSource({ http, credentials: options.credentials }), calls };
}

describe('LiteroticaSource', () => {
  it('advertises its capabilities', () => {
    const { source } = createSource();
    expect(source.info.id).toBe('literotica');
    expect(source.info.capabilities).toContain('search');
    expect(source.isLoggedIn()).toBe(false);
  });

  it('maps popular listings through the v3 search endpoint', async () => {
    const { source, calls } = createSource();
    const result = await source.getPopular();

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(decodeURIComponent(calls[0])).toContain('"sort":"comments"');
  });

  it('requests new-only listings for latest', async () => {
    const { source, calls } = createSource();
    const result = await source.getLatest({ page: 2 });

    expect(result.items).toHaveLength(1);
    expect(decodeURIComponent(calls[0])).toContain('"sort":"date"');
    expect(decodeURIComponent(calls[0])).toContain('"page":2');
  });

  it('passes a category filter to browse listings', async () => {
    const { source, calls } = createSource();
    await source.getPopular({ page: 1, category: '6' });

    expect(decodeURIComponent(calls[0])).toContain('"categories":[6]');
  });

  it('searches by keyword through the v3 endpoint', async () => {
    const { source, calls } = createSource();
    const result = await source.search({ query: 'neon' });

    expect(result.items[0].title).toBe('Neon & Rain');
    expect(decodeURIComponent(calls[0])).toContain('"q":"neon"');
  });

  it('maps sort options to the v3 sort parameter', async () => {
    const { source, calls } = createSource();

    await source.search({ query: 'neon', sort: 'newest' });
    expect(decodeURIComponent(calls[0])).toContain('"sort":"date"');

    await source.search({ query: 'neon', sort: 'rating' });
    expect(decodeURIComponent(calls[1])).toContain('"sort":"vote"');

    await source.search({ query: 'neon', sort: 'comments' });
    expect(decodeURIComponent(calls[2])).toContain('"sort":"comments"');

    expect(calls.every((call) => !call.includes('sort_by'))).toBe(true);
  });

  it('resolves tag searches in two steps', async () => {
    const { source, calls } = createSource();
    const result = await source.search({ tags: ['romance'] });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('3/tagsportal/by-name');
    expect(calls[1]).toContain('3/tagsportal/stories');
    expect(result.items[0].id).toBe('301');
  });

  it('fetches story details with pages and series', async () => {
    const { source } = createSource();
    const details = await source.getStory('101');

    expect(details?.id).toBe('101');
    expect(details?.seriesId).toBe('55');
    expect(details?.seriesTitle).toBe('The Long Road');
    expect(details?.pages).toHaveLength(2);
    expect(details?.series?.items.map((item) => item.id)).toEqual(['101', '102']);

    const metaOnly = await source.getStory('101', { includeContent: false });
    expect(metaOnly?.pages).toBeUndefined();
  });

  it('lists tags and categories', async () => {
    const { source } = createSource();

    await expect(source.getTags()).resolves.toEqual(['romance', 'slowburn', 'thriller']);
    const categories = await source.getCategories();
    expect(categories).toContainEqual({ id: '6', name: 'Gay Male' });
    expect(categories.length).toBeGreaterThan(10);
  });

  it('appends configured credentials to requests', async () => {
    const { source, calls } = createSource(routes, {
      credentials: { apikey: 'KEY', appid: 'APP' },
    });
    await source.getPopular();

    expect(calls[0]).toContain('apikey=KEY');
    expect(calls[0]).toContain('appid=APP');
  });

  it('surfaces a NotFoundError for unknown endpoints', async () => {
    const { source } = createSource({});
    await expect(source.getPopular()).rejects.toBeInstanceOf(NotFoundError);
  });
});
