import type { DownloadStatus } from '@/models/story';

/**
 * Pure decision logic for post-interruption download recovery. Rows still in
 * `downloading` after an app kill have no owner any more and `enqueueDownload`
 * refuses such rows, so they are re-queued. Every other status must never be
 * touched: queued/failed are worker-managed, and completed pins must keep
 * their rows (and page rows) intact.
 */
export type DownloadRow = {
  sourceId: string;
  storyId: string;
  status: DownloadStatus;
};

/** Returns the rows to re-queue, unchanged, in input order. */
export function decideStaleDownloadRows<T extends DownloadRow>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.status === 'downloading');
}
