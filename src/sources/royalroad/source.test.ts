import { describe, expect, it } from 'vitest';

import { loadTextFixture } from '@/test-utils/fixtures';
import { NotFoundError, SourceError } from '../transport';
import { RoyalRoadSource } from './index';

const listing = () => loadTextFixture('listing.html', 'royalroad');
const book = () => loadTextFixture('book.html', 'royalroad');
const chapter = () => loadTextFixture('chapter.html', 'royalroad');
const challenge = () => loadTextFixture('challenge.html', 'royalroad');

const routes: Record<string, () => string> = {
  '/fiction/21220/mother-of-learning/chapter/': chapter,
  '/fiction/21220': book,
  '/fictions/best-rated': listing,
  '/fictions/latest-updates': listing,
  '/fictions/search': listing,
};

function createSource(responder: (url: string) => string) {
  const calls: string[] = [];
  const source = new RoyalRoadSource({
    loadHtml: async (url) => {
      calls.push(url);
      return responder(url);
    },
  });
  return { source, calls };
}

function successResponder(url: string): string {
  for (const [needle, fixture] of Object.entries(routes)) {
    if (url.includes(needle)) return fixture();
  }
  throw new NotFoundError({ url });
}

describe('RoyalRoadSource', () => {
  it('advertises its capabilities and browser mode', () => {
    const { source } = createSource(successResponder);
    expect(source.info.id).toBe('royalroad');
    expect(source.info.capabilities).toContain('popular');
    expect(source.usesBrowser).toBe(true);
    expect(source.isLoggedIn()).toBe(false);
  });

  it('maps a listing via the current best-rated route', async () => {
    const { source, calls } = createSource(successResponder);
    const result = await source.getPopular();
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('Mother of Learning');
    expect(calls[0]).toContain('/fictions/best-rated');
    expect(calls[0]).not.toContain('/fictions/popular');
  });

  it('returns chapter stubs without content', async () => {
    const { source } = createSource(successResponder);
    const details = await source.getStory('21220');

    expect(details?.title).toBe('Mother of Learning');
    expect(details?.pages).toHaveLength(2);
    expect(details?.pages?.[0]).toMatchObject({
      index: 0,
      title: 'Chapter 1: Good Morning, Brother',
      id: '/fiction/21220/mother-of-learning/chapter/1',
      content: null,
    });

    const metaOnly = await source.getStory('21220', { includeContent: false });
    expect(metaOnly?.pages).toBeUndefined();
  });

  it('fetches the fiction page once for metadata and chapter list', async () => {
    const { source, calls } = createSource(successResponder);
    await source.getStory('21220', { includeContent: false });
    expect(calls.filter((call) => call.endsWith('/fiction/21220'))).toHaveLength(1);
  });

  it('lists every chapter from the fiction page', async () => {
    const { source, calls } = createSource(successResponder);
    const chapters = await source.getChapterList('21220');

    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toMatchObject({
      index: 0,
      title: 'Chapter 1: Good Morning, Brother',
      id: '/fiction/21220/mother-of-learning/chapter/1',
      url: 'https://www.royalroad.com/fiction/21220/mother-of-learning/chapter/1',
    });
    expect(chapters[1].index).toBe(1);
    expect(calls.filter((call) => call.endsWith('/fiction/21220'))).toHaveLength(1);
  });

  it('fetches a chapter content lazily', async () => {
    const { source } = createSource(successResponder);
    const content = await source.getChapterContent(
      '21220',
      '/fiction/21220/mother-of-learning/chapter/1',
    );
    expect(content).toContain('Zorian woke');
  });

  it('reports a clear error when Cloudflare serves a challenge page', async () => {
    const { source } = createSource(() => challenge());
    await expect(source.getPopular()).rejects.toBeInstanceOf(SourceError);
    await expect(source.getPopular()).rejects.toThrow(/blocking automated access/i);
  });

  it('reports unavailable when a listing 404s at the edge', async () => {
    const { source } = createSource((url) => {
      throw new NotFoundError({ url });
    });
    await expect(source.getPopular()).rejects.toThrow(/currently unavailable/i);
  });

  it('returns an empty page when searching without a query', async () => {
    const { source, calls } = createSource(successResponder);
    const result = await source.search({});
    expect(result.items).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
