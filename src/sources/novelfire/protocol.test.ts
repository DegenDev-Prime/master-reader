import { describe, expect, it } from 'vitest';

import {
  authorPath,
  authorUrl,
  chapterIdFromNumber,
  chapterNumberFromId,
  chapterRedirectTarget,
  isChapterInterstitial,
} from './protocol';

describe('novelfire protocol', () => {
  it('builds author profile paths and urls', () => {
    expect(authorPath('guiltythree')).toBe('/author/guiltythree');
    expect(authorUrl('guiltythree')).toBe('https://novelfire.net/author/guiltythree');
  });
  it('maps numeric chapter ids', () => {
    expect(chapterIdFromNumber(12)).toBe('12');
    expect(chapterNumberFromId('12')).toBe(12);
    expect(chapterNumberFromId('p12')).toBeNull();
    expect(chapterNumberFromId('0')).toBeNull();
  });

  it('extracts and unescapes a mirror redirect target', () => {
    const html =
      '<html><script>setTimeout(() => { window.location.href = "https:\\/\\/novelphoenix.com\\/novel\\/a\\/chapter-1?noti=1"; }, 5);</script></html>';

    expect(chapterRedirectTarget(html)).toBe('https://novelphoenix.com/novel/a/chapter-1?noti=1');
    expect(isChapterInterstitial(html)).toBe(true);
  });

  it('does not treat a real chapter as an interstitial', () => {
    const html = '<html><div id="content"><p>novelphoenix.com is mentioned.</p></div></html>';
    expect(isChapterInterstitial(html)).toBe(false);
  });
});
