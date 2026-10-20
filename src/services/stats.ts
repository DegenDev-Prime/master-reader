import type { ReadingProgress } from '@/models/story';

/**
 * Honest, offline reading stats over existing progress rows. No leaderboard,
 * no streaks: chapters touched and chapters finished, in a chosen time range.
 *
 * Note: "time listened" is not computed here — `narration_state` stores only
 * the last position per story, with no duration column (see DESIGN §6.2); the
 * UI shows chapters-based stats until a duration signal exists.
 */

export type ReadingStatsRange = 'week' | 'all';

export type ReadingStats = {
  /** Progress rows touched (opened at least once) in range. */
  chaptersRead: number;
  /** Rows whose pageIndex+1 >= pageCount in range. */
  chaptersFinished: number;
};

/** Start of "this week": rolling seven days, computed client-side. */
export function weekStartSeconds(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000) - 7 * 24 * 60 * 60;
}

export function computeReadingStats(
  progress: readonly ReadingProgress[],
  range: ReadingStatsRange,
  nowMs: number = Date.now(),
): ReadingStats {
  const from = range === 'week' ? weekStartSeconds(nowMs) : 0;
  const rows = progress.filter((row) => row.updatedAt >= from);
  return {
    chaptersRead: rows.length,
    chaptersFinished: rows.filter(isFinishedRow).length,
  };
}

function isFinishedRow(row: ReadingProgress): boolean {
  return row.pageCount != null && row.pageCount > 0 && row.pageIndex + 1 >= row.pageCount;
}
