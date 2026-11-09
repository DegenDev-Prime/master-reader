import { describe, expect, it } from 'vitest';

import {
  parseAuthorPage,
  parseChapterContent,
  parseChapters,
  parseListItem,
  parseTitle,
} from '@/sources/novelbuddy/parsers';
import type {
  NovelBuddyChapter,
  NovelBuddyListItem,
  NovelBuddyTitle,
} from '@/sources/novelbuddy/client';
import { loadTextFixture } from '@/test-utils/fixtures';

const LIST_ITEM: NovelBuddyListItem = {
  id: 'VYPGVZ8z',
  url: '/shadow-slave',
  name: 'Shadow Slave',
  cover: 'https://rs.novelbuddy.me/covers/shadow-slave.png',
  status: 'ongoing',
  rating: 4.8,
  summary: '<p>Growing up in poverty, Sunny never expected anything good.</p>',
  stats: { views: 27486342, ratings_count: 42, chapters_count: 3218 },
  genres: [{ name: 'Fantasy' }, { name: 'Action' }],
  authors: [{ name: 'Guiltythree', slug: 'guiltythree' }],
};

const TITLE: NovelBuddyTitle = {
  id: 'VYPGVZ8z',
  url: '/shadow-slave',
  name: 'Shadow Slave',
  cover: 'https://rs.novelbuddy.me/covers/shadow-slave.png',
  summary: '<p>Growing up in poverty.</p><br />A second line.',
  status: 'OnGoing',
  rating: 4.8,
  stats: { views: 27486342, ratings_count: 42, chapters_count: 3218 },
  genres: [{ name: 'Fantasy' }],
  tags: [{ name: 'Magic' }],
  authors: [{ name: 'Guiltythree', slug: 'guiltythree' }],
};

describe('novelbuddy parsers', () => {
  it('parses a listing item', () => {
    const story = parseListItem(LIST_ITEM);

    expect(story.sourceId).toBe('novelbuddy');
    expect(story.id).toBe('VYPGVZ8z');
    expect(story.title).toBe('Shadow Slave');
    expect(story.authorId).toBe('guiltythree');
    expect(story.coverUrl).toBe('https://rs.novelbuddy.me/covers/shadow-slave.png');
    expect(story.rating).toBe(4.8);
    expect(story.views).toBe(27486342);
    expect(story.tags).toEqual(['Fantasy', 'Action']);
    expect(story.description).toBe('Growing up in poverty, Sunny never expected anything good.');
    expect(story.url).toBe('https://novelbuddy.me/shadow-slave');
  });

  it('parses a title with its author and tags', () => {
    const story = parseTitle(TITLE);

    expect(story.authorId).toBe('guiltythree');
    expect(story.authorName).toBe('Guiltythree');
    expect(story.tags).toEqual(['Fantasy', 'Magic']);
    expect(story.description).toBe('Growing up in poverty.\n\nA second line.');
  });

  it('orders chapters ascending by number', () => {
    const chapters: NovelBuddyChapter[] = [
      { id: 'c3', name: 'Chapter 3', url: '/s/chapter-3', number: 3 },
      { id: 'c1', name: 'Chapter 1', url: '/s/chapter-1', number: 1 },
      { id: 'c2', name: 'Chapter 2', url: '/s/chapter-2', number: 2 },
    ];

    expect(parseChapters(chapters).map((chapter) => chapter.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('drops duplicate chapters', () => {
    const chapters: NovelBuddyChapter[] = [
      { id: 'c1', name: 'Chapter 1', url: '/s/chapter-1', number: 1 },
      { id: 'c1', name: 'Chapter 1 again', url: '/s/chapter-1', number: 1 },
    ];

    expect(parseChapters(chapters)).toHaveLength(1);
  });

  it('keeps chapters without a number at the end', () => {
    const chapters: NovelBuddyChapter[] = [
      { id: 'extra', name: 'Extra', url: '/s/extra' },
      { id: 'c1', name: 'Chapter 1', url: '/s/chapter-1', number: 1 },
    ];

    expect(parseChapters(chapters).map((chapter) => chapter.id)).toEqual(['c1', 'extra']);
  });

  it('parses chapter content without the preamble', () => {
    const parsed = parseChapterContent({
      id: 'c1',
      name: 'Chapter 1',
      url: '/s/c1',
      content: '<p>My Novel</p><p>Author: Someone</p><p>Main text</p><p>The body.</p>',
    });

    expect(parsed.content).toBe('<p>The body.</p>');
    expect(parsed.wordCount).toBeGreaterThan(0);
  });

  it('parses an author page from the embedded Next data', () => {
    const page = parseAuthorPage(loadTextFixture('author-page.html', 'novelbuddy'));

    expect(page?.author).toMatchObject({
      sourceId: 'novelbuddy',
      id: 'guiltythree',
      name: 'Guiltythree',
      url: 'https://novelbuddy.me/authors/guiltythree',
      avatarUrl: null,
      bio: null,
      worksCount: 2,
    });
    expect(page?.stories.page).toBe(1);
    expect(page?.stories.hasNext).toBe(false);
    expect(page?.stories.total).toBe(2);
    expect(page?.stories.items.map((story) => story.id)).toEqual(['VYPGVZ8z', 'PDml36YE']);
    expect(page?.stories.items[0]).toMatchObject({
      authorId: 'guiltythree',
      authorName: 'Guiltythree',
      rating: 4.81,
      views: 27981548,
      tags: ['Fantasy', 'Action'],
    });
  });

  it('falls back to a humanized slug when og:title is missing', () => {
    const html =
      '<script id="__NEXT_DATA__" type="application/json">' +
      '{"props":{"pageProps":{"slug":"guilty-three"}}}' +
      '</script>';

    const page = parseAuthorPage(html, 'other');
    expect(page?.author.id).toBe('guilty-three');
    expect(page?.author.name).toBe('Guilty Three');
    expect(page?.stories.items).toEqual([]);
  });

  it('returns null when the page carries no Next data', () => {
    expect(parseAuthorPage('<html></html>', 'guiltythree')).toBeNull();
  });
});
