import { HttpClient, type FetchLike, type ResponseCacheStore } from '../transport';
import type { SourceInfo } from '../types';
import { ArchiveSource, type ArchiveSourceOptions } from './source';

export const KEMONO_SOURCE_ID = 'kemono';
export const KEMONO_API_BASE = 'https://kemono.cr/api/v1';
export const KEMONO_SITE_BASE = 'https://kemono.cr';

export const KEMONO_SERVICES = [
  'patreon',
  'fanbox',
  'discord',
  'fantia',
  'afdian',
  'boosty',
  'dlsite',
  'gumroad',
  'subscribestar',
];

export const KEMONO_SOURCE_INFO: SourceInfo = {
  id: KEMONO_SOURCE_ID,
  name: 'Kemono',
  lang: 'en',
  baseUrl: KEMONO_SITE_BASE,
  capabilities: ['popular', 'latest', 'search', 'categories'],
};

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

export type KemonoSourceOptions = {
  userAgent?: string;
  fetch?: FetchLike;
  http?: HttpClient;
  cache?: ResponseCacheStore;
  isOffline?: () => boolean;
  cacheTtlMs?: number;
};

/**
 * Kemono archives creator posts behind the same API shape as Pawchive, with
 * two differences: a creator's post list is suffixed with `/posts`, and a
 * single post arrives wrapped in an object.
 */
export class KemonoSource extends ArchiveSource {
  constructor(options: KemonoSourceOptions = {}) {
    const http =
      options.http ??
      new HttpClient({
        baseUrl: KEMONO_API_BASE,
        userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
        defaultHeaders: { accept: 'text/css' },
        fetch: options.fetch,
        retries: 2,
        timeoutMs: 30_000,
        cache: options.cache,
        isOffline: options.isOffline,
        cacheTtlMs: options.cacheTtlMs,
      });

    super({
      variant: {
        apiBase: KEMONO_API_BASE,
        siteBase: KEMONO_SITE_BASE,
        thumbnailBase: null,
        creatorPostsSuffix: '/posts',
        wrapsPost: true,
      },
      fetchJson: (path, query) => http.get(path, { query }),
      info: KEMONO_SOURCE_INFO,
      services: KEMONO_SERVICES,
    } satisfies ArchiveSourceOptions);
  }
}

export function createKemonoSource(options?: KemonoSourceOptions): KemonoSource {
  return new KemonoSource(options);
}
