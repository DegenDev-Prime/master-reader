import { describe, expect, it } from 'vitest';

import { loadTextFixture } from '@/test-utils/fixtures';
import {
  authorSeriesToStory,
  listingToStory,
  parseAuthor,
  parseAuthorSeries,
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
const author = () => loadTextFixture('author.html', 'scribblehub');

describe('scribblehub parsers', () => {
  it('reads a listing card', () => {
    const items = parseListing(listing());
    expect(items.length).toBeGreaterThan(0);

    const first = items[0];
    expect(first.id).toMatch(/^\d+$/);
    expect(first.title.length).toBeGreaterThan(0);
    expect(first.url).toContain('/series/');
    expect(first.coverUrl).toContain('scribblehub.com');
    expect(first.authorId).toBe('263989');
    expect(first.authorName).toBeTruthy();
    expect(first.rating).toBeGreaterThan(0);
  });

  it('turns a listing card into a story', () => {
    const story = listingToStory(parseListing(listing())[0]);
    expect(story.sourceId).toBe('scribblehub');
    expect(story.id).toMatch(/^\d+$/);
    expect(story.authorId).toBe('263989');
    expect(story.title.length).toBeGreaterThan(0);
    expect(story.tags?.length).toBeGreaterThan(0);
  });

  it('reads the series metadata', () => {
    const story = parseSeries('664073-rebirth-of-the-nephilim', series());

    expect(story.id).toBe('664073');
    expect(story.title).toBe('Rebirth of the Nephilim');
    expect(story.authorId).toBe('109960');
    expect(story.authorName).toBe('Agdistis');
    expect(story.description).toContain('Jadis has no idea how she died');
    expect(story.rating).toBe(4.8);
    expect(story.views).toBe(9_680_000);
    expect(story.votes).toBe(295_495);
    expect(story.coverUrl).toContain('scribblehub.com');
    expect(story.url).toBe('https://www.scribblehub.com/series/664073/');
  });

  it('reads the chapter table in reading order', () => {
    const list = parseChapterList(chapters());
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].index).toBe(0);
    expect(list[0].title).toMatch(/^Chapter/);
    expect(list[0].id).toMatch(/^\d+$/);
    expect(list[0].publishedAt).toBeGreaterThan(0);
    expect(list.map((chapter) => chapter.index)).toEqual(list.map((_, index) => index));
  });

  it('reads the chapter body', () => {
    const parsed = parseChapterContent(chapter());
    expect(parsed.content).toContain('Sorcha asked');
    expect(parsed.wordCount).toBeGreaterThan(50);
  });

  it('reads an author profile and their series', () => {
    const parsed = parseAuthor('109960', author());
    expect(parsed.id).toBe('109960');
    expect(parsed.name).toBe('Agdistis');
    expect(parsed.bio).toContain('fantasy and science fiction');
    expect(parsed.avatarUrl).toContain('avatar');
    expect(parsed.followers).toBe(4321);
    expect(parsed.worksCount).toBe(3);
    expect(parsed.wordCount).toBe(1_234_567);

    const series = parseAuthorSeries(author());
    expect(series.map((item) => item.id)).toEqual(['664073', '664074', '664075']);
    expect(series[0].title).toBe('Rebirth of the Nephilim');
    expect(series[0].url).toBe(
      'https://www.scribblehub.com/series/664073/rebirth-of-the-nephilim/',
    );

    const story = authorSeriesToStory(series[0], parsed);
    expect(story.sourceId).toBe('scribblehub');
    expect(story.authorId).toBe('109960');
    expect(story.authorName).toBe('Agdistis');
  });

  it('returns no works when the profile has no series links', () => {
    expect(parseAuthorSeries('<html><body>Nothing here</body></html>')).toEqual([]);
    expect(
      parseAuthorSeries(
        '<div class="user_bio_profile"></div><div class="profile_comments"><a href="https://www.scribblehub.com/series/999999/someone-elses-story/">Somebody Else</a></div>',
      ),
    ).toEqual([]);
    expect(parseAuthor('123', '<html></html>').name).toBe('123');
  });

  it('parses abbreviated counts', () => {
    expect(parseCount('9.68M')).toBe(9_680_000);
    expect(parseCount('1,015')).toBe(1015);
    expect(parseCount('4.6k')).toBe(4600);
    expect(parseCount(null)).toBeNull();
  });
});
