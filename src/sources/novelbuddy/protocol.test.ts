import { describe, expect, it } from 'vitest';

import {
  chapterPath,
  chaptersPath,
  homePageAvailable,
  orderChapters,
  searchQuery,
  siteUrl,
  stripFrontMatter,
  titlePath,
} from './protocol';

describe('novelbuddy protocol', () => {
  it('builds the opaque-id API paths', () => {
    expect(titlePath('VYPGVZ8z')).toBe('/titles/VYPGVZ8z');
    expect(chaptersPath('VYPGVZ8z')).toBe('/titles/VYPGVZ8z/chapters');
    expect(chapterPath('VYPGVZ8z', '8nKabolY')).toBe('/titles/VYPGVZ8z/chapters/8nKabolY');
  });

  it('treats the home blocks as a single page', () => {
    expect(homePageAvailable(1)).toBe(true);
    expect(homePageAvailable(2)).toBe(false);
  });

  it('uses the q parameter search actually reads', () => {
    expect(searchQuery('shadow slave', 2, 24)).toEqual({
      q: 'shadow slave',
      page: 2,
      limit: 24,
    });
    expect(searchQuery('shadow', 1, 24, { sort: 'rating', genres: ['fantasy', 'action'] })).toEqual(
      {
        q: 'shadow',
        page: 1,
        limit: 24,
        sort: 'rating',
        genres: 'fantasy,action',
      },
    );
  });

  it('resolves relative site paths against the web host', () => {
    expect(siteUrl('/shadow-slave')).toBe('https://novelbuddy.me/shadow-slave');
    expect(siteUrl('https://rs.novelbuddy.me/cover.webp')).toBe(
      'https://rs.novelbuddy.me/cover.webp',
    );
    expect(siteUrl(null)).toBeNull();
  });

  it('orders chapters ascending, dedupes by id and keeps unnumbered last', () => {
    const chapters = [
      { id: 'c3', number: 3 },
      { id: 'extra' },
      { id: 'c1', number: 1 },
      { id: 'c2', number: 2 },
      { id: 'c1', number: 1 },
    ];

    expect(orderChapters(chapters).map((chapter) => chapter.id)).toEqual([
      'c1',
      'c2',
      'c3',
      'extra',
    ]);
  });

  it('strips the machine-translation preamble', () => {
    const html =
      '<div></div><p>My Novel</p><p>Author: Someone</p><p>Summary:</p><p>A short summary.</p>' +
      '<p>Main text</p><p></p><p>Chapter 1 The Start</p><p>The body.</p>';

    const stripped = stripFrontMatter(html);
    expect(stripped).toContain('Chapter 1 The Start');
    expect(stripped).not.toContain('Author: Someone');
    expect(stripped).not.toContain('Main text');
  });

  it('keeps ordinary chapters untouched', () => {
    const html = '<p>Chapter 1</p><p>The body.</p>';
    expect(stripFrontMatter(html)).toBe(html);
  });
});
