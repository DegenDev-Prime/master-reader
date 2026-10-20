import { downloadsRepository, pagesRepository, storiesRepository } from '@/db/repositories';
import type { Download, Story } from '@/models/story';
import { computeStorySizeBytes } from '@/utils/download';
import { downloadItemsBytes, groupDownloadItems, type DownloadItem } from '@/utils/download-groups';
import { nowSeconds } from '@/utils/time';

import { ensurePageContents } from './catalog';
import { getSource } from './source-manager';

export type { DownloadItem, DownloadSeriesGroup } from '@/utils/download-groups';
export { downloadItemsBytes, groupDownloadItems };

export async function listDownloadItems(): Promise<DownloadItem[]> {
  const entries = await downloadsRepository.list();

  const idsBySource = new Map<string, string[]>();
  for (const entry of entries) {
    const ids = idsBySource.get(entry.sourceId) ?? [];
    ids.push(entry.storyId);
    idsBySource.set(entry.sourceId, ids);
  }

  const stories = new Map<string, Story>();
  for (const [sourceId, ids] of idsBySource) {
    for (const story of await storiesRepository.listByIds(sourceId, ids)) {
      stories.set(`${sourceId}:${story.id}`, story);
    }
  }

  return entries.map((download) => ({
    download,
    story: stories.get(`${download.sourceId}:${download.storyId}`) ?? null,
  }));
}

export async function enqueueDownload(story: Story): Promise<void> {
  await storiesRepository.upsert(story);

  const existing = await downloadsRepository.get(story.sourceId, story.id);
  if (existing?.status === 'completed' || existing?.status === 'downloading') return;

  await downloadsRepository.upsert({
    sourceId: story.sourceId,
    storyId: story.id,
    status: 'queued',
    downloadedPages: 0,
    totalPages: null,
    sizeBytes: null,
    path: null,
    error: null,
    startedAt: nowSeconds(),
    completedAt: null,
  });
}

export async function getNextQueued(): Promise<Download | null> {
  return downloadsRepository.nextQueued();
}

/**
 * An interrupted download is left in `downloading` by an app kill; nothing owns
 * it on the next launch, and `enqueueDownload` refuses such rows. Re-queue them
 * once at startup so the worker picks them back up. Called before any worker
 * starts, when no in-flight run can be clobbered.
 */
export async function recoverInterruptedDownloads(): Promise<number> {
  const stuck = await downloadsRepository.listByStatus('downloading');
  for (const entry of stuck) {
    await downloadsRepository.upsert({
      ...entry,
      status: 'queued',
    });
  }
  return stuck.length;
}

/**
 * Downloads every page of a story, pinning the content and recording the size.
 * Status transitions: queued -> downloading -> completed | failed.
 */
export async function runDownload(sourceId: string, storyId: string): Promise<Download> {
  await downloadsRepository.upsert({
    sourceId,
    storyId,
    status: 'downloading',
    downloadedPages: 0,
    startedAt: nowSeconds(),
  });

  try {
    const pages = await ensurePageContents(sourceId, storyId, (done, total) => {
      void downloadsRepository.upsert({
        sourceId,
        storyId,
        status: 'downloading',
        downloadedPages: done,
        totalPages: total,
      });
    });
    if (pages.length === 0) {
      throw new Error('No content available to download');
    }

    const sizeBytes = computeStorySizeBytes(pages);
    const download: Download = {
      sourceId,
      storyId,
      status: 'completed',
      totalPages: pages.length,
      downloadedPages: pages.length,
      sizeBytes,
      path: null,
      error: null,
      startedAt: nowSeconds(),
      completedAt: nowSeconds(),
    };

    await downloadsRepository.upsert(download);
    return download;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Download failed';
    const failed: Download = {
      sourceId,
      storyId,
      status: 'failed',
      downloadedPages: 0,
      error: message,
      startedAt: nowSeconds(),
    };
    await downloadsRepository.upsert(failed);
    return failed;
  }
}

export async function removeDownload(sourceId: string, storyId: string): Promise<void> {
  await downloadsRepository.remove(sourceId, storyId);
  await pagesRepository.remove(sourceId, storyId);
}

export async function retryDownload(sourceId: string, storyId: string): Promise<void> {
  await downloadsRepository.upsert({
    sourceId,
    storyId,
    status: 'queued',
    downloadedPages: 0,
    error: null,
    startedAt: nowSeconds(),
    completedAt: null,
  });
}

export async function getDownload(sourceId: string, storyId: string): Promise<Download | null> {
  return downloadsRepository.get(sourceId, storyId);
}

/**
 * Downloads a single chapter's content and caches it in the pages table.
 * Used for selective per-chapter downloads of multi-chapter novels.
 * Returns true when content was newly fetched, false when already cached or unavailable.
 */
export async function downloadChapter(
  sourceId: string,
  storyId: string,
  index: number,
): Promise<boolean> {
  const pages = await pagesRepository.listForStory(sourceId, storyId);
  const page = pages.find((entry) => entry.index === index);
  if (!page) return false;
  if (page.content) return true;

  const source = getSource(sourceId);
  if (!source.getChapterContent || !page.id) return false;

  const content = await source.getChapterContent(storyId, page.id);
  if (content != null) {
    await pagesRepository.upsertMany([{ ...page, content }]);
    return true;
  }
  return false;
}

export async function totalDownloadBytes(): Promise<number> {
  const entries = await downloadsRepository.listByStatus('completed');
  return entries.reduce((total, entry) => total + (entry.sizeBytes ?? 0), 0);
}
