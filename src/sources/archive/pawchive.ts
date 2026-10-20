import { HttpClient, type FetchLike, type ResponseCacheStore } from '../transport';
import type { SourceInfo } from '../types';
import { ArchiveSource, type ArchiveSourceOptions } from './source';

export const PAWCHIVE_SOURCE_ID = 'pawchive';
export const PAWCHIVE_API_BASE = 'https://pawchive.pw/api/v1';
export const PAWCHIVE_SITE_BASE = 'https://pawchive.pw';
export const PAWCHIVE_THUMBNAIL_BASE = 'https://img.pawchive.pw/thumbnail';

export const PAWCHIVE_SERVICES = [
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

export const PAWCHIVE_SOURCE_INFO: SourceInfo = {
  id: PAWCHIVE_SOURCE_ID,
  name: 'Pawchive',
  lang: 'en',
  baseUrl: PAWCHIVE_SITE_BASE,
  capabilities: ['popular', 'latest', 'search', 'categories'],
};

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

export type PawchiveSourceOptions = {
  userAgent?: string;
  fetch?: FetchLike;
  http?: HttpClient;
  cache?: ResponseCacheStore;
  isOffline?: () => boolean;
  cacheTtlMs?: number;
};

/**
 * Pawchive is a public archive of creator posts. Its API answers with JSON
 * only when the request asks for `text/css`, which is what the archive's own
 * clients do.
 */
export class PawchiveSource extends ArchiveSource {
  constructor(options: PawchiveSourceOptions = {}) {
    const http =
      options.http ??
      new HttpClient({
        baseUrl: PAWCHIVE_API_BASE,
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
        apiBase: PAWCHIVE_API_BASE,
        siteBase: PAWCHIVE_SITE_BASE,
        thumbnailBase: PAWCHIVE_THUMBNAIL_BASE,
        creatorPostsSuffix: '',
        wrapsPost: false,
      },
      fetchJson: (path, query) => http.get(path, { query }),
      info: PAWCHIVE_SOURCE_INFO,
      services: PAWCHIVE_SERVICES,
    } satisfies ArchiveSourceOptions);
  }
}

export function createPawchiveSource(options?: PawchiveSourceOptions): PawchiveSource {
  return new PawchiveSource(options);
}
