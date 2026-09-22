import { and, eq, isNotNull, lt } from 'drizzle-orm';

import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { cachedResponses } from '../schema';

export type CachedResponseRow = typeof cachedResponses.$inferSelect;

export type CacheEntryInput = {
  key: string;
  sourceId?: string | null;
  status?: number | null;
  etag?: string | null;
  lastModified?: string | null;
  body: string;
  /** unix seconds; null means always stale. */
  expiresAt?: number | null;
};

export const cacheRepository = {
  async get(key: string): Promise<CachedResponseRow | undefined> {
    return db.select().from(cachedResponses).where(eq(cachedResponses.key, key)).get();
  },

  async set(entry: CacheEntryInput): Promise<void> {
    const values = {
      key: entry.key,
      sourceId: entry.sourceId ?? null,
      status: entry.status ?? null,
      etag: entry.etag ?? null,
      lastModified: entry.lastModified ?? null,
      body: entry.body,
      fetchedAt: nowSeconds(),
      expiresAt: entry.expiresAt ?? null,
    };

    await db
      .insert(cachedResponses)
      .values(values)
      .onConflictDoUpdate({ target: cachedResponses.key, set: values });
  },

  async deleteExpired(now = nowSeconds()): Promise<void> {
    await db
      .delete(cachedResponses)
      .where(and(isNotNull(cachedResponses.expiresAt), lt(cachedResponses.expiresAt, now)));
  },

  async clear(): Promise<void> {
    await db.delete(cachedResponses);
  },

  async count(): Promise<number> {
    const rows = await db.select({ key: cachedResponses.key }).from(cachedResponses);
    return rows.length;
  },
};
