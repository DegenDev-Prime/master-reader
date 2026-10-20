import { describe, expect, it } from 'vitest';

import { loadTextFixture } from '@/test-utils/fixtures';

import {
  parseBook,
  parseChapterContent,
  parseChapterList,
  parseLastPage,
  parseListing,
  slugFromHref,
} from './parsers';

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

describe('parseBook', () => {
  it('maps metadata, rating and genres', () => {
    const details = parseBook('shadow-slave', book());
    expect(details.id).toBe('shadow-slave');
    expect(details.title).toBe('Shadow Slave');
    expect(details.authorName).toBe('Guiltythree');
    expect(details.rating).toBe(4.5);
    expect(details.votes).toBe(830);
    expect(details.coverUrl).toBe('https://novelfire.net/server-1/shadow-slave.jpg');
    expect(details.description).toContain('Growing up in poverty');
    expect(details.categoryName).toBe('Action');
    expect(details.tags).toEqual(['Action', 'Adventure', 'Fantasy', 'Romance']);
  });
});

describe('parseChapterList', () => {
  it('maps and sorts chapters by number', () => {
    const list = parseChapterList(chapters(), 'shadow-slave');
    expect(list).toHaveLength(3);
    expect(list.map((entry) => entry.number)).toEqual([1, 2, 3]);
    expect(list[0].title).toBe('Chapter 1 - 1: Nightmare Begins');
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
