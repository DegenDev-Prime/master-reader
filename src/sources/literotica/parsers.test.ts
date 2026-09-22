import { describe, expect, it } from 'vitest';

import { loadFixture } from '@/test-utils/fixtures';
import { ParseError } from '../transport';
import {
  decodeHtmlEntities,
  humanizeCategorySlug,
  normalizeStoryUrl,
  parseConstants,
  parsePublishedAt,
  parseStoryDetails,
  parseTagList,
  parseV1List,
  parseV3List,
  parseV3Story,
  parseV3TagStories,
  splitIntoPages,
  toBoolean,
  toNumber,
} from './parsers';

const SOURCE = 'literotica';

describe('scalar helpers', () => {
  it('normalises booleans from mixed representations', () => {
    expect(toBoolean('yes')).toBe(true);
    expect(toBoolean('no')).toBe(false);
    expect(toBoolean(0)).toBe(false);
    expect(toBoolean(3)).toBe(true);
    expect(toBoolean('maybe')).toBeNull();
    expect(toBoolean('')).toBeNull();
  });

  it('normalises numbers', () => {
    expect(toNumber('4.2')).toBe(4.2);
    expect(toNumber(5)).toBe(5);
    expect(toNumber('')).toBeNull();
    expect(toNumber('nope')).toBeNull();
  });

  it('parses dates from slash dates, seconds and milliseconds', () => {
    expect(parsePublishedAt('01/02/2021')).toBe(Date.UTC(2021, 0, 2) / 1000);
    expect(parsePublishedAt(1600000000)).toBe(1600000000);
    expect(parsePublishedAt(1600000000000)).toBe(1600000000);
  });

  it('normalises story urls', () => {
    expect(normalizeStoryUrl('the-long-road')).toBe('https://www.literotica.com/s/the-long-road');
    expect(normalizeStoryUrl('https://x.test/y')).toBe('https://x.test/y');
  });

  it('decodes html entities and leaves unknown ones intact', () => {
    expect(decodeHtmlEntities('a &amp; b &#39;c&#x27; &unknown;')).toBe("a & b 'c' &unknown;");
  });

  it('humanises category page slugs', () => {
    expect(humanizeCategorySlug('gay-sex-stories')).toBe('Gay Sex Stories');
    expect(humanizeCategorySlug('sci-fi-fantasy')).toBe('Sci Fi Fantasy');
  });
});

describe('parseV1List', () => {
  const result = parseV1List(SOURCE, loadFixture('v1-submissions.json'));

  it('extracts the total and all stories', () => {
    expect(result.total).toBe(2);
    expect(result.stories).toHaveLength(2);
  });

  it('maps the first story', () => {
    const story = result.stories[0];
    expect(story.id).toBe('101');
    expect(story.title).toBe('The & Long Road');
    expect(story.description).toBe('A description & more');
    expect(story.categoryName).toBe('Romance');
    expect(story.authorName).toBe('AnneAuthor');
    expect(story.rating).toBe(4.5);
    expect(story.views).toBe(1200);
    expect(story.url).toBe('https://www.literotica.com/s/the-long-road');
    expect(story.publishedAt).toBe(1600000000);
    expect(story.flags).toMatchObject({
      isHot: true,
      isNew: false,
      isWritersPick: false,
      isContestWinner: true,
      commentsEnabled: true,
      ratingEnabled: true,
    });
  });

  it('keeps absolute urls and coercions for the second story', () => {
    const story = result.stories[1];
    expect(story.id).toBe('102');
    expect(story.rating).toBe(3.75);
    expect(story.views).toBe(42);
    expect(story.url).toBe('https://www.literotica.com/s/second-story');
    expect(story.authorName).toBe('Bob');
    expect(story.flags).toMatchObject({ isNew: true, isHot: false, ratingEnabled: false });
  });
});

describe('parseV3List', () => {
  const result = parseV3List(SOURCE, loadFixture('v3-search.json'));

  it('maps search results and totals', () => {
    expect(result.total).toBe(1);
    const story = result.stories[0];
    expect(story.id).toBe('201');
    expect(story.title).toBe('Neon & Rain');
    expect(story.categoryName).toBe('Sci-Fi & Fantasy');
    expect(story.authorName).toBe('Casey');
    expect(story.rating).toBe(4.2);
    expect(story.views).toBe(500);
    expect(story.publishedAt).toBe(Date.UTC(2021, 0, 2) / 1000);
    expect(story.flags).toMatchObject({
      isHot: true,
      isNew: false,
      isWritersPick: true,
      isContestWinner: false,
    });
  });

  it('accepts the drifted v3 shape (pageUrl instead of name)', () => {
    const live = parseV3List(SOURCE, loadFixture('v3-search-pageurl.json'));
    const story = live.stories[0];
    expect(story.id).toBe('3713133');
    expect(story.title).toBe('My Gay Test');
    expect(story.categoryId).toBe('6');
    expect(story.categoryName).toBe('Gay Sex Stories');
    expect(story.authorId).toBe('4035088');
    expect(story.authorName).toBe('bogey4u');
    expect(story.rating).toBe(4.42);
    expect(story.views).toBe(10529);
  });
});

