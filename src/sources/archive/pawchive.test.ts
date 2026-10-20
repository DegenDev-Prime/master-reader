import { describe, expect, it } from 'vitest';

import { HttpClient } from '../transport';
import { PawchiveSource } from './pawchive';

const CREATOR = {
  id: '30500811',
  name: 'BOKABA',
  public_id: 'BOKABA',
  service: 'patreon',
  indexed: 1785423600,
  updated: 1792274400,
  favorited: 2739,
};

const POST = {
  id: '172633714',
  user: '30500811',
  service: 'patreon',
  title: 'Chapter 12',
  content: '<p>Hello</p>',
  published: '2026-10-17T15:26:22',
  file: { name: 'page.jpg', path: '/b2/88/page.jpg' },
  attachments: [],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function createSource(responder: (url: string) => Response) {
  const calls: string[] = [];
  const http = new HttpClient({
    baseUrl: 'https://pawchive.pw/api/v1',
    userAgent: 'test',
    fetch: async (url) => {
      calls.push(url);
      return responder(url);
    },
  });
  return { source: new PawchiveSource({ http }), calls };
}

describe('PawchiveSource', () => {
  it('advertises its capabilities', () => {
    const { source } = createSource(() => jsonResponse([]));
    expect(source.info.id).toBe('pawchive');
    expect(source.info.capabilities).toContain('popular');
    expect(source.isLoggedIn()).toBe(false);
  });

  it('collapses a post feed into one story per creator', async () => {
    const { source } = createSource(() =>
      jsonResponse([
        POST,
        { ...POST, id: '172633715', title: 'Chapter 13' },
        { ...POST, id: '172633716', user: '999', title: 'Other' },
      ]),
    );

    const result = await source.getLatest();
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('patreon:30500811');
    expect(result.items[1].id).toBe('patreon:999');
  });

  it('searches the post feed', async () => {
    const { source, calls } = createSource(() => jsonResponse([POST]));
    const result = await source.search({ query: 'chapter' });
    expect(result.items).toHaveLength(1);
    expect(calls[0]).toContain('q=chapter');
  });

  it('returns nothing for an empty search', async () => {
    const { source, calls } = createSource(() => jsonResponse([POST]));
    const result = await source.search({});
    expect(result.items).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('reads a creator with its posts', async () => {
    const { source } = createSource((url) =>
      url.includes('/profile') ? jsonResponse(CREATOR) : jsonResponse([POST]),
    );

    const story = await source.getStory('patreon:30500811');
    expect(story?.title).toBe('BOKABA');
    expect(story?.sourceId).toBe('pawchive');
    expect(story?.pages).toHaveLength(1);
  });

  it('walks every page of a creator post list', async () => {
    // 120 posts: two full pages of 50 and a last page of 20.
    const page = (offset: number) => {
      const size = Math.max(0, Math.min(50, 120 - offset));
      return Array.from({ length: size }, (_, index) => ({
        ...POST,
        id: String(offset + index),
        title: `Post ${offset + index}`,
      }));
    };

    const { source, calls } = createSource((url) => {
      if (url.includes('/profile')) return jsonResponse(CREATOR);
      const offset = Number(/[?&]o=(\d+)/.exec(url)?.[1] ?? 0);
      return jsonResponse(page(offset));
    });

    const list = await source.getChapterList('patreon:30500811');
    expect(list).toHaveLength(120);
    // The last page is short, so the walk stops without a fourth request.
    expect(calls.filter((url) => url.includes('o=')).length).toBe(3);
  });

  it('lists a creator posts in the same order as its story pages', async () => {
    const { source } = createSource((url) =>
      url.includes('/profile') ? jsonResponse(CREATOR) : jsonResponse([POST]),
    );

    const story = await source.getStory('patreon:30500811');
    const list = await source.getChapterList('patreon:30500811');

    expect(list.map((chapter) => chapter.id)).toEqual(story?.pages?.map((page) => page.id) ?? []);
  });

  it('lists a creator posts in reading order', async () => {
    const { source } = createSource((url) =>
      url.includes('/profile')
        ? jsonResponse(CREATOR)
        : jsonResponse([
            POST,
            {
              ...POST,
              id: '100',
              title: 'Chapter 1',
              published: '2026-01-01T00:00:00',
            },
          ]),
    );

    const list = await source.getChapterList('patreon:30500811');
    expect(list.map((chapter) => chapter.id)).toEqual(['100', '172633714']);
    expect(list[0].index).toBe(0);
  });

  it('builds a chapter body with the post images', async () => {
    const { source } = createSource((url) =>
      url.includes('/post/') ? jsonResponse(POST) : jsonResponse([POST]),
    );

    const content = await source.getChapterContent('patreon:30500811', '172633714');
    expect(content).toContain('<p>Hello</p>');
    expect(content).toContain('img.pawchive.pw/thumbnail/data/b2/88/page.jpg');
  });

  it('rejects a malformed story id', async () => {
    const { source, calls } = createSource(() => jsonResponse([]));
    expect(await source.getStory('30500811')).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
