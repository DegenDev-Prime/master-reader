import { sourceHealthRepository } from '@/db/repositories/source-health';
import { useSettingsStore } from '@/stores/settings';

import { getSource } from './source-manager';

export type SourceHealthCheck =
  { ok: true; latencyMs: number } | { ok: false; skipped: boolean; error?: string };

const HEALTH_OPERATION = 'browse';

/**
 * A lightweight reachability probe used by the source manager UI. It records
 * the outcome in `source_health`; it never disables a source automatically.
 */
export async function checkSourceHealth(sourceId: string): Promise<SourceHealthCheck> {
  if (useSettingsStore.getState().settings.offlineMode) {
    return { ok: false, skipped: true };
  }

  const source = getSource(sourceId);
  const started = Date.now();
  try {
    await source.getLatest({ page: 1, limit: 1 });
    const latencyMs = Date.now() - started;
    await sourceHealthRepository
      .recordSuccess({ sourceId, operation: HEALTH_OPERATION }, latencyMs)
      .catch(() => {});
    return { ok: true, latencyMs };
  } catch (error) {
    const kind = error instanceof Error ? error.name : 'Error';
    await sourceHealthRepository
      .recordFailure({ sourceId, operation: HEALTH_OPERATION }, kind)
      .catch(() => {});
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listSourceHealth() {
  const rows = await sourceHealthRepository.list();
  return new Map(
    rows.filter((row) => row.operation === HEALTH_OPERATION).map((row) => [row.sourceId, row]),
  );
}
