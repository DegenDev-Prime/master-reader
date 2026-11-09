import { authorsRepository, storiesRepository } from '@/db/repositories';
import type { Author } from '@/models/author';
import type { AuthorPage, PageRequest } from '@/sources';
import { OfflineError } from '@/sources';
import { useSettingsStore } from '@/stores/settings';

import { getSource } from './source-manager';

function isOffline(): boolean {
  return useSettingsStore.getState().settings.offlineMode;
}

export async function getAuthorPage(
  sourceId: string,
  authorId: string,
  request: PageRequest = {},
): Promise<AuthorPage | null> {
  const source = getSource(sourceId);
  if (!source.getAuthor) return null;
  const page = Math.max(1, Math.floor(request.page ?? 1));

  if (isOffline()) {
    const author = await authorsRepository.get(sourceId, authorId);
    if (!author) throw new OfflineError('This author page has not been cached yet.');
    const stories = await storiesRepository.listByAuthor(sourceId, authorId, 100);
    return {
      author,
      stories: { items: stories, page, hasNext: false, total: stories.length },
    };
  }

  const result = await source.getAuthor(authorId, { ...request, page });
  if (!result) return null;

  await authorsRepository.upsert(result.author);
  await storiesRepository.upsertMany(result.stories.items);
  return result;
}

export async function getCachedAuthor(sourceId: string, authorId: string): Promise<Author | null> {
  return authorsRepository.get(sourceId, authorId);
}
