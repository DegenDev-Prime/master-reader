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
  for (const victim of selectEvictions(index, bytes, SYNTH_CACHE_CAP_BYTES)) {
    const victimFile = new File(dir, cacheFileName(victim));
    if (victimFile.exists) victimFile.delete();
    delete index[victim];
  }
  const dest = new File(dir, cacheFileName(key));
  // Same volume: a rename, not a second write of the whole WAV.
  await sourceWav.move(dest, { overwrite: true });
  index[key] = { bytes, accessedAt: Date.now() };
  persistIndex(index);
  return dest.uri;
}

export async function synthCacheBytes(): Promise<number> {
  const index = loadIndex();
  return Object.values(index).reduce((sum, entry) => sum + entry.bytes, 0);
}

export async function clearSynthCache(): Promise<void> {
  const dir = cacheDir();
  if (dir.exists) dir.delete();
  cacheIndex = null;
}
