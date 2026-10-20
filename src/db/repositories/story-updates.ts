import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { storyUpdates } from '../schema';

export type StoryUpdateRow = typeof storyUpdates.$inferSelect;

export type StoryUpdateInput = {
  sourceId: string;
  novelId: string;
  chapterId: string;
  chapterTitle?: string | null;
};

export type StoryUpdateGroup = {
  sourceId: string;
  novelId: string;
  /** Newest first. */
  chapters: { id: string; title: string | null; createdAt: number }[];
  count: number;
  /** Newest update time in the group. */
  updatedAt: number;
  unseen: number;
};

function updateId(sourceId: string, novelId: string, chapterId: string): string {
  return `${sourceId}::${novelId}::${chapterId}`;
}

export const storyUpdatesRepository = {
  /** Records newly discovered chapters; already-known chapters are ignored. */
  async record(items: StoryUpdateInput[]): Promise<number> {
    if (items.length === 0) return 0;

    const now = nowSeconds();
    const values = items.map((item) => ({
      id: updateId(item.sourceId, item.novelId, item.chapterId),
      sourceId: item.sourceId,
      novelId: item.novelId,
      chapterId: item.chapterId,
      chapterTitle: item.chapterTitle ?? null,
      createdAt: now,
      seenAt: null,
    }));

    await db.insert(storyUpdates).values(values).onConflictDoNothing({ target: storyUpdates.id });

    return values.length;
  },

  async list(options: { unseenOnly?: boolean; limit?: number } = {}): Promise<StoryUpdateRow[]> {
    const conditions = options.unseenOnly ? [isNull(storyUpdates.seenAt)] : [];
    const query = db
      .select()
      .from(storyUpdates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(storyUpdates.createdAt));
    return options.limit ? query.limit(options.limit) : query;
  },

  /** Groups updates per novel, newest group first. */
  async listGroups(options: { unseenOnly?: boolean } = {}): Promise<StoryUpdateGroup[]> {
    const rows = await this.list(options);
    const groups = new Map<string, StoryUpdateGroup>();

    for (const row of rows) {
      const key = `${row.sourceId}::${row.novelId}`;
      const existing = groups.get(key);
      if (existing) {
        existing.chapters.push({
          id: row.chapterId,
          title: row.chapterTitle,
          createdAt: row.createdAt,
        });
        existing.count += 1;
        existing.updatedAt = Math.max(existing.updatedAt, row.createdAt);
        if (row.seenAt == null) existing.unseen += 1;
        continue;
      }
      groups.set(key, {
        sourceId: row.sourceId,
        novelId: row.novelId,
        chapters: [{ id: row.chapterId, title: row.chapterTitle, createdAt: row.createdAt }],
        count: 1,
        updatedAt: row.createdAt,
        unseen: row.seenAt == null ? 1 : 0,
      });
    }

    return [...groups.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async markSeen(sourceId: string, novelId: string): Promise<void> {
    await db
      .update(storyUpdates)
      .set({ seenAt: nowSeconds() })
      .where(
        and(
          eq(storyUpdates.sourceId, sourceId),
          eq(storyUpdates.novelId, novelId),
          isNull(storyUpdates.seenAt),
        ),
      );
  },

  async markAllSeen(): Promise<void> {
    await db.update(storyUpdates).set({ seenAt: nowSeconds() }).where(isNull(storyUpdates.seenAt));
  },

  async countUnseen(): Promise<number> {
    const row = await db
      .select({ count: sql<number>`count(*)` })
      .from(storyUpdates)
      .where(isNull(storyUpdates.seenAt))
      .get();
    return row?.count ?? 0;
  },

  async removeForNovel(sourceId: string, novelId: string): Promise<void> {
    await db
      .delete(storyUpdates)
      .where(and(eq(storyUpdates.sourceId, sourceId), eq(storyUpdates.novelId, novelId)));
  },

  async removeForNovels(refs: { sourceId: string; novelId: string }[]): Promise<void> {
    if (refs.length === 0) return;
    for (const ref of refs) {
      await this.removeForNovel(ref.sourceId, ref.novelId);
    }
  },

  async listNovelIds(sourceIds: string[]): Promise<string[]> {
    if (sourceIds.length === 0) return [];
    const rows = await db
      .selectDistinct({ novelId: storyUpdates.novelId })
      .from(storyUpdates)
      .where(inArray(storyUpdates.sourceId, sourceIds));
    return rows.map((row) => row.novelId);
  },
};
