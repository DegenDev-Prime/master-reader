import { describe, expect, it } from 'vitest';

import type { Download, Story } from '@/models/story';

import { downloadItemsBytes, groupDownloadItems, type DownloadItem } from './download-groups';

function item(id: string, overrides: Partial<Story> = {}, sizeBytes: number | null = 0): DownloadItem {
  const download: Download = {
    sourceId: 'literotica',
    storyId: id,
    status: 'completed',
    downloadedPages: 1,
    sizeBytes,
  };
  const story: Story = {
    sourceId: 'literotica',
    id,
    title: `Story ${id}`,
    flags: {},
    ...overrides,
  };
  return { download, story };
}

describe('groupDownloadItems', () => {
  it('groups series and orders parts by position', () => {
    const items = [
      item('2', { seriesId: 's1', seriesTitle: 'The Saga', seriesPosition: 1 }),
      item('1', { seriesId: 's1', seriesTitle: 'The Saga', seriesPosition: 0 }),
      item('9'),
    ];

    const { series, standalone } = groupDownloadItems(items);
    expect(series).toHaveLength(1);
    expect(series[0].title).toBe('The Saga');
    expect(series[0].items.map((entry) => entry.story?.id)).toEqual(['1', '2']);
    expect(standalone.map((entry) => entry.story?.id)).toEqual(['9']);
  });

  it('falls back to the series id when no title is available', () => {
    const { series } = groupDownloadItems([item('1', { seriesId: 's42' })]);
    expect(series[0].title).toBe('s42');
  });

  it('sums sizes', () => {
    expect(downloadItemsBytes([item('1', {}, 100), item('2', {}, 250)])).toBe(350);
  });
});
