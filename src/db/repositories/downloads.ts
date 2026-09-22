import { and, asc, eq, inArray } from 'drizzle-orm';

import type { Download, DownloadStatus } from '@/models/story';
import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { downloads } from '../schema';

export type DownloadRow = typeof downloads.$inferSelect;

export type DownloadInput = Download;

function toDownload(row: DownloadRow): Download {
  return {
    sourceId: row.sourceId,
    storyId: row.storyId,
    status: row.status as DownloadStatus,
    totalPages: row.totalPages,
    downloadedPages: row.downloadedPages,
    sizeBytes: row.sizeBytes,
    path: row.path,
    error: row.error,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

export const downloadsRepository = {
  async list(): Promise<Download[]> {
    const rows = await db.select().from(downloads);
    return rows.map(toDownload);
  },

  async listByStatus(status: DownloadStatus): Promise<Download[]> {
    const rows = await db.select().from(downloads).where(eq(downloads.status, status));
    return rows.map(toDownload);
  },

  async listActiveOrCompleted(): Promise<Download[]> {
    const rows = await db
      .select()
      .from(downloads)
      .where(inArray(downloads.status, ['queued', 'downloading', 'paused', 'completed']));
    return rows.map(toDownload);
  },

  /** Returns the oldest queued download, i.e. the next item to process. */
  async nextQueued(): Promise<Download | null> {
    const row = await db
      .select()
      .from(downloads)
      .where(eq(downloads.status, 'queued'))
      .orderBy(asc(downloads.startedAt))
      .limit(1)
      .get();
    return row ? toDownload(row) : null;
  },

  async get(sourceId: string, storyId: string): Promise<Download | null> {
    const row = await db
      .select()
      .from(downloads)
      .where(and(eq(downloads.sourceId, sourceId), eq(downloads.storyId, storyId)))
      .get();
    return row ? toDownload(row) : null;
  },

  async upsert(input: DownloadInput): Promise<void> {
    const values = {
      sourceId: input.sourceId,
      storyId: input.storyId,
      status: input.status,
      totalPages: input.totalPages ?? null,
      downloadedPages: input.downloadedPages,
      sizeBytes: input.sizeBytes ?? null,
      path: input.path ?? null,
      error: input.error ?? null,
      startedAt: input.startedAt ?? nowSeconds(),
      completedAt: input.completedAt ?? null,
    };

    await db
      .insert(downloads)
      .values(values)
      .onConflictDoUpdate({
        target: [downloads.sourceId, downloads.storyId],
        set: values,
      });
  },

  async remove(sourceId: string, storyId: string): Promise<void> {
    await db
      .delete(downloads)
      .where(and(eq(downloads.sourceId, sourceId), eq(downloads.storyId, storyId)));
  },

  async clearCompleted(): Promise<void> {
    await db.delete(downloads).where(eq(downloads.status, 'completed'));
  },

  async count(): Promise<number> {
    const rows = await db.select({ storyId: downloads.storyId }).from(downloads);
    return rows.length;
  },
};
