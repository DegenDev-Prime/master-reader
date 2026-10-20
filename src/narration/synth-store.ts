import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

import {
  cacheFileName,
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

function readIndex(): CacheIndex {
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

function writeIndex(index: CacheIndex): void {
  indexFile().write(JSON.stringify(index));
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
  const file = new File(cacheDir(), cacheFileName(key));
  if (!file.exists) return null;
  const index = readIndex();
  const entry = index[key];
  if (entry) {
    index[key] = { ...entry, accessedAt: Date.now() };
    writeIndex(index);
  }
  return file.uri;
}

export async function synthCacheStore(key: string, sourceWav: File): Promise<string> {
  const dir = cacheDir();
  dir.create({ intermediates: true, idempotent: true });
  const bytes = sourceWav.size;
  const index = readIndex();
  for (const victim of selectEvictions(index, bytes, SYNTH_CACHE_CAP_BYTES)) {
    const victimFile = new File(dir, cacheFileName(victim));
    if (victimFile.exists) victimFile.delete();
    delete index[victim];
  }
  const dest = new File(dir, cacheFileName(key));
  if (dest.exists) dest.delete();
  await sourceWav.copy(dest);
  index[key] = { bytes, accessedAt: Date.now() };
  writeIndex(index);
  return dest.uri;
}

export async function synthCacheBytes(): Promise<number> {
  const index = readIndex();
  return Object.values(index).reduce((sum, entry) => sum + entry.bytes, 0);
}

export async function clearSynthCache(): Promise<void> {
  const dir = cacheDir();
  if (dir.exists) dir.delete();
}
