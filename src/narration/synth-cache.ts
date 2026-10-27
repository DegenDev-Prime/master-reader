export const SYNTH_CACHE_CAP_BYTES = 100 * 1024 * 1024;

export type CacheEntry = { bytes: number; accessedAt: number };
export type CacheIndex = Record<string, CacheEntry>;

/** Stable pre-hash input so cache keys never depend on playback settings. */
export function synthCacheKeyInput(engine: string, voiceId: string, text: string): string {
  return `${engine}|${voiceId}|${text}`;
}

export function cacheFileName(key: string): string {
  return `${key}.wav`;
}

/** Pure LRU selection: keys to delete so `incomingBytes` fits under `capBytes`. */
export function selectEvictions(
  index: CacheIndex,
  incomingBytes: number,
  capBytes: number,
): string[] {
  const entries = Object.entries(index).sort((a, b) => a[1].accessedAt - b[1].accessedAt);
  const total = entries.reduce((sum, [, entry]) => sum + entry.bytes, 0);
  let freed = 0;
  const evict: string[] = [];
  for (const [key, entry] of entries) {
    if (total - freed + incomingBytes <= capBytes) break;
    freed += entry.bytes;
    evict.push(key);
  }
  return evict;
}

/**
 * Drops index entries whose file is gone. Android is free to clear the cache
 * directory, and an index that still counts those bytes evicts real files
 * while the phantoms stay, so the cache slowly stops working.
 */
export function reconcileIndex(index: CacheIndex, presentFiles: ReadonlySet<string>): CacheIndex {
  const next: CacheIndex = {};
  for (const [key, entry] of Object.entries(index)) {
    if (presentFiles.has(cacheFileName(key))) next[key] = entry;
  }
  return next;
}

/** Cache files the index does not account for, e.g. a synthesis that was killed. */
export function orphanNames(index: CacheIndex, names: readonly string[]): string[] {
  const known = new Set(Object.keys(index).map(cacheFileName));
  return names.filter((name) => name.endsWith('.wav') && !known.has(name));
}
