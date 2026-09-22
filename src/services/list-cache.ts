import { listCacheRepository, storiesRepository } from '@/db/repositories';
import type { Story } from '@/models/story';
import { hashParams } from '@/utils/hash';

export type ListCacheKind = 'popular' | 'latest' | 'search';

export const LIST_CACHE_TTL_MS = 15 * 60 * 1000;

export function listParamsHash(params: unknown): string {
  return hashParams(params ?? {});
}

export type CachedList = {
  stories: Story[];
  total: number | null;
};

/**
 * Reads a cached listing, rehydrating the story rows in their original order.
 * Returns null when nothing is cached for this key.
 */
export async function readListCache(
  sourceId: string,
  kind: ListCacheKind,
  page: number,
  paramsHash: string,
): Promise<CachedList | null> {
  const row = await listCacheRepository.get(sourceId, kind, page, paramsHash);
  if (!row) return null;

  const refs = row.storyRefs ?? [];
  const stories = await storiesRepository.listByIds(sourceId, refs);
  const byId = new Map(stories.map((story) => [story.id, story]));

  return {
    stories: refs.map((id) => byId.get(id)).filter((story): story is Story => Boolean(story)),
    total: row.total ?? null,
  };
}

export async function writeListCache(
  sourceId: string,
  kind: ListCacheKind,
  page: number,
  paramsHash: string,
  list: CachedList,
  ttlMs = LIST_CACHE_TTL_MS,
): Promise<void> {
  await listCacheRepository.set({
    sourceId,
    kind,
    page,
    paramsHash,
    storyRefs: list.stories.map((story) => story.id),
    total: list.total,
    expiresAt: Math.floor((Date.now() + ttlMs) / 1000),
  });
}
