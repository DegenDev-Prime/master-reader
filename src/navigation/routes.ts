import { router } from 'expo-router';

export function openStory(sourceId: string, id: string): void {
  router.push(`/story/${sourceId}/${id}`);
}

export function openReader(sourceId: string, id: string): void {
  router.push(`/reader/${sourceId}/${id}`);
}

export function openSeries(sourceId: string, id: string): void {
  router.push(`/series/${sourceId}/${id}`);
}
