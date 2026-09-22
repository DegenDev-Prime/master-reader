import { libraryRepository, storiesRepository } from '@/db/repositories';

import { getSource } from './source-manager';

export type LibraryUpdateResult = {
  checked: number;
  updated: number;
  failed: number;
};

/**
 * Refreshes metadata for every library story. Requests go through the cached
 * transport, so unchanged listings are revalidated cheaply (304) rather than
 * re-downloaded.
 */
export async function updateLibrary(): Promise<LibraryUpdateResult> {
  const entries = await libraryRepository.listEntries();
  const result: LibraryUpdateResult = { checked: entries.length, updated: 0, failed: 0 };

  for (const entry of entries) {
    try {
      const source = getSource(entry.sourceId);
      const details = await source.getStory(entry.storyId, { includeContent: false });
      if (details) {
        const { pages: _pages, ...story } = details;
        await storiesRepository.upsert(story);
        result.updated += 1;
      }
    } catch (error) {
      console.warn('Library update failed for a story', error);
      result.failed += 1;
    }
  }

  return result;
}
