import { describe, expect, it } from 'vitest';

import { isSeriesNovelId, seriesApiId, seriesNovelId } from './protocol';

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
});
