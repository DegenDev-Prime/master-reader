import { and, desc, eq } from 'drizzle-orm';

import type { LibraryEntry, Story } from '@/models/story';
import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { toStory } from '../mappers/story';
import { libraryEntries, stories } from '../schema';

type LibraryEntryRow = typeof libraryEntries.$inferSelect;

export type LibraryStory = {
  entry: LibraryEntry;
  story: Story | null;
};

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
