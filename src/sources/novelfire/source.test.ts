import { describe, expect, it } from 'vitest';

import { loadTextFixture } from '@/test-utils/fixtures';
import { HttpClient, type FetchLike } from '../transport';
import { NovelFireSource } from './index';

const listing = () => loadTextFixture('listing.html', 'novelfire');
const book = () => loadTextFixture('book.html', 'novelfire');
const chapters = () => loadTextFixture('chapters.html', 'novelfire');
const chapter = () => loadTextFixture('chapter.html', 'novelfire');

const routes: Record<string, () => string> = {
  '/book/shadow-slave/chapters': chapters,
  '/book/shadow-slave/chapter-': chapter,
  '/book/shadow-slave': book,
  '/genre-all/sort-new': listing,
  '/genre-all/sort-popular': listing,
  '/genre-fantasy': listing,
  '/search': listing,
};

function createSource(fetchImpl?: FetchLike) {
  const calls: string[] = [];
  const fetch: FetchLike =
    fetchImpl ??
    (async (url) => {
      calls.push(url);
      for (const [needle, responder] of Object.entries(routes)) {
        if (url.includes(needle)) {
          return new Response(responder(), {
            status: 200,
            headers: { 'content-type': 'text/html' },
          });
        }
      }
      return new Response('not found', { status: 404 });
    });

  const http = new HttpClient({
    baseUrl: 'https://novelfire.net',
    userAgent: 'test',
    fetch,
    retries: 0,
    sleep: async () => {},
  });

  return { source: new NovelFireSource({ http }), calls };
}

describe('NovelFireSource', () => {
  it('advertises its capabilities', () => {
    const { source } = createSource();
    expect(source.info.id).toBe('novelfire');
    expect(source.info.capabilities).toEqual(
      expect.arrayContaining(['popular', 'latest', 'search', 'categories']),
    );
    expect(source.isLoggedIn()).toBe(false);
  });

  it('maps the popular listing', async () => {
    const { source, calls } = createSource();
    const result = await source.getPopular();
    expect(result.items).toHaveLength(3);
    expect(result.items[0].title).toBe('Shadow Slave');
    expect(calls[0]).toContain('/genre-all/sort-popular');
  });

  it('maps the latest listing', async () => {
    const { source, calls } = createSource();
    await source.getLatest({ page: 2 });
    expect(calls[0]).toContain('/genre-all/sort-new');
    expect(calls[0]).toContain('page=2');
  });

  it('browses a genre when a category is supplied', async () => {
    const { source, calls } = createSource();
    await source.getPopular({ category: 'fantasy' });
    expect(calls[0]).toContain('/genre-fantasy/sort-popular');
  });

  it('searches by keyword', async () => {
    const { source, calls } = createSource();
    const result = await source.search({ query: 'shadow' });
    expect(result.items).toHaveLength(3);
    expect(calls[0]).toContain('/search');
    expect(calls[0]).toContain('keyword=shadow');
  });

  it('returns an empty page when searching without a query', async () => {
    const { source, calls } = createSource();
    const result = await source.search({});
    expect(result.items).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('maps a genre search without a query', async () => {
    const { source, calls } = createSource();
    const result = await source.search({ categories: ['fantasy'] });
    expect(result.items).toHaveLength(3);
    expect(calls[0]).toContain('/genre-fantasy');
  });

  it('returns chapter stubs without content', async () => {
    const { source } = createSource();
    const details = await source.getStory('shadow-slave');

    expect(details?.title).toBe('Shadow Slave');
    expect(details?.authorName).toBe('Guiltythree');
    expect(details?.rating).toBe(4.5);
    expect(details?.pages).toHaveLength(3);
    expect(details?.pages?.[0]).toMatchObject({
      index: 0,
      title: 'Chapter 1 - 1: Nightmare Begins',
      id: '1',
      content: null,
    });

    const metaOnly = await source.getStory('shadow-slave', { includeContent: false });
    expect(metaOnly?.pages).toBeUndefined();
  });

  it('lists every chapter across the chapter-list pages', async () => {
    const { source } = createSource();
    const list = await source.getChapterList('shadow-slave');
    expect(list.map((chapter) => chapter.id)).toEqual(['1', '2', '3']);
    expect(list[0].url).toContain('/book/shadow-slave/chapter-1');
  });

  it('fetches a chapter content lazily', async () => {
    const { source } = createSource();
    const content = await source.getChapterContent('shadow-slave', '1');
    expect(content).toContain('frail-looking young man');
  });

  it('retries once when a chapter comes back without content', async () => {
    let chapterCalls = 0;
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes('/book/shadow-slave/chapter-1')) {
        chapterCalls += 1;
        const body =
          chapterCalls === 1
            ? '<html><body><h1>Chapter 1</h1><div id="content"></div></body></html>'
            : chapter();
        return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      return new Response('not found', { status: 404 });
    };
    const { source } = createSource(fetchImpl);

    const content = await source.getChapterContent('shadow-slave', '1');
    expect(chapterCalls).toBe(2);
    expect(content).toContain('frail-looking young man');
  });

  it('follows the mirror interstitial to the mirror domain', async () => {
    const interstitial =
      '<html><head><title>Loading...</title></head><body>' +
      '<script>window.location.href = "https:\\/\\/novelphoenix.com\\/novel\\/shadow-slave\\/chapter-1";</script>' +
      '</body></html>';
    let mirrorCalls = 0;
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes('novelfire.net')) {
        return new Response(interstitial, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      if (url.includes('novelphoenix.com')) {
        mirrorCalls += 1;
        return new Response(chapter(), { status: 200, headers: { 'content-type': 'text/html' } });
      }
      return new Response('not found', { status: 404 });
    };
    const { source } = createSource(fetchImpl);

    const content = await source.getChapterContent('shadow-slave', '1');
    expect(mirrorCalls).toBe(1);
    expect(content).toContain('frail-looking young man');
  });

  it('does not refetch a mirror mention inside a real chapter', async () => {
    const mentionsMirror =
      '<html><body><div id="content"><p>novelphoenix.com has nothing on this.</p></div></body></html>';
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes('novelfire.net')) {
        return new Response(mentionsMirror, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      return new Response('not found', { status: 404 });
    };
    const { source } = createSource(fetchImpl);

    const content = await source.getChapterContent('shadow-slave', '1');
    expect(content).toContain('nothing on this');
  });

  it('lists genres and reports no tags', async () => {
    const { source } = createSource();
    await expect(source.getTags()).resolves.toEqual([]);
    const categories = await source.getCategories();
    expect(categories.length).toBeGreaterThan(10);
    expect(categories).toContainEqual({ id: 'fantasy', name: 'Fantasy' });
  });
});
