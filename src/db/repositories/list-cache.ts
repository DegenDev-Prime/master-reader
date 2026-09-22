import { and, eq, isNotNull, lt } from 'drizzle-orm';

import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { sourceListCache } from '../schema';

export type ListCacheRow = typeof sourceListCache.$inferSelect;

export type ListCacheInput = {
  sourceId: string;
  kind: string;
  page: number;
  paramsHash: string;
  storyRefs: string[];
  total?: number | null;
  /** unix seconds; null means always stale. */
  expiresAt?: number | null;
};

export function listCacheId(
  sourceId: string,
  kind: string,
  page: number,
  paramsHash: string,
): string {
  return `${sourceId}:${kind}:${page}:${paramsHash}`;
}

export const listCacheRepository = {
  async get(
    sourceId: string,
    kind: string,
    page: number,
    paramsHash: string,
  ): Promise<ListCacheRow | undefined> {
    return db
      .select()
      .from(sourceListCache)
      .where(
        and(
          eq(sourceListCache.sourceId, sourceId),
          eq(sourceListCache.kind, kind),
          eq(sourceListCache.page, page),
          eq(sourceListCache.paramsHash, paramsHash),
        ),
      )
      .get();
  },

  async set(entry: ListCacheInput): Promise<void> {
    const values = {
      id: listCacheId(entry.sourceId, entry.kind, entry.page, entry.paramsHash),
      sourceId: entry.sourceId,
      kind: entry.kind,
      page: entry.page,
      paramsHash: entry.paramsHash,
      storyRefs: entry.storyRefs,
      total: entry.total ?? null,
      fetchedAt: nowSeconds(),
      expiresAt: entry.expiresAt ?? null,
    };

    await db
      .insert(sourceListCache)
      .values(values)
      .onConflictDoUpdate({ target: sourceListCache.id, set: values });
  },

  async deleteExpired(now = nowSeconds()): Promise<void> {
    await db
      .delete(sourceListCache)
      .where(and(isNotNull(sourceListCache.expiresAt), lt(sourceListCache.expiresAt, now)));
  },

  async clear(): Promise<void> {
    await db.delete(sourceListCache);
  },

  async count(): Promise<number> {
    const rows = await db.select({ id: sourceListCache.id }).from(sourceListCache);
    return rows.length;
  },
};
