import { pagesRepository, storiesRepository } from '@/db/repositories';
import type { Story, StoryPage, StorySeries } from '@/models/story';
import {
  DEFAULT_PAGE_SIZE,
  OfflineError,
  type BrowseKind,
  type PagedResult,
  type SearchFilters,
  type StoryDetails,
} from '@/sources';
import { useSettingsStore } from '@/stores/settings';

import { listParamsHash, readListCache, writeListCache, type ListCacheKind } from './list-cache';
import { getSource } from './source-manager';

export type { BrowseKind };

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
  if (cached.length > 0) return cached;

  if (isOffline()) {
    throw new OfflineError('This story has not been downloaded or cached yet.');
  }

  const details = await getStoryDetails(sourceId, id, { includeContent: true });
  return details?.pages ?? [];
}

/**
 * Resolves one page/chapter's content, fetching it lazily from the provider and
 * caching it. Providers that return full content up front simply hit the cache.
 */
export async function getPageContent(
  sourceId: string,
  storyId: string,
  index: number,
): Promise<string | null> {
  const pages = await pagesRepository.listForStory(sourceId, storyId);
  const page = pages.find((entry) => entry.index === index);
  if (!page) return null;
  if (page.content) return page.content;

  const source = getSource(sourceId);
  if (!source.getChapterContent || !page.id) return page.content ?? null;

  if (isOffline()) {
    throw new OfflineError('This chapter has not been downloaded or cached yet.');
  }

  const content = await source.getChapterContent(storyId, page.id);
  if (content != null) {
    await pagesRepository.upsertMany([{ ...page, content }]);
  }
  return content;
}

export async function getCachedStory(sourceId: string, id: string): Promise<Story | null> {
  return storiesRepository.get(sourceId, id);
}

/**
 * Ensures every page/chapter of a story has content, fetching the missing ones
 * from the provider sequentially (chapter-based providers are rate sensitive).
 * Returns the full page list; used by downloads and narration.
 */
export async function ensurePageContents(
  sourceId: string,
  storyId: string,
  onProgress?: (done: number, total: number) => void,
  limit?: number,
): Promise<StoryPage[]> {
  const pages = await pagesRepository.listForStory(sourceId, storyId);
  const source = getSource(sourceId);
  if (!source.getChapterContent) {
    onProgress?.(pages.length, pages.length);
    return pages;
  }

  const result = [...pages];
  const cap = limit != null ? Math.min(limit, result.length) : result.length;
  for (let i = 0; i < cap; i += 1) {
    const page = result[i];
    if (!page.content && page.id) {
      if (isOffline()) throw new OfflineError('This chapter has not been downloaded yet.');
      const content = await source.getChapterContent(storyId, page.id);
      if (content != null) {
        result[i] = { ...page, content };
        await pagesRepository.upsertMany([result[i]]);
      }
    }
    onProgress?.(i + 1, result.length);
  }
  return result;
}
