import { and, eq, sql } from 'drizzle-orm';

import type { Novel, NovelStatus } from '@/models/novel';
import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { stories } from '../schema';

const WRITE_CHUNK = 20;

type StoryRow = typeof stories.$inferSelect;

export function toNovel(row: StoryRow): Novel {
  return {
    sourceId: row.sourceId,
    id: row.id,
    title: row.title,
    authorId: row.authorId,
    authorName: row.authorName,
    description: row.description,
    coverUrl: row.coverUrl,
    status: row.status as NovelStatus | null,
    genres: row.genres ?? [],
    stats: row.stats ?? null,
    chapterCount: row.chapterCount,
    wordCount: row.wordCount,
    rating: row.rating,
    lang: row.lang,
    url: row.url,
    fetchedAt: row.fetchedAt,
    updatedAt: row.updatedAt,
    chaptersSyncedAt: row.chaptersSyncedAt,
  };
}

function toValues(novel: Novel) {
  return {
    sourceId: novel.sourceId,
    id: novel.id,
    title: novel.title,
    authorId: novel.authorId ?? null,
    authorName: novel.authorName ?? null,
    description: novel.description ?? null,
    categoryId: null,
    categoryName: null,
    lang: novel.lang ?? null,
    url: novel.url ?? null,
    coverUrl: novel.coverUrl ?? null,
    rating: novel.rating ?? null,
    votes: null,
    views: null,
    wordCount: novel.wordCount ?? null,
    status: novel.status ?? null,
    genres: novel.genres ?? null,
    stats: novel.stats ?? null,
    chapterCount: novel.chapterCount ?? null,
    chaptersSyncedAt: novel.chaptersSyncedAt ?? null,
    updatedAt: novel.updatedAt ?? null,
    fetchedAt: novel.fetchedAt ?? nowSeconds(),
  };
}

function conflictSet() {
  return {
    title: sql`excluded.title`,
    authorId: sql`coalesce(excluded.author_id, ${stories.authorId})`,
    authorName: sql`coalesce(excluded.author_name, ${stories.authorName})`,
    description: sql`coalesce(excluded.description, ${stories.description})`,
    lang: sql`coalesce(excluded.lang, ${stories.lang})`,
    url: sql`coalesce(excluded.url, ${stories.url})`,
    coverUrl: sql`coalesce(excluded.cover_url, ${stories.coverUrl})`,
    rating: sql`coalesce(excluded.rating, ${stories.rating})`,
    wordCount: sql`coalesce(excluded.word_count, ${stories.wordCount})`,
    status: sql`coalesce(excluded.status, ${stories.status})`,
    genres: sql`coalesce(excluded.genres, ${stories.genres})`,
    stats: sql`coalesce(excluded.stats, ${stories.stats})`,
    chapterCount: sql`coalesce(excluded.chapter_count, ${stories.chapterCount})`,
    updatedAt: sql`coalesce(excluded.updated_at, ${stories.updatedAt})`,
    fetchedAt: sql`excluded.fetched_at`,
  };
}

export const novelRepository = {
  async upsert(novel: Novel): Promise<void> {
    const values = toValues(novel);
    await db
      .insert(stories)
      .values(values)
      .onConflictDoUpdate({
        target: [stories.sourceId, stories.id],
        set: conflictSet(),
      });
  },

  async upsertMany(list: Novel[]): Promise<void> {
    if (list.length === 0) return;

    for (let index = 0; index < list.length; index += WRITE_CHUNK) {
      const values = list.slice(index, index + WRITE_CHUNK).map(toValues);
      await db
        .insert(stories)
        .values(values)
        .onConflictDoUpdate({
          target: [stories.sourceId, stories.id],
          set: conflictSet(),
        });
    }
  },

  async get(sourceId: string, id: string): Promise<Novel | null> {
    const row = await db
      .select()
      .from(stories)
      .where(and(eq(stories.sourceId, sourceId), eq(stories.id, id)))
      .get();
    return row ? toNovel(row) : null;
  },

  async listByRefs(refs: { sourceId: string; id: string }[]): Promise<Novel[]> {
    if (refs.length === 0) return [];

    const results: Novel[] = [];
    for (let index = 0; index < refs.length; index += WRITE_CHUNK) {
      const chunk = refs.slice(index, index + WRITE_CHUNK);
      const rows = await db
        .select()
        .from(stories)
        .where(
          sql`(${stories.sourceId}, ${stories.id}) in (${sql.join(
            chunk.map((ref) => sql`(${ref.sourceId}, ${ref.id})`),
            sql`, `,
          )})`,
        );
      results.push(...rows.map(toNovel));
    }
    return results;
  },

  async markSynced(
    sourceId: string,
    id: string,
    chapterCount: number,
    syncedAt = nowSeconds(),
  ): Promise<void> {
    await db
      .update(stories)
      .set({ chaptersSyncedAt: syncedAt, chapterCount })
      .where(and(eq(stories.sourceId, sourceId), eq(stories.id, id)));
  },
};
