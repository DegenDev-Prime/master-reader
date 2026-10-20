import {
  OfflineError,
  type BrowseKind,
  type ChapterRef,
  type PagedResult,
  type SearchFilters,
  type Source,
  type StoryDetails,
} from '@/sources';
import { SourceNotFoundError, SourceParseError } from '@/sources/errors';
import { blockText, parseChapterBlocks } from '@/sources/content/parse';
import { prepareChapterHtml } from '@/sources/content/sanitize';
import type { Chapter, Novel } from '@/models/novel';
import type { Story, StoryPage } from '@/models/story';
import { chapterRepository, type ChapterListItem } from '@/db/repositories/chapters';
import { novelRepository } from '@/db/repositories/novels';
import { storyUpdatesRepository } from '@/db/repositories/story-updates';
import { chapterNumberFromRef } from '@/services/chapter-number';
import { nowSeconds } from '@/utils/time';
import { useSettingsStore } from '@/stores/settings';

import { getSource } from './source-manager';

function isOffline(): boolean {
  return useSettingsStore.getState().settings.offlineMode;
}

export function novelFromStory(story: Story, chapterCount?: number | null): Novel {
  const stats: Record<string, string | number> = {};
  if (story.votes != null) stats.votes = story.votes;
  if (story.views != null) stats.views = story.views;

  return {
    sourceId: story.sourceId,
    id: story.id,
    title: story.title,
    authorId: story.authorId ?? null,
    authorName: story.authorName ?? null,
    description: story.description ?? null,
    coverUrl: story.coverUrl ?? null,
    status: 'unknown',
    genres: story.tags ?? [],
    stats: Object.keys(stats).length > 0 ? stats : null,
    chapterCount: chapterCount ?? null,
    wordCount: story.wordCount ?? null,
    rating: story.rating ?? null,
    lang: story.lang ?? null,
    url: story.url ?? null,
    fetchedAt: story.fetchedAt ?? nowSeconds(),
    updatedAt: null,
    chaptersSyncedAt: null,
  };
}

function pagesFromDetails(details: StoryDetails): StoryPage[] {
  return details.pages && details.pages.length > 0 ? details.pages : [];
}

function chapterIdForPage(page: StoryPage): string {
  return page.id && page.id.length > 0 ? page.id : `p${page.index}`;
}

