import { and, desc, eq } from 'drizzle-orm';

import type { NarrationBookmark, NarrationProgress } from '@/narration/types';
import { createId } from '@/utils/id';
import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { narrationBookmarks, narrationState } from '../schema';

type NarrationStateRow = typeof narrationState.$inferSelect;
type NarrationBookmarkRow = typeof narrationBookmarks.$inferSelect;

function toProgress(row: NarrationStateRow): NarrationProgress {
  return {
    sourceId: row.sourceId,
    storyId: row.storyId,
    engine: row.engine,
    voiceId: row.voiceId,
    speed: row.speed,
    chunkIndex: row.chunkIndex,
    charOffset: row.charOffset,
    updatedAt: row.updatedAt,
  };
}

function toBookmark(row: NarrationBookmarkRow): NarrationBookmark {
  return {
    id: row.id,
    sourceId: row.sourceId,
    storyId: row.storyId,
    chunkIndex: row.chunkIndex,
    label: row.label,
    createdAt: row.createdAt,
  };
}

export type SaveNarrationStateInput = {
  sourceId: string;
  storyId: string;
  engine: string;
  voiceId?: string | null;
  speed: number;
  chunkIndex: number;
  charOffset?: number;
};

export const narrationRepository = {
  async get(sourceId: string, storyId: string): Promise<NarrationProgress | null> {
    const row = await db
      .select()
      .from(narrationState)
      .where(and(eq(narrationState.sourceId, sourceId), eq(narrationState.storyId, storyId)))
      .get();
    return row ? toProgress(row) : null;
  },

  async save(input: SaveNarrationStateInput): Promise<void> {
    const values = {
      sourceId: input.sourceId,
      storyId: input.storyId,
      engine: input.engine,
      voiceId: input.voiceId ?? null,
      speed: input.speed,
      chunkIndex: input.chunkIndex,
      charOffset: input.charOffset ?? 0,
      updatedAt: nowSeconds(),
    };
    await db
      .insert(narrationState)
      .values(values)
      .onConflictDoUpdate({
        target: [narrationState.sourceId, narrationState.storyId],
        set: values,
      });
  },

  async remove(sourceId: string, storyId: string): Promise<void> {
    await db
      .delete(narrationState)
      .where(and(eq(narrationState.sourceId, sourceId), eq(narrationState.storyId, storyId)));
  },

  async listAll(): Promise<NarrationProgress[]> {
    const rows = await db.select().from(narrationState);
    return rows.map(toProgress);
  },

  /** Most recently touched narration session, for the audio tab's last memory. */
  async lastPlayed(): Promise<NarrationProgress | null> {
    const row = await db
      .select()
      .from(narrationState)
      .orderBy(desc(narrationState.updatedAt))
      .limit(1)
      .get();
    return row ? toProgress(row) : null;
  },

  async clear(): Promise<void> {
    await db.delete(narrationState);
  },
};

export const narrationBookmarksRepository = {
  async add(
    sourceId: string,
    storyId: string,
    chunkIndex: number,
    label?: string | null,
  ): Promise<NarrationBookmark> {
    const entry: NarrationBookmark = {
      id: createId('nbm'),
      sourceId,
      storyId,
      chunkIndex,
      label: label ?? null,
      createdAt: nowSeconds(),
    };
    await db.insert(narrationBookmarks).values(entry);
    return entry;
  },

  async listForStory(sourceId: string, storyId: string): Promise<NarrationBookmark[]> {
    const rows = await db
      .select()
      .from(narrationBookmarks)
      .where(
        and(eq(narrationBookmarks.sourceId, sourceId), eq(narrationBookmarks.storyId, storyId)),
      )
      .orderBy(desc(narrationBookmarks.createdAt));
    return rows.map(toBookmark);
  },

  async remove(id: string): Promise<void> {
    await db.delete(narrationBookmarks).where(eq(narrationBookmarks.id, id));
  },

  /** Inserts or overwrites a bookmark by id (used by restore). */
  async upsert(entry: NarrationBookmark): Promise<void> {
    await db
      .insert(narrationBookmarks)
      .values(entry)
      .onConflictDoUpdate({ target: narrationBookmarks.id, set: entry });
  },

  async removeForStory(sourceId: string, storyId: string): Promise<void> {
    await db
      .delete(narrationBookmarks)
      .where(
        and(eq(narrationBookmarks.sourceId, sourceId), eq(narrationBookmarks.storyId, storyId)),
      );
  },

  async listAll(): Promise<NarrationBookmark[]> {
    const rows = await db.select().from(narrationBookmarks);
    return rows.map(toBookmark);
  },

  async clear(): Promise<void> {
    await db.delete(narrationBookmarks);
  },
};
