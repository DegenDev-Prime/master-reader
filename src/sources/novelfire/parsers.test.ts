import { describe, expect, it } from 'vitest';

import { loadTextFixture } from '@/test-utils/fixtures';

import {
  parseAuthorPage,
  parseBook,
  parseChapterContent,
  parseChapterDate,
  parseChapterList,
  parseCount,
  parseLastPage,
  parseListing,
  slugFromHref,
} from './parsers';

const author = () => loadTextFixture('author.html', 'novelfire');
const listing = () => loadTextFixture('listing.html', 'novelfire');
const book = () => loadTextFixture('book.html', 'novelfire');
const chapters = () => loadTextFixture('chapters.html', 'novelfire');
const chapter = () => loadTextFixture('chapter.html', 'novelfire');

describe('slugFromHref', () => {
  it('extracts the book slug', () => {
    expect(slugFromHref('/book/shadow-slave')).toBe('shadow-slave');
    expect(slugFromHref('/book/shadow-slave/chapter-1')).toBe('shadow-slave');
  });
});

describe('parseListing', () => {
  it('maps novel cards to stories', () => {
    const result = parseListing(listing(), 1);
    expect(result.stories).toHaveLength(3);
    const first = result.stories[0];
    expect(first.sourceId).toBe('novelfire');
    expect(first.id).toBe('shadow-slave');
    expect(first.title).toBe('Shadow Slave');
    expect(first.url).toBe('https://novelfire.net/book/shadow-slave');
    expect(first.coverUrl).toBe('https://novelfire.net/server-1/shadow-slave.jpg');
    expect(first.rating).toBe(4.5);
  });

  it('detects a following page', () => {
    expect(parseListing(listing(), 1).hasNext).toBe(true);
    expect(parseListing(listing(), 2).hasNext).toBe(false);
  });

  it('returns nothing for empty markup', () => {
    expect(parseListing('<html></html>', 1).stories).toEqual([]);
  });
});

describe('parseAuthorPage', () => {
  it('maps the author name and profile cards, ignoring related novels', () => {
    const result = parseAuthorPage('guiltythree', author(), 1);

    expect(result.author).toMatchObject({
      sourceId: 'novelfire',
      id: 'guiltythree',
      name: 'Guiltythree',
      url: 'https://novelfire.net/author/guiltythree',
      avatarUrl: null,
      bio: null,
    });
    expect(result.stories.items.map((story) => story.id)).toEqual([
      'shadow-slave',
      'free-fall-pyramid-of-gold',
    ]);
    expect(result.stories.items[0].rating).toBe(4.5);
    expect(result.stories.items[0].authorId).toBe('guiltythree');
    expect(result.stories.items[0].authorName).toBe('Guiltythree');
    expect(result.stories.page).toBe(1);
    expect(result.stories.hasNext).toBe(true);
  });

  it('reports the requested page without a next page', () => {
    expect(parseAuthorPage('guiltythree', author(), 2).stories.hasNext).toBe(false);
  });
});

describe('parseBook', () => {
  it('maps metadata, rating and genres', () => {
    const details = parseBook('shadow-slave', book());
    expect(details.id).toBe('shadow-slave');
    expect(details.title).toBe('Shadow Slave');
    expect(details.authorId).toBe('guiltythree');
    expect(details.authorName).toBe('Guiltythree');
    expect(details.rating).toBe(4.5);
    expect(details.votes).toBe(830);
    expect(details.coverUrl).toBe('https://novelfire.net/server-1/shadow-slave.jpg');
    expect(details.description).toContain('Growing up in poverty');
    expect(details.categoryName).toBe('Action');
    expect(details.tags).toEqual(['Action', 'Adventure', 'Fantasy', 'Romance']);
    expect(details.status).toBe('ongoing');
    expect(details.views).toBe(74_700_000);
  });
});

describe('parseCount', () => {
  it('parses abbreviated site counts', () => {
    expect(parseCount('74.7M')).toBe(74_700_000);
    expect(parseCount('29.8K')).toBe(29_800);
    expect(parseCount('1,234')).toBe(1234);
    expect(parseCount('nope')).toBeNull();
  });
});

describe('parseChapterDate', () => {
  it('parses the chapter-list timestamp as UTC seconds', () => {
    expect(parseChapterDate('2022-06-02 14:30:56')).toBe(Date.UTC(2022, 5, 2, 14, 30, 56) / 1000);
    expect(parseChapterDate(null)).toBeNull();
  });
});

describe('parseChapterList', () => {
  it('maps and sorts chapters by number', () => {
    const list = parseChapterList(chapters(), 'shadow-slave');
    expect(list).toHaveLength(3);
    expect(list.map((entry) => entry.number)).toEqual([1, 2, 3]);
    expect(list[0].title).toBe('Chapter 1 - 1: Nightmare Begins');
    expect(list[0].publishedAt).toBe(Date.UTC(2022, 5, 2, 14, 30, 56) / 1000);
  });
});

describe('parseLastPage', () => {
  it('finds the highest linked page number', () => {
    const html = '<a href="/x?page=2">2</a><a href="/x?page=3">3</a><a href="/x?page=33">33</a>';
    expect(parseLastPage(html)).toBe(33);
  });

  it('defaults to 1 when there is no pagination', () => {
    expect(parseLastPage('<html></html>')).toBe(1);
  });
});

describe('parseChapterContent', () => {
  it('extracts the title and plain-text body', () => {
    const parsed = parseChapterContent(chapter());
    expect(parsed.title).toBe('Chapter 1 - 1: Nightmare Begins');
    expect(parsed.content).toContain('frail-looking young man');
    expect(parsed.wordCount).toBeGreaterThan(20);
  });
});
