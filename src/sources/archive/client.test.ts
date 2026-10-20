import { describe, expect, it } from 'vitest';

import { ArchiveClient, parseCreator, parsePost, type ArchiveVariant } from './client';
import { archiveStoryId, parseArchiveStoryId } from './source';

const VARIANT: ArchiveVariant = {
  apiBase: 'https://example.test/api/v1',
  siteBase: 'https://example.test',
  thumbnailBase: 'https://img.example.test/thumbnail',
  creatorPostsSuffix: '',
  wrapsPost: false,
};

const CREATOR = {
  id: '30500811',
  name: 'BOKABA',
  public_id: 'BOKABA',
  service: 'patreon',
  indexed: 1785423600,
  updated: 1792274400,
  favorited: 2739,
  ever_imported: true,
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

describe('archive parsers', () => {
  it('reads a creator', () => {
    const creator = parseCreator(CREATOR);
    expect(creator).not.toBeNull();
    expect(creator?.id).toBe('30500811');
    expect(creator?.name).toBe('BOKABA');
    expect(creator?.service).toBe('patreon');
    expect(creator?.favorited).toBe(2739);
    expect(creator?.indexed).toBe(1785423600);
  });

  it('rejects a record without an id', () => {
    expect(parseCreator({ name: 'no id' })).toBeNull();
    expect(parsePost({ title: 'no id' })).toBeNull();
  });

  it('reads a post', () => {
    const post = parsePost(POST);
    expect(post).not.toBeNull();
    expect(post?.id).toBe('172633714');
    expect(post?.creatorId).toBe('30500811');
    expect(post?.title).toBe('Chapter 12');
    expect(post?.content).toBe('<p>Hello</p>');
    expect(post?.published).toBe(Math.floor(Date.parse('2026-10-17T15:26:22') / 1000));
    expect(post?.file?.path).toBe('/b2/88/page.jpg');
    expect(post?.attachments).toHaveLength(1);
  });

  it('parses a date string into seconds', () => {
    const post = parsePost({ ...POST, published: '2026-10-17T15:26:22Z' });
    expect(post?.published).toBe(Math.floor(Date.parse('2026-10-17T15:26:22Z') / 1000));
  });

  it('decodes entities in a title', () => {
    const post = parsePost({ ...POST, title: 'Caf&#233; &amp; Bar' });
    expect(post?.title).toBe('Café & Bar');
  });

  it('decodes the numeric entities archives use for non-latin scripts', () => {
    const post = parsePost({ ...POST, title: '&#119826;&#119853;&#119838;' });
    expect(post?.title).toBe('𝐒𝐭𝐞');
  });
});

describe('archive story ids', () => {
  it('round-trips a service and creator id', () => {
    const id = archiveStoryId('patreon', '30500811');
    expect(id).toBe('patreon:30500811');
    expect(parseArchiveStoryId(id)).toEqual({
      service: 'patreon',
      creatorId: '30500811',
    });
  });

  it('rejects a malformed id', () => {
    expect(parseArchiveStoryId('30500811')).toBeNull();
    expect(parseArchiveStoryId(':30500811')).toBeNull();
    expect(parseArchiveStoryId('patreon:')).toBeNull();
  });
});

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
