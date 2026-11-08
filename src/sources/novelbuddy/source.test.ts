import { describe, expect, it } from 'vitest';

import { HttpClient } from '../transport';
import { NovelBuddySource } from './index';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const TITLE = {
  id: 'VYPGVZ8z',
  url: '/shadow-slave',
  name: 'Shadow Slave',
  summary: '<p>Growing up in poverty.</p>',
  status: 'OnGoing',
  rating: 4.8,
  cover: 'https://rs.novelbuddy.me/covers/shadow-slave.png',
  authors: [{ name: 'Guiltythree' }],
  genres: [{ name: 'Fantasy' }],
  stats: { views: 27486342, chapters_count: 3218, ratings_count: 42 },
};

const LIST_ITEM = {
  id: 'VYPGVZ8z',
  url: '/shadow-slave',
  name: 'Shadow Slave',
  cover: 'https://rs.novelbuddy.me/covers/shadow-slave.png',
  rating: 4.8,
  summary: '<p>Growing up in poverty.</p>',
  genres: [{ name: 'Fantasy' }],
};

function createSource(responder: (url: string) => Response) {
  const calls: string[] = [];
  const http = new HttpClient({
    baseUrl: 'https://api.novelbuddy.me',
    userAgent: 'test',
    fetch: async (url) => {
      calls.push(url);
      return responder(url);
    },
  });
  return { source: new NovelBuddySource({ http }), calls };
}

describe('NovelBuddySource', () => {
  it('advertises its capabilities', () => {
    const { source } = createSource(() => jsonResponse({}));
    expect(source.info.id).toBe('novelbuddy');
    expect(source.info.capabilities).toContain('popular');
    expect(source.isLoggedIn()).toBe(false);
  });

  it('unwraps the API envelope for the latest listing', async () => {
    const { source } = createSource(() =>
      jsonResponse({
        success: true,
        data: {
          latest: {
            items: [LIST_ITEM],
            pagination: { total: 1, page: 1, limit: 24, total_pages: 1, has_next: false },
          },
          popular: [LIST_ITEM],
          trending: [],
        },
      }),
    );

    const result = await source.getLatest();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Shadow Slave');
    expect(result.hasNext).toBe(false);
  });

  it('does not walk past the home snapshot', async () => {
    const { source, calls } = createSource(() => jsonResponse({}));

    const latest = await source.getLatest({ page: 2 });
    const popular = await source.getPopular({ page: 2 });

    expect(latest).toEqual({ items: [], page: 2, hasNext: false, total: 0 });
    expect(popular).toEqual({ items: [], page: 2, hasNext: false, total: 0 });
    expect(calls).toHaveLength(0);
  });

  it('stops popular pagination after its single block', async () => {
    const { source } = createSource(() =>
      jsonResponse({
        success: true,
        data: { latest: { items: [], pagination: {} }, popular: [LIST_ITEM], trending: [] },
      }),
    );

    const result = await source.getPopular();
    expect(result.items).toHaveLength(1);
    expect(result.hasNext).toBe(false);
  });

  it('unwraps the API envelope for the title', async () => {
    const { source } = createSource(() => jsonResponse({ success: true, data: { title: TITLE } }));

    const story = await source.getStory('VYPGVZ8z', { includeContent: false });
    expect(story?.title).toBe('Shadow Slave');
    expect(story?.authorName).toBe('Guiltythree');
  });

  it('returns metadata without fabricating chapter stubs', async () => {
    const { source, calls } = createSource((url) => {
      if (url.includes('/chapters')) throw new Error(`unexpected chapter request: ${url}`);
      return jsonResponse({ success: true, data: { title: TITLE } });
    });

    const story = await source.getStory('VYPGVZ8z');

    expect(story?.pages).toBeUndefined();
    expect(calls).toEqual(['https://api.novelbuddy.me/titles/VYPGVZ8z']);
  });

  it('unwraps the API envelope for the chapter list', async () => {
    const { source } = createSource((url) => {
      if (url.includes('/chapters')) {
        return jsonResponse({
          success: true,
          data: {
            chapters: [
              { id: 'c2', name: 'Chapter 2', url: '/s/chapter-2', number: 2 },
              { id: 'c1', name: 'Chapter 1', url: '/s/chapter-1', number: 1 },
            ],
          },
        });
      }
      return jsonResponse({ success: true, data: { title: TITLE } });
    });

    const list = await source.getChapterList('VYPGVZ8z');
    expect(list.map((chapter) => chapter.id)).toEqual(['c1', 'c2']);
    expect(list[0].index).toBe(0);
  });

  it('unwraps the API envelope for chapter content', async () => {
    const { source } = createSource(() =>
      jsonResponse({
        success: true,
        data: { chapter: { id: 'c1', name: 'Chapter 1', url: '/s/c1', content: '<p>Body</p>' } },
      }),
    );

    const content = await source.getChapterContent('VYPGVZ8z', 'c1');
    expect(content).toBe('<p>Body</p>');
  });

  it('searches through the API envelope', async () => {
    const { source, calls } = createSource(() =>
      jsonResponse({
        success: true,
        data: {
          items: [LIST_ITEM],
          pagination: { total: 1, page: 1, limit: 24, total_pages: 1, has_next: false },
        },
      }),
    );

    const result = await source.search({ query: 'shadow' });
    expect(result.items).toHaveLength(1);
    expect(calls[0]).toContain('q=shadow');
    expect(calls[0]).not.toContain('query=shadow');
  });
});
