export const SYNTH_CACHE_CAP_BYTES = 300 * 1024 * 1024;

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
