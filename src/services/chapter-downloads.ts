import { chapterDownloadsRepository } from '@/db/repositories/chapter-downloads';
import { chapterRepository } from '@/db/repositories/chapters';
import { downloadsRepository } from '@/db/repositories/downloads';
import { nowSeconds } from '@/utils/time';

import { getChapterHtml } from './novel-catalog';

export type DownloadProgress = {
  completed: number;
  failed: number;
  total: number;
};

export async function downloadChapterRange(
  sourceId: string,
  novelId: string,
  chapterIds: string[],
  options: { onProgress?: (progress: DownloadProgress) => void } = {},
): Promise<DownloadProgress> {
  const counts = await chapterRepository.counts(sourceId, novelId);
  const startedAt = nowSeconds();

  await downloadsRepository.upsert({
    sourceId,
    storyId: novelId,
    status: 'downloading',
    totalPages: counts.total,
    downloadedPages: counts.downloaded,
    startedAt,
  });

  let completed = 0;
  let failed = 0;

  for (const chapterId of chapterIds) {
    await chapterDownloadsRepository.setStatus(sourceId, novelId, chapterId, 'downloading');
    try {
      const html = await getChapterHtml(sourceId, novelId, chapterId);
      if (!html) throw new Error('The source returned an empty chapter.');
      await chapterDownloadsRepository.setStatus(sourceId, novelId, chapterId, 'completed', {
        bytes: html.length,
      });
      completed += 1;
    } catch (error) {
      failed += 1;
      await chapterDownloadsRepository.setStatus(sourceId, novelId, chapterId, 'failed', {
        error: error instanceof Error ? error.message : 'Download failed.',
      });
    }
    options.onProgress?.({ completed, failed, total: chapterIds.length });
  }

  const finalCounts = await chapterRepository.counts(sourceId, novelId);
  const downloaded = await chapterDownloadsRepository.counts(sourceId, novelId);
  await downloadsRepository.upsert({
    sourceId,
    storyId: novelId,
    status: failed > 0 && completed === 0 ? 'failed' : 'completed',
    totalPages: finalCounts.total,
    downloadedPages: finalCounts.downloaded,
    sizeBytes: downloaded.bytes,
    error: failed > 0 ? `${failed} chapter downloads failed.` : null,
    startedAt,
    completedAt: nowSeconds(),
  });

  return { completed, failed, total: chapterIds.length };
}
