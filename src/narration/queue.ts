import type { StorySeriesItem } from '@/models/story';

export type QueueTrack = {
  storyId: string;
  title: string;
  /** Known page count (0 when unknown); used for progress estimates. */
  pageCount: number;
};

/**
 * Builds the narration queue for series chaining: the current chapter first,
 * then every following chapter in series order. Pure so chaining order is
 * unit-testable and stable.
 */
export function buildSeriesQueue(
  items: StorySeriesItem[],
  pageCounts: ReadonlyMap<string, number>,
  fromStoryId: string,
): QueueTrack[] {
  const start = items.findIndex((item) => item.id === fromStoryId);
  const rest = start >= 0 ? items.slice(start) : items;
  return rest.map((item) => ({
    storyId: item.id,
    title: item.title,
    pageCount: pageCounts.get(item.id) ?? 0,
  }));
}
