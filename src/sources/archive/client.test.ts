import { describe, expect, it } from 'vitest';

import { ArchiveClient } from './client';
import type { ArchiveVariant } from './protocol';

const VARIANT: ArchiveVariant = {
  apiBase: 'https://example.test/api/v1',
  siteBase: 'https://example.test',
  thumbnailBase: 'https://img.example.test/thumbnail',
  creatorPostsSuffix: '',
  wrapsPost: false,
};

const POST = {
  id: '172633714',
  user: '30500811',
  service: 'patreon',
  title: 'Chapter 12',
  content: '<p>Hello</p>',
  published: '2026-10-17T15:26:22',
  file: { name: 'page.jpg', path: '/b2/88/page.jpg' },
  attachments: [{ name: 'page2.jpg', path: '/8f/cf/page2.jpg' }],
};

describe('ArchiveClient', () => {
  it('reads a bare array of posts', async () => {
    const client = new ArchiveClient(VARIANT, async () => [POST]);
    const { posts, count } = await client.recentPosts(0);
    expect(posts).toHaveLength(1);
    expect(count).toBe(1);
  });

  it('reads a wrapped list of posts', async () => {
    const client = new ArchiveClient(VARIANT, async () => ({
      count: 50,
      true_count: 1000,
      posts: [POST],
    }));
    const { posts, count, total } = await client.recentPosts(0);
    expect(posts).toHaveLength(1);
    expect(count).toBe(50);
    expect(total).toBe(1000);
  });

  it('unwraps a single post when the archive does', async () => {
    const wrapping = new ArchiveClient({ ...VARIANT, wrapsPost: true }, async () => ({
      post: POST,
    }));
    expect((await wrapping.post('patreon', '1', '2'))?.id).toBe('172633714');
  });

  it('builds a thumbnail url', async () => {
    const client = new ArchiveClient(VARIANT, async () => []);
    expect(client.thumbnailUrl('/a/b.jpg')).toBe('https://img.example.test/thumbnail/data/a/b.jpg');
    expect(client.thumbnailUrl(null)).toBeNull();
  });

  it('uses the archive suffix for a creator post list', async () => {
    const paths: string[] = [];
    const client = new ArchiveClient({ ...VARIANT, creatorPostsSuffix: '/posts' }, async (path) => {
      paths.push(path);
      return [];
    });
    await client.creatorPosts('patreon', '1');
    expect(paths[0]).toBe('/patreon/user/1/posts');
  });
});
