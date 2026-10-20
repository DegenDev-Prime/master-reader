import { describe, expect, it } from 'vitest';

import {
  parseChapterContent,
  parseChapters,
  parseListItem,
  parseTitle,
  stripFrontMatter,
} from '@/sources/novelbuddy/parsers';
import type {
  NovelBuddyChapter,
  NovelBuddyListItem,
  NovelBuddyTitle,
} from '@/sources/novelbuddy/client';

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
  authors: [{ name: 'Guiltythree' }],
};

describe('novelbuddy parsers', () => {
  it('parses a listing item', () => {
    const story = parseListItem(LIST_ITEM);

    expect(story.sourceId).toBe('novelbuddy');
    expect(story.id).toBe('VYPGVZ8z');
    expect(story.title).toBe('Shadow Slave');
    expect(story.coverUrl).toBe('https://rs.novelbuddy.me/covers/shadow-slave.png');
    expect(story.rating).toBe(4.8);
    expect(story.views).toBe(27486342);
    expect(story.tags).toEqual(['Fantasy', 'Action']);
    expect(story.description).toBe('Growing up in poverty, Sunny never expected anything good.');
    expect(story.url).toBe('https://novelbuddy.me/shadow-slave');
  });

  it('parses a title with its author and tags', () => {
    const story = parseTitle(TITLE);

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
});
