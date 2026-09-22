export type CachedResponse = {
  status: number;
  body: string;
  etag?: string | null;
  lastModified?: string | null;
  /** unix milliseconds; null means the entry is always considered stale. */
  expiresAt?: number | null;
};

/**
 * Storage abstraction the HTTP client uses to cache GET responses. Implemented
 * in the app by a SQLite-backed store; tests use the in-memory version.
 */
export interface ResponseCacheStore {
  get(key: string): Promise<CachedResponse | null>;
  set(key: string, response: CachedResponse): Promise<void>;
}

export class InMemoryResponseCache implements ResponseCacheStore {
  private readonly entries = new Map<string, CachedResponse>();

  async get(key: string): Promise<CachedResponse | null> {
    return this.entries.get(key) ?? null;
  }

  async set(key: string, response: CachedResponse): Promise<void> {
    this.entries.set(key, response);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

export function isFresh(entry: CachedResponse, now = Date.now()): boolean {
  return entry.expiresAt !== null && entry.expiresAt !== undefined && entry.expiresAt > now;
}

export function parseMaxAgeMs(cacheControl: string | null | undefined): number | null {
  if (!cacheControl) return null;
  const match = /(?:^|,)\s*(?:s-maxage|max-age)=(\d+)/i.exec(cacheControl);
  return match ? Number(match[1]) * 1000 : null;
}

export function cacheDirective(
  headers: Headers,
  now = Date.now(),
  defaultTtlMs = DEFAULT_CACHE_TTL_MS,
): { store: boolean; expiresAt: number | null } {
  const cacheControl = headers.get('cache-control');
  if (cacheControl && /(?:^|,)\s*no-store/i.test(cacheControl)) {
    return { store: false, expiresAt: null };
  }
  const ttl = parseMaxAgeMs(cacheControl) ?? defaultTtlMs;
  return { store: true, expiresAt: now + ttl };
}