describe('parseV3TagStories', () => {
  it('reads submissions_count from the tag portal meta', () => {
    const result = parseV3TagStories(SOURCE, loadFixture('v3-tag-portal.json'));
    expect(result.total).toBe(1);
    expect(result.stories[0].id).toBe('301');
    expect(result.stories[0].title).toBe('Tagged Tale');
    expect(result.stories[0].authorName).toBe('Dana');
    expect(result.stories[0].publishedAt).toBe(Date.UTC(2020, 11, 31) / 1000);
  });
});

describe('parseV3Story', () => {
  const parsed = parseV3Story(SOURCE, loadFixture('v3-story.json'));

  it('maps the story metadata', () => {
    expect(parsed.story.id).toBe('101');
    expect(parsed.story.title).toBe('The & Long Road');
    expect(parsed.story.categoryName).toBe('Romance');
    expect(parsed.story.authorId).toBe('902');
  });

  it('splits the full text into pages', () => {
    expect(parsed.pages).toHaveLength(2);
    expect(parsed.pages[0].content).toContain('The road began');
    expect(parsed.pages[0].index).toBe(0);
  });

  it('exposes the embedded series', () => {
    expect(parsed.series?.id).toBe('55');
    expect(parsed.series?.title).toBe('The Long Road');
    expect(parsed.series?.items.map((item) => item.id)).toEqual(['101', '102']);
    expect(parsed.story.seriesId).toBe('55');
    expect(parsed.story.seriesPosition).toBe(0);
  });
});

describe('splitIntoPages', () => {
  it('returns no pages for empty text', () => {
    expect(splitIntoPages('   ', 3)).toEqual([]);
  });

  it('keeps everything on one page when count is one', () => {
    expect(splitIntoPages('a\r\n\r\nb', 1)).toEqual(['a\r\n\r\nb']);
  });

  it('splits paragraphs into the requested number of pages', () => {
    const text = Array.from({ length: 6 }, (_, i) => `Paragraph ${i} `.repeat(20)).join('\r\n\r\n');
    expect(splitIntoPages(text, 3)).toHaveLength(3);
  });
});

describe('parseStoryDetails', () => {
  const parsed = parseStoryDetails(SOURCE, loadFixture('v2-pages.json'));

  it('returns story metadata, pages and series id', () => {
    expect(parsed).not.toBeNull();
    expect(parsed?.story.id).toBe('101');
    expect(parsed?.story.title).toBe('The & Long Road');
    expect(parsed?.story.flags.ratingEnabled).toBe(true);
    expect(parsed?.seriesId).toBe('55');
    expect(parsed?.pages).toHaveLength(2);
    expect(parsed?.pages[0]).toMatchObject({ index: 0, content: '<p>Page one</p>' });
    expect(parsed?.pages[1]).toMatchObject({ index: 1, content: '<p>Page two</p>' });
  });

  it('sorts tags by submission count', () => {
    expect(parsed?.story.tags).toEqual(['slowburn', 'romance']);
  });

  it('returns null when there are no pages', () => {
    expect(parseStoryDetails(SOURCE, { success: false, pages: [] })).toBeNull();
  });
});

describe('parseTagList', () => {
  it('accepts tag / name / tag_name keys', () => {
    expect(parseTagList(loadFixture('tags-by-name.json'))).toEqual([
      { id: '10', name: 'romance' },
      { id: '11', name: 'slowburn' },
    ]);
  });
});

describe('parseConstants', () => {
  it('maps and sorts categories and languages', () => {
    const { categories, languages } = parseConstants(loadFixture('constants.json'));
    expect(categories).toEqual([
      { id: '6', name: 'Drama' },
      { id: '5', name: 'Romance' },
    ]);
    expect(languages).toEqual({ '1': 'en', '2': 'es' });
  });
});

describe('malformed payloads', () => {
  it('throws a ParseError', () => {
    expect(() => parseV1List(SOURCE, { submissions: 'nope' })).toThrow(ParseError);
  });
});
