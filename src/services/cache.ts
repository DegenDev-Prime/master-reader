import { cacheRepository, listCacheRepository } from '@/db/repositories';

export async function pruneExpiredCaches(): Promise<void> {
  await cacheRepository.deleteExpired();
  await listCacheRepository.deleteExpired();
}

export async function clearCaches(): Promise<void> {
  await cacheRepository.clear();
  await listCacheRepository.clear();
}

export async function cacheStats(): Promise<{ responses: number; lists: number }> {
  const [responses, lists] = await Promise.all([
    cacheRepository.count(),
    listCacheRepository.count(),
  ]);
  return { responses, lists };
}
