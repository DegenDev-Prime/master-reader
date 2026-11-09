import { describe, expect, it } from 'vitest';

import { NotFoundError } from '../transport';
import {
  authorIdFromHref,
  authorPath,
  authorUrl,
  chapterUrl,
  fictionIdFromHref,
  fictionPath,
  fictionUrl,
  hasNextPage,
  isCloudflareChallenge,
  listingPath,
  listingUrl,
  normalizeFictionId,
  parseChapterList,
  readRoyalRoadHtml,
  readRoyalRoadListing,
  ROYALROAD_BASE_URL,
  searchPath,
  searchUrl,
  toChapterRefs,
} from './protocol';

describe('royalroad protocol', () => {
  it('identifies fictions by their numeric id', () => {
    expect(normalizeFictionId('21220')).toBe('21220');
    expect(normalizeFictionId('/fiction/21220')).toBe('21220');
    expect(normalizeFictionId('https://www.royalroad.com/fiction/21220/mother-of-learning')).toBe(
      '21220',
    );
    expect(normalizeFictionId('not-a-fiction')).toBeNull();
    expect(fictionIdFromHref('/fiction/21220/mother-of-learning/chapter/301778/1-good')).toBe(
      '21220',
    );

    expect(fictionPath('21220')).toBe('/fiction/21220');
    expect(fictionUrl('21220')).toBe(`${ROYALROAD_BASE_URL}/fiction/21220`);
  });

  it('resolves author profile ids and URLs', () => {
    expect(authorIdFromHref('/profile/15870/nobody103')).toBe('15870');
    expect(authorIdFromHref('https://www.royalroad.com/profile/15870/nobody103')).toBe('15870');
    expect(authorIdFromHref('/fiction/21220/mother-of-learning')).toBeNull();

    expect(authorPath('15870')).toBe('/profile/15870');
    expect(authorPath('15870', 2)).toBe('/profile/15870?page=2');
    expect(authorUrl('15870')).toBe(`${ROYALROAD_BASE_URL}/profile/15870`);
    expect(authorUrl('15870', 3)).toBe(`${ROYALROAD_BASE_URL}/profile/15870?page=3`);
  });

  it('paginates listings and search with the site page parameter', () => {
    expect(listingPath('popular', 2)).toBe('/fictions/best-rated?page=2');
    expect(listingPath('latest', 1)).toBe('/fictions/latest-updates?page=1');
    expect(listingUrl('popular', 3)).toBe('https://www.royalroad.com/fictions/best-rated?page=3');
    expect(searchPath('mother of learning', 2)).toBe(
      '/fictions/search?title=mother%20of%20learning&page=2',
    );
    expect(searchUrl('mother of learning', 2)).toBe(
      'https://www.royalroad.com/fictions/search?title=mother%20of%20learning&page=2',
    );

    expect(hasNextPage('<a href="/fictions/best-rated?page=2">Next</a>', 1)).toBe(true);
    expect(hasNextPage('<a href="/fictions/best-rated?page=2">Next</a>', 2)).toBe(false);
  });

  it('resolves a stored chapter id to an absolute chapter URL', () => {
    const path = '/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother';
    expect(chapterUrl('21220', path)).toBe(`${ROYALROAD_BASE_URL}${path}`);
    expect(chapterUrl('21220', `https://www.royalroad.com${path}`)).toBe(
      `${ROYALROAD_BASE_URL}${path}`,
    );
    expect(chapterUrl('21220', '301778')).toBe(
      `${ROYALROAD_BASE_URL}/fiction/21220/chapter/301778`,
    );
    expect(chapterUrl('21220', '/fiction/21220/chapter/301778')).toBe(
      `${ROYALROAD_BASE_URL}/fiction/21220/chapter/301778`,
    );
  });

  it('reads inline chapters with volumes, order, dates, and legacy path ids', () => {
    const chapters = [
      {
        id: 769567,
        volumeId: 6324,
        title: 'Chapter 2: Slow and Steady',
        slug: 'chapter-2-slow-and-steady',
        date: '2021-10-20T03:26:15Z',
        order: 1,
        visible: 1,
        url: '/fiction/47514/voracity/chapter/769567/chapter-2-slow-and-steady',
      },
      {
        id: 768239,
        volumeId: 6324,
        title: 'Chapter 1: A Wonder',
        slug: 'chapter-1-a-wonder',
        date: '2021-10-17T20:29:00Z',
        order: 0,
        visible: 1,
        url: '/fiction/47514/voracity/chapter/768239/chapter-1-a-wonder',
      },
      {
        id: 770600,
        volumeId: 6400,
        title: 'Chapter 3: [Finale]; still here',
        slug: 'chapter-3-finale',
        order: 2,
        visible: 1,
        url: '/fiction/47514/voracity/chapter/770600/chapter-3-finale',
      },
      {
        id: 768239,
        volumeId: 6324,
        title: 'Duplicate chapter',
        order: 3,
        visible: 1,
        url: '/fiction/47514/voracity/chapter/768239/chapter-1-a-wonder',
      },
      {
        id: 888,
        volumeId: null,
        title: 'Hidden chapter',
        order: 4,
        visible: 0,
        url: '/fiction/47514/voracity/chapter/888/hidden',
      },
      {
        id: 999,
        volumeId: null,
        title: 'Other fiction',
        order: 5,
        visible: 1,
        url: '/fiction/1/other/chapter/999/other',
      },
    ];
    const volumes = [
      { id: 6324, title: 'Part 1', order: 1 },
      { id: 6400, title: 'Part 2', order: 2 },
    ];
    const html = `<script>
      window.chapters = ${JSON.stringify(chapters)};
      window.volumes = ${JSON.stringify(volumes)};
    </script>`;

    const parsed = parseChapterList(html, '47514');
    expect(parsed.map((chapter) => chapter.chapterId)).toEqual([768239, 769567, 770600]);
    expect(parsed[0]).toMatchObject({
      path: '/fiction/47514/voracity/chapter/768239/chapter-1-a-wonder',
      title: 'Chapter 1: A Wonder',
      volumeId: 6324,
      volumeTitle: 'Part 1',
      volumeIndex: 0,
      publishedAt: 1634502540,
    });
    expect(parsed[1].volumeIndex).toBe(1);
    expect(parsed[1].title).toBe('Chapter 2: Slow and Steady');
    expect(parsed[1].publishedAt).toBe(1634700375);
    expect(parsed[2]).toMatchObject({
      title: 'Chapter 3: [Finale]; still here',
      volumeTitle: 'Part 2',
      volumeIndex: 0,
      publishedAt: null,
    });

    const refs = toChapterRefs(parsed, '47514');
    expect(refs[0]).toMatchObject({
      id: '/fiction/47514/voracity/chapter/768239/chapter-1-a-wonder',
      index: 0,
      volume: 'Part 1',
      volumeIndex: 0,
      publishedAt: 1634502540,
      url: 'https://www.royalroad.com/fiction/47514/voracity/chapter/768239/chapter-1-a-wonder',
    });
  });

  it('falls back to the chapters table when the inline JSON is absent', () => {
    const html = `
      <table id="chapters">
        <tr data-url="/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother" data-volume-id="6324">
          <td><a href="/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother">1. Good Morning Brother</a></td>
          <td><a href="/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother"><time unixtime="1540762483">Sunday</time></a></td>
        </tr>
        <tr>
          <td><a href="/fiction/21220/chapter/301781">2. Life's Little Problems</a></td>
        </tr>
      </table>`;

    const parsed = parseChapterList(html, '21220');
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      chapterId: 301778,
      path: '/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother',
      title: '1. Good Morning Brother',
      volumeId: 6324,
      volumeTitle: null,
      publishedAt: 1540762483,
    });
    expect(parsed[1]).toMatchObject({
      chapterId: 301781,
      path: '/fiction/21220/chapter/301781',
      title: "2. Life's Little Problems",
      publishedAt: null,
    });
  });

  it('ignores links to other fictions and non-chapter anchors', () => {
    const parsed = parseChapterList(
      '<a href="/fiction/9999/other/chapter/77/list">other</a><a href="/fiction/21220">self</a>',
      '21220',
    );
    expect(parsed).toHaveLength(0);
  });

  it('detects a Cloudflare interstitial and throws instead of parsing it', async () => {
    const challenge = '<html><head><title>Just a moment...</title></head></html>';
    expect(isCloudflareChallenge(challenge)).toBe(true);
    expect(isCloudflareChallenge('<title>Best Rated | Royal Road</title>')).toBe(false);

    await expect(readRoyalRoadHtml(async () => challenge, 'https://example.test')).rejects.toThrow(
      /blocking automated access/i,
    );
  });

  it('reports unavailable when a listing 404s at the edge', async () => {
    const notFound = async () => {
      throw new NotFoundError({ url: 'https://example.test' });
    };
    await expect(readRoyalRoadListing(notFound, 'https://example.test')).rejects.toThrow(
      /currently unavailable/i,
    );
  });
});
