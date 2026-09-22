import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import type { Story } from '@/models/story';

import { db } from '../client';
import { toStory, toStoryRow, type StoryRow } from '../mappers/story';
import { stories } from '../schema';

export type { StoryRow, NewStoryRow } from '../mappers/story';

export const storiesRepository = {
  async upsert(story: Story): Promise<void> {
    const values = toStoryRow(story);
    await db
      .insert(stories)
      .values(values)
      .onConflictDoUpdate({ target: [stories.sourceId, stories.id], set: values });
  },

  async upsertMany(list: Story[]): Promise<void> {
    for (const story of list) {
      await this.upsert(story);
    }
  },

  async getRow(sourceId: string, id: string): Promise<StoryRow | undefined> {
    return db
      .select()
      .from(stories)
      .where(and(eq(stories.sourceId, sourceId), eq(stories.id, id)))
      .get();
  },

  async get(sourceId: string, id: string): Promise<Story | null> {
    const row = await this.getRow(sourceId, id);
    return row ? toStory(row) : null;
  },

  async listByIds(sourceId: string, ids: string[]): Promise<Story[]> {
    if (ids.length === 0) return [];
    const rows = await db
      .select()
      .from(stories)
      .where(and(eq(stories.sourceId, sourceId), inArray(stories.id, ids)));
    return rows.map(toStory);
  },

  async listByAuthor(sourceId: string, authorId: string, limit = 50): Promise<Story[]> {
    const rows = await db
      .select()
      .from(stories)
      .where(and(eq(stories.sourceId, sourceId), eq(stories.authorId, authorId)))
      .orderBy(desc(stories.publishedAt))
      .limit(limit);
    return rows.map(toStory);
  },

  async listBySeries(sourceId: string, seriesId: string): Promise<Story[]> {
    const rows = await db
      .select()
      .from(stories)
      .where(and(eq(stories.sourceId, sourceId), eq(stories.seriesId, seriesId)))
      .orderBy(asc(stories.seriesPosition), asc(stories.title));
    return rows.map(toStory);
  },

  async remove(sourceId: string, id: string): Promise<void> {
    await db.delete(stories).where(and(eq(stories.sourceId, sourceId), eq(stories.id, id)));
  },
};
