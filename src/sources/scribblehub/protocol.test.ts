import { describe, expect, it } from 'vitest';

import {
  chapterIdFromHref,
  chapterIdFromInput,
  chapterListExpression,
  chapterPath,
  chapterUrl,
  hasNextListingPage,
  isCloudflareChallenge,
  latestPath,
  parseChapterPublishedAt,
  popularPath,
  searchPath,
  seriesIdFromInput,
  seriesPath,
  seriesUrl,
  SCRIBBLEHUB_USES_BROWSER,
} from './protocol';

describe('scribblehub protocol', () => {
  it('normalizes series ids without changing saved numeric ids', () => {
    expect(seriesIdFromInput('664073')).toBe('664073');
    expect(seriesIdFromInput('664073-rebirth-of-the-nephilim')).toBe('664073');
    expect(seriesIdFromInput('https://www.scribblehub.com/series/664073/rebirth/')).toBe('664073');
    expect(seriesIdFromInput('/read/664073-rebirth/chapter/2623040/')).toBe('664073');
  });

  it('builds series and chapter URLs from ids', () => {
    expect(seriesPath('664073')).toBe('/series/664073/');
    expect(seriesUrl('664073')).toBe('https://www.scribblehub.com/series/664073/');
    expect(chapterPath('664073', '2623040')).toBe('/read/664073/chapter/2623040/');
    expect(chapterUrl('664073', '2623040')).toBe(
      'https://www.scribblehub.com/read/664073/chapter/2623040/',
    );
  });

  it('maps chapter hrefs back to ids', () => {
    expect(chapterIdFromHref('/read/664073-rebirth/chapter/2623040/')).toBe('2623040');
    expect(chapterIdFromHref('https://www.scribblehub.com/read/1-a/chapter/2/?x=1')).toBe('2');
    expect(chapterIdFromHref('/series/664073/')).toBeNull();
    expect(chapterIdFromInput('2623040')).toBe('2623040');
  });

  it('paginates every listing with the site parameter', () => {
    expect(popularPath(2)).toBe('/series-finder/?sf=1&sort=ratings&order=desc&pg=2');
    expect(latestPath(3)).toBe('/latest-series/?pg=3');
    expect(searchPath('nephilim', 2)).toBe('/series-finder/?sf=1&sh=nephilim&pg=2');
    expect(searchPath('a b', 1)).toBe('/series-finder/?sf=1&sh=a%20b&pg=1');
    expect(hasNextListingPage('<a href="?pg=2">Next</a>', 1)).toBe(true);
    expect(hasNextListingPage('<a href="?sf=1&amp;pg=2">Next</a>', 1)).toBe(true);
    expect(hasNextListingPage('<a href="?pg=20">Next</a>', 1)).toBe(false);
    expect(hasNextListingPage('<a href="?pg=2">Prev</a>', 2)).toBe(false);
  });

  it('keeps the full chapter list on the series page AJAX call', () => {
    const expression = chapterListExpression('664073');

    expect(expression).toContain('wi_getreleases_pagination');
    expect(expression).toContain("body.set('pagenum', '-1')");
    expect(expression).toContain('mypostid');
    expect(expression).toContain('664073');
    expect(expression).toContain('https://www.scribblehub.com/wp-admin/admin-ajax.php');
    expect(expression).toContain("credentials: 'include'");
    expect(() => new Function(expression)).not.toThrow();
  });

  it('reads the dates the chapter table publishes', () => {
    expect(parseChapterPublishedAt('Oct 17, 2026 02:10 AM')).toBe(1792203000);
    expect(parseChapterPublishedAt('Oct 17, 2026')).toBe(1792195200);
    expect(parseChapterPublishedAt('3 hours ago')).toBeNull();
    expect(parseChapterPublishedAt(null)).toBeNull();
  });

  it('detects the bot challenge page', () => {
    expect(
      isCloudflareChallenge(
        '<html><head><title>Just a moment...</title></head><body></body></html>',
      ),
    ).toBe(true);
    expect(isCloudflareChallenge('<html><div id="content">ok</div></html>')).toBe(false);
  });

  it('uses the in-app browser', () => {
    expect(SCRIBBLEHUB_USES_BROWSER).toBe(true);
  });
});
