import { pagesRepository, storiesRepository } from '@/db/repositories';
import type { Story, StoryPage, StorySeries } from '@/models/story';
import {
  DEFAULT_PAGE_SIZE,
  OfflineError,
  type PagedResult,
  type SearchFilters,
  type StoryDetails,
} from '@/sources';
import { useSettingsStore } from '@/stores/settings';

import { listParamsHash, readListCache, writeListCache, type ListCacheKind } from './list-cache';
import { getSource } from './source-manager';

export type BrowseKind = 'popular' | 'latest';

function isOffline(): boolean {
  return useSettingsStore.getState().settings.offlineMode;
}

function cacheListsEnabled(): boolean {
  return useSettingsStore.getState().settings.cacheLists;
}

function toPaged(
  stories: Story[],
  total: number | null,
  page: number,
  limit = DEFAULT_PAGE_SIZE,
): PagedResult<Story> {
  const resolvedTotal = total ?? undefined;
  const hasNext =
    resolvedTotal !== undefined ? page * limit < resolvedTotal : stories.length >= limit;
  return { items: stories, page, hasNext, total: resolvedTotal };
}

async function cachedListResult(
  sourceId: string,
  kind: ListCacheKind,
  page: number,
  paramsHash: string,
): Promise<PagedResult<Story> | null> {
  const cached = await readListCache(sourceId, kind, page, paramsHash);
  if (!cached) return null;
  return toPaged(cached.stories, cached.total, page);
}

export async function browse(
  sourceId: string,
  kind: BrowseKind,
  page = 1,
  category?: string,
): Promise<PagedResult<Story>> {
  const paramsHash = listParamsHash({ kind, category: category ?? null });

  if (!isOffline()) {
    try {
      const source = getSource(sourceId);
      const result =
        kind === 'popular'
          ? await source.getPopular({ page, category })
          : await source.getLatest({ page, category });

      await storiesRepository.upsertMany(result.items);
      if (cacheListsEnabled()) {
        await writeListCache(sourceId, kind, page, paramsHash, {
          stories: result.items,
          total: result.total ?? null,
        });
      }
      return result;
    } catch (error) {
      const cached = await cachedListResult(sourceId, kind, page, paramsHash);
      if (cached) return cached;
      throw error;
    }
  }

  const cached = await cachedListResult(sourceId, kind, page, paramsHash);
  if (cached) return cached;
  throw new OfflineError('Browse is unavailable offline. Open this listing while online first.');
}

export async function search(
  sourceId: string,
  filters: SearchFilters,
  page = 1,
): Promise<PagedResult<Story>> {
  const paramsHash = listParamsHash(filters);

  if (!isOffline()) {
    try {
      const source = getSource(sourceId);
      const result = await source.search(filters, { page });

      await storiesRepository.upsertMany(result.items);
      if (cacheListsEnabled()) {
        await writeListCache(sourceId, 'search', page, paramsHash, {
          stories: result.items,
          total: result.total ?? null,
        });
      }
      return result;
    } catch (error) {
      const cached = await cachedListResult(sourceId, 'search', page, paramsHash);
      if (cached) return cached;
      throw error;
    }
  }

  const cached = await cachedListResult(sourceId, 'search', page, paramsHash);
  if (cached) return cached;
  throw new OfflineError('Search is unavailable offline. Run this search while online first.');
}

export async function getStoryDetails(
  sourceId: string,
  id: string,
  options?: { includeContent?: boolean },
): Promise<StoryDetails | null> {
  const includeContent = options?.includeContent ?? true;

  if (isOffline()) {
    return cachedStoryDetails(sourceId, id, includeContent);
  }

  const source = getSource(sourceId);
  const details = await source.getStory(id, options);
  if (!details) {
    return cachedStoryDetails(sourceId, id, includeContent);
  }

  const { pages, ...story } = details;
  await storiesRepository.upsert(story);
  if (pages?.length) await pagesRepository.upsertMany(pages);

  return details;
}

async function cachedStoryDetails(
  sourceId: string,
  id: string,
  includeContent: boolean,
): Promise<StoryDetails | null> {
  const story = await storiesRepository.get(sourceId, id);
  if (!story) return null;

  const pages = includeContent ? await pagesRepository.listForStory(sourceId, id) : [];
  const series = await cachedSeries(sourceId, story);
  return { ...story, series, pages: includeContent ? pages : undefined };
}

/** Rebuilds series membership from cached stories (used offline). */
async function cachedSeries(sourceId: string, story: Story): Promise<StorySeries | null> {
  if (!story.seriesId) return null;
  const items = await storiesRepository.listBySeries(sourceId, story.seriesId);
  if (items.length === 0) return null;

  return {
    id: story.seriesId,
    title: story.seriesTitle ?? '',
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url ?? null,
      categoryId: item.categoryId ?? null,
      categoryName: item.categoryName ?? null,
    })),
  };
}

/** Returns cached pages when present, otherwise fetches and persists them. */
export async function getStoryPages(sourceId: string, id: string): Promise<StoryPage[]> {
  const cached = await pagesRepository.listForStory(sourceId, id);
  if (cached.length > 0 && cached.some((page) => page.content)) {
    return cached;
  }

  if (isOffline()) {
    if (cached.length > 0) return cached;
    throw new OfflineError('This story has not been downloaded or cached yet.');
  }

  const details = await getStoryDetails(sourceId, id, { includeContent: true });
  return details?.pages ?? [];
}

export async function getCachedStory(sourceId: string, id: string): Promise<Story | null> {
  return storiesRepository.get(sourceId, id);
}
