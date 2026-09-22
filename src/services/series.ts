import type { Story, StorySeries, StorySeriesItem } from '@/models/story';

/** Projects a series entry into a minimal `Story` for lists and downloads. */
export function seriesItemToStory(
  sourceId: string,
  item: StorySeriesItem,
  series: StorySeries,
  position: number,
): Story {
  return {
    sourceId,
    id: item.id,
    title: item.title,
    categoryId: item.categoryId ?? null,
    categoryName: item.categoryName ?? null,
    url: item.url ?? null,
    seriesId: series.id,
    seriesTitle: series.title,
    seriesPosition: position,
    flags: {},
  };
}

export function seriesToStories(sourceId: string, series: StorySeries): Story[] {
  return series.items.map((item, position) => seriesItemToStory(sourceId, item, series, position));
}
