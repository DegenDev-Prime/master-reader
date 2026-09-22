import { libraryRepository, storiesRepository, type LibraryStory } from '@/db/repositories';
import type { Story } from '@/models/story';

export async function addToLibrary(story: Story): Promise<void> {
  await storiesRepository.upsert(story);
  await libraryRepository.add(story.sourceId, story.id);
}

export async function removeFromLibrary(sourceId: string, id: string): Promise<void> {
  await libraryRepository.remove(sourceId, id);
}

export async function listLibrary(): Promise<LibraryStory[]> {
  return libraryRepository.list();
}

export async function isInLibrary(sourceId: string, id: string): Promise<boolean> {
  return libraryRepository.contains(sourceId, id);
}

export async function markStoryRead(sourceId: string, id: string): Promise<void> {
  await libraryRepository.markRead(sourceId, id);
}
