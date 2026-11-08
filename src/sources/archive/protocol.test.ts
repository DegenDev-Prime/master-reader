import { describe, expect, it } from 'vitest';

import {
  ARCHIVE_PAGE_SIZE,
  archiveStoryId,
  avatarUrl,
  chaptersOf,
  collapseCreators,
  creatorPostsPath,
  creatorProfilePath,
  parseArchiveStoryId,
  parseCreator,
  parsePost,
  postHtml,
  postPath,
  postSubtitle,
  postUrl,
  postsFromPayload,
  postsInReadingOrder,
  thumbnailUrl,
  unwrapPostPayload,
  type ArchivePost,
} from './protocol';

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
  attachments: [{ name: 'page2.jpg', path: '/8f/cf/page2.jpg', preview_only: true }],
};

function post(id: string, overrides: Partial<ArchivePost> = {}): ArchivePost {
  return {
    id,
    creatorId: '30500811',
    service: 'patreon',
    title: `Chapter ${id}`,
    content: null,
    subtitle: null,
    published: 1_760_000_000,
    file: null,
    attachments: [],
    ...overrides,
  };
}

describe('archive creator ids', () => {
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

  it('uses the archive page size for listings', () => {
    expect(ARCHIVE_PAGE_SIZE).toBe(50);
  });
});

describe('archive paths', () => {
  it('builds creator and post routes', () => {
    expect(creatorPostsPath('patreon', '1', '/posts')).toBe('/patreon/user/1/posts');
    expect(creatorProfilePath('patreon', '1')).toBe('/patreon/user/1/profile');
    expect(postPath('patreon', '1', '2')).toBe('/patreon/user/1/post/2');
  });

  it('builds site urls', () => {
    expect(postUrl('https://example.test', 'patreon', '1', '2')).toBe(
      'https://example.test/patreon/1/post/2',
    );
    expect(avatarUrl('https://example.test', 'patreon', '1')).toBe(
      'https://example.test/icons/patreon/1',
    );
  });

  it('builds a thumbnail url only when the host and path exist', () => {
    expect(thumbnailUrl('https://img.example.test', '/a/b.jpg')).toBe(
      'https://img.example.test/data/a/b.jpg',
    );
    expect(thumbnailUrl(null, '/a/b.jpg')).toBeNull();
    expect(thumbnailUrl('https://img.example.test', null)).toBeNull();
  });
});

describe('archive payloads', () => {
  it('reads a bare array and a wrapped feed', () => {
    expect(postsFromPayload([POST])).toEqual([POST]);
    expect(postsFromPayload({ posts: [POST] })).toEqual([POST]);
    expect(postsFromPayload({ items: [POST] })).toEqual([POST]);
    expect(postsFromPayload({})).toEqual([]);
  });

  it('unwraps a single post only for the archive that wraps it', () => {
    expect(unwrapPostPayload({ post: POST }, true)).toEqual(POST);
    expect(unwrapPostPayload(POST, false)).toEqual(POST);
    expect(unwrapPostPayload({}, true)).toBeUndefined();
  });
});

