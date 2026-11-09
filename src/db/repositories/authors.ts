import { and, eq, sql } from 'drizzle-orm';

import type { Author } from '@/models/author';
import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { authors } from '../schema';

type AuthorRow = typeof authors.$inferSelect;

function toAuthor(row: AuthorRow): Author {
  return {
    sourceId: row.sourceId,
    id: row.id,
    name: row.name,
    url: row.url,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    followers: row.followers,
    worksCount: row.worksCount,
    wordCount: row.wordCount,
    fetchedAt: row.fetchedAt,
    raw: null,
  };
}

export const authorsRepository = {
  async upsert(author: Author): Promise<void> {
    const values = {
      sourceId: author.sourceId,
      id: author.id,
      name: author.name,
      url: author.url ?? null,
      avatarUrl: author.avatarUrl ?? null,
      bio: author.bio ?? null,
      followers: author.followers ?? null,
      worksCount: author.worksCount ?? null,
      wordCount: author.wordCount ?? null,
      fetchedAt: author.fetchedAt ?? nowSeconds(),
    };
    await db
      .insert(authors)
      .values(values)
      .onConflictDoUpdate({
        target: [authors.sourceId, authors.id],
        set: {
          ...values,
          bio: sql`coalesce(excluded.bio, ${authors.bio})`,
          avatarUrl: sql`coalesce(excluded.avatar_url, ${authors.avatarUrl})`,
          followers: sql`coalesce(excluded.followers, ${authors.followers})`,
          worksCount: sql`coalesce(excluded.works_count, ${authors.worksCount})`,
          wordCount: sql`coalesce(excluded.word_count, ${authors.wordCount})`,
        },
      });
  },

  async get(sourceId: string, id: string): Promise<Author | null> {
    const row = await db
      .select()
      .from(authors)
      .where(and(eq(authors.sourceId, sourceId), eq(authors.id, id)))
      .get();
    return row ? toAuthor(row) : null;
  },
};
