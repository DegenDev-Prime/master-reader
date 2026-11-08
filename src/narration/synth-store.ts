import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

import {
  cacheFileName,
  orphanNames,
  reconcileIndex,
  selectEvictions,
  synthCacheKeyInput,
  SYNTH_CACHE_CAP_BYTES,
  type CacheIndex,
} from './synth-cache';

function cacheDir(): Directory {
  return new Directory(Paths.cache.uri + 'narration-synth/');
}

function indexFile(): File {
  return new File(cacheDir(), 'index.json');
}

/**
 * The cache index, read once per session and kept in memory.
 *
 * The index used to be read and rewritten on every lookup, which put a
 * synchronous JSON parse and write on the path of every spoken chunk. Cache
 * hits are now memory-only; only a store touches the disk.
 */
let cacheIndex: CacheIndex | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let protectedUris = new Set<string>();
let sessionActive = false;

/** Keeps the playhead and its lookahead out of the LRU eviction sweep. */
export function setSynthProtectedUris(uris: readonly string[]): void {
  protectedUris = new Set(uris);
}

/** A live narration session owns its cached WAVs; clearing would break it. */
export function setSynthSessionActive(active: boolean): void {
  sessionActive = active;
}

export function isSynthSessionActive(): boolean {
  return sessionActive;
}

function readIndexFile(): CacheIndex {
  const file = indexFile();
  if (!file.exists) return {};
  try {
    const parsed: unknown = JSON.parse(file.textSync());
    if (parsed && typeof parsed === 'object') return parsed as CacheIndex;
  } catch {
    // Corrupt index: rebuild from scratch.
  }
  return {};
}

function loadIndex(): CacheIndex {
  if (cacheIndex) return cacheIndex;
  const dir = cacheDir();
  const names = dir.exists ? dir.list().map((entry) => entry.name) : [];
  const index = reconcileIndex(readIndexFile(), new Set(names));
  const orphans = orphanNames(index, names);
  for (const name of orphans) {
    try {
      new File(dir, name).delete();
    } catch {
      // A file that cannot be deleted costs space, not correctness.
    }
  }
  cacheIndex = index;
  return index;
}

/** Writes the index through a temporary file, so a kill cannot truncate it. */
function persistIndex(index: CacheIndex): void {
  const dir = cacheDir();
  dir.create({ intermediates: true, idempotent: true });
  const temporary = new File(dir, 'index.json.tmp');
  if (temporary.exists) temporary.delete();
  temporary.write(JSON.stringify(index));
  temporary.moveSync(indexFile(), { overwrite: true });
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (cacheIndex) persistIndex(cacheIndex);
  }, 500);
}

/** Flushes a pending index write, e.g. before the cache is cleared. */
export function flushSynthCacheIndex(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (cacheIndex) persistIndex(cacheIndex);
}

export async function synthCacheKey(
  engine: string,
  voiceId: string,
  text: string,
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    synthCacheKeyInput(engine, voiceId, text),
  );
}

export async function synthCachePath(key: string): Promise<string | null> {
  const index = loadIndex();
  const file = new File(cacheDir(), cacheFileName(key));
  if (!file.exists) {
    // The entry outlived its file, which Android may clear at any time.
    delete index[key];
    return null;
  }
  const entry = index[key];
  // Session-local recency is enough for LRU: persisting every hit is exactly
  // the disk write this cache no longer does.
  index[key] = { bytes: entry?.bytes ?? file.size ?? 0, accessedAt: Date.now() };
  return file.uri;
}

/** Where a synthesis writes before it is moved into the cache under its key. */
export function synthTempFile(key: string): File {
  const dir = cacheDir();
  dir.create({ intermediates: true, idempotent: true });
  return new File(dir, `tmp-${cacheFileName(key)}`);
}

export async function synthCacheStore(key: string, sourceWav: File): Promise<string> {
  const dir = cacheDir();
  dir.create({ intermediates: true, idempotent: true });
  const index = loadIndex();
  const bytes = sourceWav.size;
  const protectedKeys = new Set(
    Object.keys(index).filter((item) => protectedUris.has(new File(dir, cacheFileName(item)).uri)),
  );
  for (const victim of selectEvictions(index, bytes, SYNTH_CACHE_CAP_BYTES, protectedKeys)) {
    const victimFile = new File(dir, cacheFileName(victim));
    if (victimFile.exists) victimFile.delete();
    delete index[victim];
  }
  const dest = new File(dir, cacheFileName(key));
  // Same volume: a rename, not a second write of the whole WAV.
  await sourceWav.move(dest, { overwrite: true });
  index[key] = { bytes, accessedAt: Date.now() };
  schedulePersist();
  return dest.uri;
}

export async function synthCacheBytes(): Promise<number> {
  const index = loadIndex();
  return Object.values(index).reduce((sum, entry) => sum + entry.bytes, 0);
}

export async function clearSynthCache(): Promise<void> {
  // Deleting the file under the current clip would wedge playback until the
  // next synthesis. The settings screen can clear again after stopping.
  if (sessionActive) return;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const dir = cacheDir();
  if (dir.exists) dir.delete();
  cacheIndex = null;
}
