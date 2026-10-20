import { describe, expect, it } from 'vitest';

import { loadTextFixture } from '@/test-utils/fixtures';
import {
  isCloudflareChallenge,
  listingToStory,
  parseChapterContent,
  parseChapterList,
  parseCount,
  parseListing,
  parseSeries,
} from './parsers';

const listing = () => loadTextFixture('listing.html', 'scribblehub');
const series = () => loadTextFixture('series.html', 'scribblehub');
const chapters = () => loadTextFixture('chapters.html', 'scribblehub');
const chapter = () => loadTextFixture('chapter.html', 'scribblehub');
const challenge = () => loadTextFixture('challenge.html', 'scribblehub');

describe('scribblehub parsers', () => {
  it('detects the bot challenge page', () => {
    expect(isCloudflareChallenge(challenge())).toBe(true);
    expect(isCloudflareChallenge(listing())).toBe(false);
  });

  it('reads a listing card', () => {
    const items = parseListing(listing());
    expect(items.length).toBeGreaterThan(0);

    const first = items[0];
    expect(first.id).toMatch(/^\d+$/);
    expect(first.title.length).toBeGreaterThan(0);
    expect(first.url).toContain('/series/');
    expect(first.coverUrl).toContain('scribblehub.com');
    expect(first.authorName).toBeTruthy();
    expect(first.rating).toBeGreaterThan(0);
  });

  it('turns a listing card into a story', () => {
    const story = listingToStory(parseListing(listing())[0]);
    expect(story.sourceId).toBe('scribblehub');
    expect(story.id).toMatch(/^\d+$/);
    expect(story.title.length).toBeGreaterThan(0);
    expect(story.tags?.length).toBeGreaterThan(0);
  });

  it('reads the series metadata', () => {
    const story = parseSeries('664073', series());

    expect(story.id).toBe('664073');
    expect(story.title).toBe('Rebirth of the Nephilim');
    expect(story.authorName).toBe('Agdistis');
    expect(story.description).toContain('Jadis has no idea how she died');
    expect(story.rating).toBe(4.8);
    expect(story.views).toBe(9_680_000);
    expect(story.votes).toBe(295_495);
    expect(story.coverUrl).toContain('scribblehub.com');
  });

  it('reads the chapter table in reading order', () => {
    const list = parseChapterList(chapters());
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].index).toBe(0);
    expect(list[0].title).toMatch(/^Chapter/);
    expect(list[0].path).toContain('/read/');
    expect(list.map((chapter) => chapter.index)).toEqual(list.map((_, index) => index));
  });

  it('reads the chapter body', () => {
    const parsed = parseChapterContent(chapter());
    expect(parsed.content).toContain('Sorcha asked');
    expect(parsed.wordCount).toBeGreaterThan(50);
  });

  it('parses abbreviated counts', () => {
    expect(parseCount('9.68M')).toBe(9_680_000);
    expect(parseCount('1,015')).toBe(1015);
    expect(parseCount('4.6k')).toBe(4600);
    expect(parseCount(null)).toBeNull();
  });
});
