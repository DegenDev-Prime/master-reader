import { historyRepository, storiesRepository } from '@/db/repositories';
import type { HistoryEntry, Story } from '@/models/story';

export type HistoryItem = {
  entry: HistoryEntry;
  story: Story | null;
};

const keyOf = (sourceId: string, storyId: string) => `${sourceId}:${storyId}`;

export async function listRecentHistory(limit = 50): Promise<HistoryItem[]> {
  const entries = await historyRepository.listRecent(limit);

  const idsBySource = new Map<string, string[]>();
  for (const entry of entries) {
    const ids = idsBySource.get(entry.sourceId) ?? [];
    ids.push(entry.storyId);
    idsBySource.set(entry.sourceId, ids);
  }

  const stories = new Map<string, Story>();
  for (const [sourceId, ids] of idsBySource) {
    for (const story of await storiesRepository.listByIds(sourceId, ids)) {
      stories.set(keyOf(sourceId, story.id), story);
    }
  }

  return entries.map((entry) => ({
    entry,
    story: stories.get(keyOf(entry.sourceId, entry.storyId)) ?? null,
  }));
}

export async function clearHistory(): Promise<void> {
  await historyRepository.clear();
}
