import type { Download, Story } from '@/models/story';

export type DownloadItem = {
  download: Download;
  story: Story | null;
};

export type DownloadSeriesGroup = {
  seriesId: string;
  title: string;
  items: DownloadItem[];
};

/**
 * Groups download items by series (ordered by part) with a standalone bucket.
 * Used to show one catalogue entry per series on the downloads screen.
 */
export function groupDownloadItems(items: DownloadItem[]): {
  series: DownloadSeriesGroup[];
  standalone: DownloadItem[];
} {
  const bySeries = new Map<string, DownloadSeriesGroup>();
  const standalone: DownloadItem[] = [];

  for (const item of items) {
    const seriesId = item.story?.seriesId;
    if (!seriesId) {
      standalone.push(item);
      continue;
    }
    const group = bySeries.get(seriesId) ?? {
      seriesId,
      title: item.story?.seriesTitle || seriesId,
      items: [],
    };
    group.items.push(item);
    bySeries.set(seriesId, group);
  }

  const series = [...bySeries.values()]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (a, b) =>
          (a.story?.seriesPosition ?? 0) - (b.story?.seriesPosition ?? 0) ||
          (a.story?.title ?? '').localeCompare(b.story?.title ?? ''),
      ),
    }));

  return { series, standalone };
}

export function downloadItemsBytes(items: DownloadItem[]): number {
  return items.reduce((total, item) => total + (item.download.sizeBytes ?? 0), 0);
}