describe('archive parsers', () => {
  it('reads a creator', () => {
    const creator = parseCreator(CREATOR);
    expect(creator).toMatchObject({
      id: '30500811',
      name: 'BOKABA',
      service: 'patreon',
      favorited: 2739,
      indexed: 1785423600,
    });
  });

  it('falls back to the creator id for a missing name', () => {
    expect(parseCreator({ ...CREATOR, name: '  ' })?.name).toBe('30500811');
  });

  it('rejects records without an id', () => {
    expect(parseCreator({ name: 'no id' })).toBeNull();
    expect(parsePost({ title: 'no id' })).toBeNull();
  });

  it('reads a post', () => {
    const parsed = parsePost(POST);
    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe('172633714');
    expect(parsed?.creatorId).toBe('30500811');
    expect(parsed?.title).toBe('Chapter 12');
    expect(parsed?.content).toBe('<p>Hello</p>');
    expect(parsed?.published).toBe(Math.floor(Date.parse('2026-10-17T15:26:22') / 1000));
    expect(parsed?.file?.path).toBe('/b2/88/page.jpg');
    expect(parsed?.attachments[0]).toMatchObject({
      path: '/8f/cf/page2.jpg',
      previewOnly: true,
    });
  });

  it('parses a date string into seconds', () => {
    const parsed = parsePost({ ...POST, published: '2026-10-17T15:26:22Z' });
    expect(parsed?.published).toBe(Math.floor(Date.parse('2026-10-17T15:26:22Z') / 1000));
  });

  it('keeps a missing title and date as empty values', () => {
    const parsed = parsePost({ ...POST, title: undefined, published: undefined });
    expect(parsed?.title).toBe('');
    expect(parsed?.published).toBeNull();
  });

  it('decodes entities in a title', () => {
    expect(parsePost({ ...POST, title: 'Caf&#233; &amp; Bar' })?.title).toBe('Café & Bar');
    expect(parsePost({ ...POST, title: '&#119826;&#119853;&#119838;' })?.title).toBe('𝐒𝐭𝐞');
  });
});

describe('archive listings', () => {
  it('collapses a feed to one card per creator in feed order', () => {
    const first = post('1');
    const creators = collapseCreators([
      first,
      post('2'),
      post('3', { creatorId: '999' }),
      post('4', { service: 'fanbox' }),
    ]);

    expect(creators.map((creator) => archiveStoryId(creator.service, creator.creatorId))).toEqual([
      'patreon:30500811',
      'patreon:999',
      'fanbox:30500811',
    ]);
    expect(creators[0].post).toBe(first);
  });
});

describe('archive chapters', () => {
  it('reverses the newest-first feed into reading order', () => {
    const posts = [
      post('3', { published: 300 }),
      post('2', { published: 200 }),
      post('1', { published: 100 }),
    ];

    expect(postsInReadingOrder(posts).map((item) => item.id)).toEqual(['1', '2', '3']);
  });

  it('uses the feed order as the tie-breaker for missing dates', () => {
    const posts = [post('b', { published: null }), post('a', { published: null })];

    expect(postsInReadingOrder(posts).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('numbers chapters from zero and links each post', () => {
    const chapters = chaptersOf(
      [post('2'), post('1', { title: '' })],
      'https://example.test',
      '30500811',
    );

    expect(chapters).toEqual([
      {
        id: '1',
        index: 0,
        title: '',
        url: 'https://example.test/patreon/30500811/post/1',
        publishedAt: 1_760_000_000,
      },
      {
        id: '2',
        index: 1,
        title: 'Chapter 2',
        url: 'https://example.test/patreon/30500811/post/2',
        publishedAt: 1_760_000_000,
      },
    ]);
  });
});

describe('archive post content', () => {
  it('prefers the listing subtitle and strips its markup', () => {
    expect(postSubtitle(post('1', { subtitle: '<p>Hello <b>there</b></p>' }))).toBe('Hello there');
    expect(postSubtitle(post('1', { content: '<div>From the body</div>' }))).toBe('From the body');
    expect(postSubtitle(post('1'))).toBeNull();
  });

  it('appends file and attachment images to the body', () => {
    const html = postHtml(
      {
        content: '<p>Hello</p>',
        file: { name: 'page.jpg', path: '/b2/88/page.jpg', previewOnly: false },
        attachments: [{ name: 'a "quote".jpg', path: '/8f/cf/page2.jpg', previewOnly: true }],
      },
      'https://img.example.test',
    );

    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain(
      '<img src="https://img.example.test/data/b2/88/page.jpg" alt="page.jpg"/>',
    );
    expect(html).toContain(
      '<img src="https://img.example.test/data/8f/cf/page2.jpg" alt="a quote.jpg"/>',
    );
  });

  it('omits images when the archive has no thumbnail host', () => {
    const html = postHtml(
      {
        content: '<p>Hello</p>',
        file: { name: 'page.jpg', path: '/b2/88/page.jpg', previewOnly: false },
        attachments: [],
      },
      null,
    );

    expect(html).toBe('<p>Hello</p>');
  });
});
