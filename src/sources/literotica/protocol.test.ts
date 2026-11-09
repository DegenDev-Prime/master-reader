import { describe, expect, it } from 'vitest';

import {
  authorApiPath,
  authorWebUrl,
  authorWorksApiPath,
  isSeriesNovelId,
  seriesApiId,
  seriesNovelId,
} from './protocol';

describe('literotica protocol', () => {
  it('prefixes series ids so they cannot collide with submission ids', () => {
    expect(seriesNovelId(55)).toBe('series-55');
    expect(seriesNovelId('the-long-road')).toBe('series-the-long-road');
    expect(isSeriesNovelId('series-55')).toBe(true);
    expect(isSeriesNovelId('101')).toBe(false);
  });

  it('strips the prefix for API calls', () => {
    expect(seriesApiId('series-55')).toBe('55');
    expect(seriesApiId('series-the-long-road')).toBe('the-long-road');
  });

  it('builds author API paths and web urls', () => {
    expect(authorApiPath('902')).toBe('3/users/902');
    expect(authorWorksApiPath('902')).toBe('3/users/902/stories');
    expect(authorWebUrl('AnneAuthor')).toBe('https://www.literotica.com/authors/AnneAuthor');
  });
});
