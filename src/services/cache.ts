import { cacheRepository, listCacheRepository } from '@/db/repositories';
import { clearSynthCache } from '@/narration/synth-store';

export async function pruneExpiredCaches(): Promise<void> {
  await cacheRepository.deleteExpired();
  await listCacheRepository.deleteExpired();
}

export async function clearCaches(): Promise<void> {
  await cacheRepository.clear();
  await listCacheRepository.clear();
  // The synthesized narration audio is regenerable and by far the largest
  // thing this app keeps on disk, so clearing the caches must clear it.
  await clearSynthCache();
}

export async function cacheStats(): Promise<{ responses: number; lists: number }> {
  const [responses, lists] = await Promise.all([
    cacheRepository.count(),
    listCacheRepository.count(),
  ]);
  return { responses, lists };
}
