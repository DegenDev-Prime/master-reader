import { cacheRepository } from '@/db/repositories';
import type { CachedResponse, ResponseCacheStore } from '@/sources/transport';

/**
 * SQLite-backed HTTP response cache. The transport works in milliseconds while
 * the table stores unix seconds, so values are converted at this boundary.
 */
export const responseCache: ResponseCacheStore = {
  async get(key: string): Promise<CachedResponse | null> {
    const row = await cacheRepository.get(key);
    if (!row || row.body === null || row.body === undefined) return null;

    return {
      status: row.status ?? 200,
      body: row.body,
      etag: row.etag,
      lastModified: row.lastModified,
      expiresAt: row.expiresAt !== null ? row.expiresAt * 1000 : null,
    };
  },

  async set(key: string, response: CachedResponse): Promise<void> {
    await cacheRepository.set({
      key,
      status: response.status,
      etag: response.etag ?? null,
      lastModified: response.lastModified ?? null,
      body: response.body,
      expiresAt: response.expiresAt != null ? Math.floor(response.expiresAt / 1000) : null,
    });
  },
};
