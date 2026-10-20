import { describe, expect, it } from 'vitest';

import { ArchiveClient, MAX_CREATOR_POSTS, PAGE_SIZE, type ArchiveVariant } from './client';

const VARIANT: ArchiveVariant = {
  apiBase: 'https://example.test/api/v1',
  siteBase: 'https://example.test',
  thumbnailBase: 'https://img.example.test/thumbnail',
  creatorPostsSuffix: '',
  wrapsPost: false,
};

function post(id: string) {
  return { id, user: '1', service: 'patreon', title: `Post ${id}`, content: '', published: null };
}

/** A creator with `total` posts, served `PAGE_SIZE` at a time. */
function pagedCreator(total: number) {
  const offsets: number[] = [];
  const fetchJson = async (_path: string, query?: Record<string, string | number>) => {
    const offset = Number(query?.o ?? 0);
    offsets.push(offset);
    const page = Array.from({ length: Math.max(0, Math.min(PAGE_SIZE, total - offset)) }, (_, i) =>
      post(String(offset + i)),
    );
    return page;
  };
  return { fetchJson, offsets };
}

describe('ArchiveClient.creatorPosts', () => {
  it('walks every page until a short one', async () => {
    const { fetchJson, offsets } = pagedCreator(202);
    const client = new ArchiveClient(VARIANT, fetchJson);

    const posts = await client.creatorPosts('patreon', '1');

    expect(posts).toHaveLength(202);
    expect(offsets).toEqual([0, 50, 100, 150, 200]);
  });

  it('stops after one page when the creator has fewer posts', async () => {
    const { fetchJson, offsets } = pagedCreator(24);
    const client = new ArchiveClient(VARIANT, fetchJson);

    const posts = await client.creatorPosts('patreon', '1');

    expect(posts).toHaveLength(24);
    expect(offsets).toEqual([0]);
  });

  it('stops on an empty page', async () => {
    const offsets: number[] = [];
    const client = new ArchiveClient(VARIANT, async (_path, query) => {
      const offset = Number(query?.o ?? 0);
      offsets.push(offset);
      if (offset === 0) return Array.from({ length: PAGE_SIZE }, (_, i) => post(String(i)));
      return [];
    });

    const posts = await client.creatorPosts('patreon', '1');

    expect(posts).toHaveLength(PAGE_SIZE);
    expect(offsets).toEqual([0, 50]);
  });

  it('serves a second call from the cache', async () => {
    const { fetchJson, offsets } = pagedCreator(120);
    const client = new ArchiveClient(VARIANT, fetchJson);

    await client.creatorPosts('patreon', '1');
    const callsAfterFirst = offsets.length;
    const again = await client.creatorPosts('patreon', '1');

    expect(again).toHaveLength(120);
    expect(offsets.length).toBe(callsAfterFirst);
  });

  it('does not fetch past the post cap', async () => {
    const { fetchJson, offsets } = pagedCreator(10_000);
    const client = new ArchiveClient(VARIANT, fetchJson);

    const posts = await client.creatorPosts('patreon', '1', { maxPosts: 100 });

    expect(posts).toHaveLength(100);
    expect(offsets).toEqual([0, 50]);
    expect(MAX_CREATOR_POSTS).toBeGreaterThan(PAGE_SIZE);
  });

  it('drops duplicate posts across pages', async () => {
    const client = new ArchiveClient(VARIANT, async (_path, query) => {
      const offset = Number(query?.o ?? 0);
      if (offset === 0) return Array.from({ length: PAGE_SIZE }, (_, i) => post(String(i)));
      // The second page repeats the last post of the first.
      return [post(String(PAGE_SIZE - 1)), post('100')];
    });

    const posts = await client.creatorPosts('patreon', '1');

    expect(posts).toHaveLength(PAGE_SIZE + 1);
    expect(new Set(posts.map((item) => item.id)).size).toBe(posts.length);
  });
});
