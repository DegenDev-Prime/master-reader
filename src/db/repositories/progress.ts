import { and, eq } from 'drizzle-orm';

import type { ReadingProgress } from '@/models/story';
import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { readingProgress } from '../schema';

type ProgressRow = typeof readingProgress.$inferSelect;

export type SaveProgressInput = {
  sourceId: string;
  storyId: string;
  pageIndex: number;
  chapterId?: string | null;
  paragraphIndex?: number | null;
  charOffset?: number | null;
  pageCount?: number | null;
  scrollPct?: number;
  readPages?: number[];
};

export function toReadingProgress(row: ProgressRow): ReadingProgress {
  return {
    sourceId: row.sourceId,
    storyId: row.storyId,
    pageIndex: row.pageIndex,
    chapterId: row.chapterId,
    paragraphIndex: row.paragraphIndex,
    charOffset: row.charOffset,
    pageCount: row.pageCount,
    scrollPct: row.scrollPct,
    readPages: row.readPages ?? [],
    updatedAt: row.updatedAt,
  };
}

export const progressRepository = {
  async get(sourceId: string, storyId: string): Promise<ReadingProgress | null> {
    const row = await db
      .select()
      .from(readingProgress)
      .where(and(eq(readingProgress.sourceId, sourceId), eq(readingProgress.storyId, storyId)))
      .get();
    return row ? toReadingProgress(row) : null;
  },

  async listAll(): Promise<ReadingProgress[]> {
    const rows = await db.select().from(readingProgress);
    return rows.map(toReadingProgress);
  },

  async save(input: SaveProgressInput): Promise<ReadingProgress> {
    const updatedAt = nowSeconds();
    const values = {
      sourceId: input.sourceId,
      storyId: input.storyId,
      pageIndex: input.pageIndex,
      chapterId: input.chapterId ?? null,
      paragraphIndex: input.paragraphIndex ?? null,
      charOffset: input.charOffset ?? null,
      pageCount: input.pageCount ?? null,
      scrollPct: input.scrollPct ?? 0,
      readPages: input.readPages ?? [],
      updatedAt,
    };

    await db
      .insert(readingProgress)
      .values(values)
      .onConflictDoUpdate({
        target: [readingProgress.sourceId, readingProgress.storyId],
        set: values,
      });

    return {
      sourceId: values.sourceId,
      storyId: values.storyId,
      pageIndex: values.pageIndex,
      chapterId: values.chapterId,
      paragraphIndex: values.paragraphIndex,
      charOffset: values.charOffset,
      pageCount: values.pageCount,
      scrollPct: values.scrollPct,
      readPages: values.readPages,
      updatedAt,
    };
  },

  async remove(sourceId: string, storyId: string): Promise<void> {
    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.sourceId, sourceId), eq(readingProgress.storyId, storyId)));
  },

  /** Inserts or overwrites a progress record, preserving `updatedAt` (used by restore). */
  async upsert(progress: ReadingProgress): Promise<void> {
    const values = {
      sourceId: progress.sourceId,
      storyId: progress.storyId,
      pageIndex: progress.pageIndex,
      chapterId: progress.chapterId ?? null,
      paragraphIndex: progress.paragraphIndex ?? null,
      charOffset: progress.charOffset ?? null,
      pageCount: progress.pageCount ?? null,
      scrollPct: progress.scrollPct,
      readPages: progress.readPages ?? [],
      updatedAt: progress.updatedAt,
    };

    await db
      .insert(readingProgress)
      .values(values)
      .onConflictDoUpdate({
        target: [readingProgress.sourceId, readingProgress.storyId],
        set: values,
      });
  },

  async clear(): Promise<void> {
    await db.delete(readingProgress);
  },
};
