import { and, asc, eq } from 'drizzle-orm';

import type { StoryPage } from '@/models/story';

import { db } from '../client';
import { pages } from '../schema';

function toRow(page: StoryPage) {
  return {
    sourceId: page.sourceId,
    storyId: page.storyId,
    index: page.index,
    title: page.title ?? null,
    content: page.content ?? null,
    wordCount: page.wordCount ?? null,
  };
}

export const pagesRepository = {
  async upsertMany(list: StoryPage[]): Promise<void> {
    for (const page of list) {
      const values = toRow(page);
      await db
        .insert(pages)
        .values(values)
        .onConflictDoUpdate({
          target: [pages.sourceId, pages.storyId, pages.index],
          set: values,
        });
    }
  },

  async listForStory(sourceId: string, storyId: string): Promise<StoryPage[]> {
    const rows = await db
      .select()
      .from(pages)
      .where(and(eq(pages.sourceId, sourceId), eq(pages.storyId, storyId)))
      .orderBy(asc(pages.index));

    return rows.map((row) => ({
      sourceId: row.sourceId,
      storyId: row.storyId,
      index: row.index,
      title: row.title,
      content: row.content,
      wordCount: row.wordCount,
    }));
  },

  async count(sourceId: string, storyId: string): Promise<number> {
    const rows = await db
      .select({ index: pages.index })
      .from(pages)
      .where(and(eq(pages.sourceId, sourceId), eq(pages.storyId, storyId)));
    return rows.length;
  },

  async remove(sourceId: string, storyId: string): Promise<void> {
    await db.delete(pages).where(and(eq(pages.sourceId, sourceId), eq(pages.storyId, storyId)));
  },
};
