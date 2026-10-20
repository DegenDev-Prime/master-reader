import { router } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { useCallback } from 'react';

import type { Story } from '@/models/story';

export function openStory(sourceId: string, id: string): void {
  router.push(`/story/${sourceId}/${id}`);
}

export function openReader(sourceId: string, id: string, page?: number): void {
  router.push(
    page != null ? `/reader/${sourceId}/${id}?page=${page}` : `/reader/${sourceId}/${id}`,
  );
}

export function openChapters(sourceId: string, id: string): void {
  router.push(`/chapters/${sourceId}/${id}` as RelativePathString);
}

export function openSeries(sourceId: string, id: string): void {
  router.push(`/series/${sourceId}/${id}`);
}

/** Stable `Story`-row handler so memoized list rows keep referential equality. */
export function useOpenStory(): (story: Story) => void {
  return useCallback((story: Story) => openStory(story.sourceId, story.id), []);
}
