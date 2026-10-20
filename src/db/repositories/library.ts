import { and, desc, eq, sql } from 'drizzle-orm';

import type { LibraryEntry, ReadingProgress, Story } from '@/models/story';
import type { Novel } from '@/models/novel';
import type { ChapterCounts } from './chapters';
import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { toStory } from '../mappers/story';
import { chapterReads, chapters, libraryEntries, readingProgress, stories } from '../schema';
import { toNovel } from './novels';
import { toReadingProgress } from './progress';

type LibraryEntryRow = typeof libraryEntries.$inferSelect;

export type LibraryStory = {
  entry: LibraryEntry;
  story: Story | null;
};

export type LibraryNovel = {
  entry: LibraryEntry;
  novel: Novel | null;
  progress: ReadingProgress | null;
  counts: ChapterCounts;
};

function libraryKey(sourceId: string, storyId: string): string {
  return `${sourceId}\u0000${storyId}`;
}

function toLibraryEntry(row: LibraryEntryRow): LibraryEntry {
  return {
    sourceId: row.sourceId,
    storyId: row.storyId,
    addedAt: row.addedAt,
    sortOrder: row.sortOrder,
    lastReadAt: row.lastReadAt,
    isUnread: row.isUnread,
  };
}

export const libraryRepository = {
  async add(sourceId: string, storyId: string): Promise<void> {
    await db
      .insert(libraryEntries)
      .values({ sourceId, storyId, addedAt: nowSeconds() })
      .onConflictDoNothing();
  },

  async listEntries(): Promise<LibraryEntry[]> {
    const rows = await db.select().from(libraryEntries).orderBy(desc(libraryEntries.addedAt));
    return rows.map(toLibraryEntry);
  },

  /** Inserts or overwrites an entry, preserving its timestamps (used by restore). */
  async upsert(entry: LibraryEntry): Promise<void> {
    const values = {
      sourceId: entry.sourceId,
      storyId: entry.storyId,
      addedAt: entry.addedAt,
      sortOrder: entry.sortOrder ?? null,
      lastReadAt: entry.lastReadAt ?? null,
      isUnread: entry.isUnread,
    };

    await db
      .insert(libraryEntries)
      .values(values)
      .onConflictDoUpdate({
        target: [libraryEntries.sourceId, libraryEntries.storyId],
        set: values,
      });
  },

  async remove(sourceId: string, storyId: string): Promise<void> {
    await db
      .delete(libraryEntries)
      .where(and(eq(libraryEntries.sourceId, sourceId), eq(libraryEntries.storyId, storyId)));
  },

  async contains(sourceId: string, storyId: string): Promise<boolean> {
    const row = await db
      .select({ storyId: libraryEntries.storyId })
      .from(libraryEntries)
      .where(and(eq(libraryEntries.sourceId, sourceId), eq(libraryEntries.storyId, storyId)))
      .get();
    return Boolean(row);
  },

  async list(): Promise<LibraryStory[]> {
    const rows = await db
      .select({ entry: libraryEntries, story: stories })
      .from(libraryEntries)
      .leftJoin(
        stories,
        and(eq(stories.sourceId, libraryEntries.sourceId), eq(stories.id, libraryEntries.storyId)),
      )
      .orderBy(desc(libraryEntries.addedAt));

    return rows.map((row) => ({
      entry: toLibraryEntry(row.entry),
      story: row.story ? toStory(row.story) : null,
    }));
  },

  async listNovels(): Promise<LibraryNovel[]> {
    const rows = await db
      .select({ entry: libraryEntries, story: stories })
      .from(libraryEntries)
      .leftJoin(
        stories,
        and(eq(stories.sourceId, libraryEntries.sourceId), eq(stories.id, libraryEntries.storyId)),
      )
      .orderBy(desc(libraryEntries.lastReadAt), desc(libraryEntries.addedAt));

    const progressRows = await db.select().from(readingProgress);
    const progressByNovel = new Map<string, ReadingProgress>();
    for (const row of progressRows) {
      progressByNovel.set(libraryKey(row.sourceId, row.storyId), toReadingProgress(row));
    }

    const countRows = await db
      .select({
        sourceId: chapters.sourceId,
        novelId: chapters.novelId,
        total: sql<number>`count(*)`,
        downloaded: sql<number>`coalesce(sum(case when ${chapters.content} is not null then 1 else 0 end), 0)`,
        orphaned: sql<number>`coalesce(sum(case when ${chapters.orphaned} = 1 then 1 else 0 end), 0)`,
        read: sql<number>`coalesce(sum(case when ${chapterReads.chapterId} is not null then 1 else 0 end), 0)`,
      })
      .from(chapters)
      .leftJoin(
        chapterReads,
        and(
          eq(chapterReads.sourceId, chapters.sourceId),
          eq(chapterReads.novelId, chapters.novelId),
          eq(chapterReads.chapterId, chapters.id),
        ),
      )
      .groupBy(chapters.sourceId, chapters.novelId);

    const countsByNovel = new Map<string, ChapterCounts>();
    for (const row of countRows) {
      countsByNovel.set(libraryKey(row.sourceId, row.novelId), {
        total: Number(row.total),
        downloaded: Number(row.downloaded),
        orphaned: Number(row.orphaned),
        read: Number(row.read),
      });
    }

    return rows.map((row) => {
      const key = libraryKey(row.entry.sourceId, row.entry.storyId);
      return {
        entry: toLibraryEntry(row.entry),
        novel: row.story ? toNovel(row.story) : null,
        progress: progressByNovel.get(key) ?? null,
        counts: countsByNovel.get(key) ?? { total: 0, downloaded: 0, orphaned: 0, read: 0 },
      };
    });
  },

  async setUnread(sourceId: string, storyId: string, isUnread: boolean): Promise<void> {
    await db
      .update(libraryEntries)
      .set({ isUnread })
      .where(and(eq(libraryEntries.sourceId, sourceId), eq(libraryEntries.storyId, storyId)));
  },

  async markRead(sourceId: string, storyId: string): Promise<void> {
    await db
      .update(libraryEntries)
      .set({ isUnread: false, lastReadAt: nowSeconds() })
      .where(and(eq(libraryEntries.sourceId, sourceId), eq(libraryEntries.storyId, storyId)));
  },

  /**
   * Ensures the story is in the library and marks it read. Used when a story is
   * opened in the reader so downloads/read stories surface in the library.
   */
  async touch(sourceId: string, storyId: string): Promise<void> {
    const now = nowSeconds();
    await db
      .insert(libraryEntries)
      .values({ sourceId, storyId, addedAt: now, isUnread: false, lastReadAt: now })
      .onConflictDoUpdate({
        target: [libraryEntries.sourceId, libraryEntries.storyId],
        set: { isUnread: false, lastReadAt: now },
      });
  },

  async clear(): Promise<void> {
    await db.delete(libraryEntries);
  },
};
