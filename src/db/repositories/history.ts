import { and, desc, eq } from 'drizzle-orm';

import type { HistoryEntry } from '@/models/story';
import { createId } from '@/utils/id';
import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { history } from '../schema';

type HistoryRow = typeof history.$inferSelect;

export type RecordHistoryInput = {
  sourceId: string;
  storyId: string;
  pageIndex: number;
  durationMs?: number | null;
  readAt?: number;
};

function toHistoryEntry(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    sourceId: row.sourceId,
    storyId: row.storyId,
    pageIndex: row.pageIndex,
    durationMs: row.durationMs,
    readAt: row.readAt,
  };
}

export const historyRepository = {
  async record(input: RecordHistoryInput): Promise<HistoryEntry> {
    const entry: HistoryEntry = {
      id: createId('hist'),
      sourceId: input.sourceId,
      storyId: input.storyId,
      pageIndex: input.pageIndex,
      durationMs: input.durationMs ?? null,
      readAt: input.readAt ?? nowSeconds(),
    };

    await db.insert(history).values(entry);
    return entry;
  },

  async listRecent(limit = 50): Promise<HistoryEntry[]> {
    const rows = await db.select().from(history).orderBy(desc(history.readAt)).limit(limit);
    return rows.map(toHistoryEntry);
  },

  async listAll(): Promise<HistoryEntry[]> {
    const rows = await db.select().from(history).orderBy(desc(history.readAt));
    return rows.map(toHistoryEntry);
  },

  /** Inserts or overwrites an entry by id (used by restore). */
  async upsert(entry: HistoryEntry): Promise<void> {
    const values = {
      id: entry.id,
      sourceId: entry.sourceId,
      storyId: entry.storyId,
      pageIndex: entry.pageIndex,
      durationMs: entry.durationMs ?? null,
      readAt: entry.readAt,
    };

    await db.insert(history).values(values).onConflictDoUpdate({ target: history.id, set: values });
  },

  async listForStory(sourceId: string, storyId: string, limit = 50): Promise<HistoryEntry[]> {
    const rows = await db
      .select()
      .from(history)
      .where(and(eq(history.sourceId, sourceId), eq(history.storyId, storyId)))
      .orderBy(desc(history.readAt))
      .limit(limit);
    return rows.map(toHistoryEntry);
  },

  async removeForStory(sourceId: string, storyId: string): Promise<void> {
    await db
      .delete(history)
      .where(and(eq(history.sourceId, sourceId), eq(history.storyId, storyId)));
  },

  async clear(): Promise<void> {
    await db.delete(history);
  },
};
