import { describe, expect, it } from 'vitest';

import { HttpClient } from '../transport';
import { KemonoSource } from './kemono';

const CREATOR = {
  id: '90822862',
  name: 'Rehab Room',
  public_id: 'Rehab Room',
  service: 'patreon',
  indexed: 1780000000,
  updated: 1792274400,
  favorited: 120,
};

const POST = {
  id: '147648418',
  user: '90822862',
  service: 'patreon',
  title: 'Chapter 1',
  content: '<p>Hello</p>',
  published: '2026-01-07T17:20:52',
  file: { name: 'page.jpg', path: '/e5/01/page.jpg' },
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
    baseUrl: 'https://kemono.cr/api/v1',
    userAgent: 'test',
    fetch: async (url) => {
      calls.push(url);
      return responder(url);
    },
  });
  return { source: new KemonoSource({ http }), calls };
}

describe('KemonoSource', () => {
  it('advertises its capabilities', () => {
    const { source } = createSource(() => jsonResponse([]));
    expect(source.info.id).toBe('kemono');
    expect(source.info.capabilities).toContain('popular');
  });

  it('reads the recent-post feed', async () => {
    const { source } = createSource(() =>
      jsonResponse({ count: 50, true_count: 100, posts: [POST] }),
    );
    const result = await source.getLatest();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('patreon:90822862');
    expect(result.total).toBe(100);
  });

  it('requests a creator post list with the /posts suffix', async () => {
    const { source, calls } = createSource(() => jsonResponse([POST]));
    await source.getChapterList('patreon:90822862');
    expect(calls[0]).toContain('/patreon/user/90822862/posts');
  });

  it('unwraps a single post', async () => {
    const { source } = createSource((url) =>
      url.includes('/post/') ? jsonResponse({ post: POST }) : jsonResponse([POST]),
    );
    const content = await source.getChapterContent('patreon:90822862', '147648418');
    expect(content).toContain('<p>Hello</p>');
  });

  it('reads a creator profile', async () => {
    const { source } = createSource((url) =>
      url.includes('/profile') ? jsonResponse(CREATOR) : jsonResponse([POST]),
    );
    const story = await source.getStory('patreon:90822862');
    expect(story?.title).toBe('Rehab Room');
  });
});