function wordCount(html: string): number {
  const blocks = parseChapterBlocks(html);
  const text = blocks.map(blockText).join(' ');
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * The chapter list of a novel, fetched once. Providers that return their
 * chapters inside the story details need no extra request; the rest expose a
 * chapter list of their own.
 */
async function fetchChapterRefs(
  source: Source,
  novelId: string,
  details: StoryDetails,
): Promise<ChapterRef[]> {
  const pages = pagesFromDetails(details);
  if (pages.length > 0) {
    return pages.map((page) => ({
      id: chapterIdForPage(page),
      index: page.index,
      title: page.title ?? '',
      url: null,
      publishedAt: null,
    }));
  }
  if (!source.getChapterList) return [];
  return source.getChapterList(novelId);
}

export type NovelSyncResult = {
  novel: Novel;
  chapters: ChapterListItem[];
  total: number;
};

export async function syncNovel(sourceId: string, novelId: string): Promise<NovelSyncResult> {
  if (isOffline()) {
    throw new OfflineError('This novel cannot be refreshed while offline.');
  }

  const source = getSource(sourceId);
  const details = await source.getStory(novelId, { includeContent: true });
  if (!details) {
    throw new SourceNotFoundError({
      sourceId,
      operation: 'novel',
      url: source.info.baseUrl,
    });
  }

  const refs = await fetchChapterRefs(source, novelId, details);
  if (refs.length === 0) {
    throw new SourceParseError({
      sourceId,
      operation: 'chapter-list',
      url: source.info.baseUrl,
      message: 'The source returned no chapters for this novel.',
    });
  }
  const seen = new Set<string>();
  const metadata = refs
    .map((ref) => ({
      sourceId,
      novelId,
      id: ref.id,
      position: ref.index,
      title: ref.title ?? '',
      number: chapterNumberFromRef(ref),
      volume: ref.volume ?? null,
      volumeIndex: ref.volumeIndex ?? null,
      releasedAt: ref.publishedAt ?? null,
      wordCount: ref.wordCount ?? null,
    }))
    .filter((chapter) => {
      if (seen.has(chapter.id)) return false;
      seen.add(chapter.id);
      return true;
    });

  const syncedAt = nowSeconds();
  const novel: Novel = {
    ...novelFromStory(details, metadata.length),
    chaptersSyncedAt: syncedAt,
  };

  // Chapters seen for the first time are the novel's updates.
  const known = new Set(
    (await chapterRepository.listMetadata(sourceId, novelId)).map((chapter) => chapter.id),
  );
  const fresh = metadata.filter((chapter) => !known.has(chapter.id));

  await novelRepository.upsert(novel);
  await chapterRepository.upsertMetadata(metadata);
  await chapterRepository.markOrphaned(
    sourceId,
    novelId,
    metadata.map((chapter) => chapter.id),
  );

  if (fresh.length > 0) {
    await storyUpdatesRepository.record(
      fresh.map((chapter) => ({
        sourceId,
        novelId,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
      })),
    );
  }

  for (const page of pagesFromDetails(details)) {
    if (!page.content) continue;
    const chapterId = chapterIdForPage(page);
    const html = prepareChapterHtml(page.content, source.info.baseUrl);
    await chapterRepository.setContent(sourceId, novelId, chapterId, {
      html,
      wordCount: wordCount(html),
    });
  }

  await novelRepository.markSynced(sourceId, novelId, metadata.length, syncedAt);
  const chapters = await chapterRepository.listMetadata(sourceId, novelId);
  const saved = (await novelRepository.get(sourceId, novelId)) ?? novel;
  return { novel: saved, chapters, total: metadata.length };
}

export async function getCachedNovel(sourceId: string, novelId: string): Promise<Novel | null> {
  return novelRepository.get(sourceId, novelId);
}

export async function getChapters(sourceId: string, novelId: string): Promise<ChapterListItem[]> {
  return chapterRepository.listMetadata(sourceId, novelId);
}

export async function ensureChapters(
  sourceId: string,
  novelId: string,
): Promise<ChapterListItem[]> {
  const cached = await getChapters(sourceId, novelId);
  if (cached.length > 0) return cached;
  const result = await syncNovel(sourceId, novelId);
  return result.chapters;
}

export async function getChapter(
  sourceId: string,
  novelId: string,
  chapterId: string,
): Promise<Chapter | null> {
  return chapterRepository.get(sourceId, novelId, chapterId);
}

export async function getChapterHtml(
  sourceId: string,
  novelId: string,
  chapterId: string,
): Promise<string | null> {
  const cached = await chapterRepository.getContent(sourceId, novelId, chapterId);
  if (cached) return cached;

  if (isOffline()) {
    throw new OfflineError('This chapter is not downloaded or cached yet.');
  }

  const chapter = await chapterRepository.get(sourceId, novelId, chapterId);
  if (!chapter) {
    await syncNovel(sourceId, novelId);
  }

  const source = getSource(sourceId);
  if (!source.getChapterContent) return null;

  const raw = await source.getChapterContent(novelId, chapterId);
  if (raw == null) return null;

  const html = prepareChapterHtml(raw, source.info.baseUrl);
  await chapterRepository.setContent(sourceId, novelId, chapterId, {
    html,
    wordCount: wordCount(html),
  });
  return html;
}

export async function browseNovels(
  sourceId: string,
  kind: BrowseKind,
  page = 1,
  category?: string,
): Promise<PagedResult<Novel>> {
  if (isOffline()) {
    throw new OfflineError('Browse needs a connection. Cached library entries still work.');
  }

  const source = getSource(sourceId);
  const result =
    kind === 'popular'
      ? await source.getPopular({ page, category })
      : await source.getLatest({ page, category });

  const novels = result.items.map((story) => novelFromStory(story));
  await novelRepository.upsertMany(novels);
  return { ...result, items: novels };
}

export async function searchNovels(
  sourceId: string,
  filters: SearchFilters,
  page = 1,
): Promise<PagedResult<Novel>> {
  if (isOffline()) {
    throw new OfflineError('Search needs a connection.');
  }

  const source = getSource(sourceId);
  const result = await source.search(filters, { page });
  const novels = result.items.map((story) => novelFromStory(story));
  await novelRepository.upsertMany(novels);
  return { ...result, items: novels };
}

export async function getChapterCount(sourceId: string, novelId: string): Promise<number> {
  const counts = await chapterRepository.counts(sourceId, novelId);
  return counts.total;
}
