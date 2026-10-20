import { and, eq, inArray, sql } from 'drizzle-orm';

import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { chapterDownloads } from '../schema';

export type ChapterDownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed';

export type ChapterDownload = {
  sourceId: string;
  novelId: string;
  chapterId: string;
  status: ChapterDownloadStatus;
  error: string | null;
  bytes: number | null;
  updatedAt: number;
};

type ChapterDownloadRow = typeof chapterDownloads.$inferSelect;

function toChapterDownload(row: ChapterDownloadRow): ChapterDownload {
  return {
    sourceId: row.sourceId,
    novelId: row.novelId,
    chapterId: row.chapterId,
    status: row.status as ChapterDownloadStatus,
    error: row.error,
    bytes: row.bytes,
    updatedAt: row.updatedAt,
  };
}

export const chapterDownloadsRepository = {
  async setStatus(
    sourceId: string,
    novelId: string,
    chapterId: string,
    status: ChapterDownloadStatus,
    options: { bytes?: number | null; error?: string | null } = {},
  ): Promise<void> {
    const values = {
      sourceId,
      novelId,
      chapterId,
      status,
      bytes: options.bytes ?? null,
      error: options.error ?? null,
      updatedAt: nowSeconds(),
    };

    await db
      .insert(chapterDownloads)
      .values(values)
      .onConflictDoUpdate({
        target: [chapterDownloads.sourceId, chapterDownloads.novelId, chapterDownloads.chapterId],
        set: {
          status: values.status,
          bytes: values.bytes,
          error: values.error,
          updatedAt: values.updatedAt,
        },
      });
  },

  async listForNovel(sourceId: string, novelId: string): Promise<ChapterDownload[]> {
    const rows = await db
      .select()
      .from(chapterDownloads)
      .where(and(eq(chapterDownloads.sourceId, sourceId), eq(chapterDownloads.novelId, novelId)));
    return rows.map(toChapterDownload);
  },

  async statusMap(sourceId: string, novelId: string): Promise<Map<string, ChapterDownload>> {
    const rows = await this.listForNovel(sourceId, novelId);
    return new Map(rows.map((row) => [row.chapterId, row]));
  },

  async remove(sourceId: string, novelId: string, chapterIds?: string[]): Promise<void> {
    if (chapterIds && chapterIds.length === 0) return;
    const conditions = [
      eq(chapterDownloads.sourceId, sourceId),
      eq(chapterDownloads.novelId, novelId),
    ];
    if (chapterIds) {
      conditions.push(inArray(chapterDownloads.chapterId, chapterIds));
    }
    await db.delete(chapterDownloads).where(and(...conditions));
  },

  async counts(
    sourceId: string,
    novelId: string,
  ): Promise<{
    completed: number;
    failed: number;
    bytes: number;
  }> {
    const row = await db
      .select({
        completed: sql<number>`coalesce(sum(case when ${chapterDownloads.status} = 'completed' then 1 else 0 end), 0)`,
        failed: sql<number>`coalesce(sum(case when ${chapterDownloads.status} = 'failed' then 1 else 0 end), 0)`,
        bytes: sql<number>`coalesce(sum(${chapterDownloads.bytes}), 0)`,
      })
      .from(chapterDownloads)
      .where(and(eq(chapterDownloads.sourceId, sourceId), eq(chapterDownloads.novelId, novelId)))
      .get();
    return {
      completed: Number(row?.completed ?? 0),
      failed: Number(row?.failed ?? 0),
      bytes: Number(row?.bytes ?? 0),
    };
  },
};
