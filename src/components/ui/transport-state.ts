import type { NarrationStatus } from '@/narration/types';

export type TransportState = {
  playing: boolean;
  loading: boolean;
  canSeek: boolean;
  started: boolean;
};

/** Playback speeds offered by the speed control, from 0.75× to 2×. */
export const NARRATION_SPEED_VALUES = [0.75, 1, 1.25, 1.5, 2] as const;

type StatusFlags = {
  playing: boolean;
  loading: boolean;
  canSeek: boolean;
};

const STATUS_FLAGS: Record<NarrationStatus, StatusFlags> = {
  idle: { playing: false, loading: false, canSeek: false },
  loading: { playing: false, loading: true, canSeek: false },
  playing: { playing: true, loading: false, canSeek: true },
  paused: { playing: false, loading: false, canSeek: true },
  error: { playing: false, loading: false, canSeek: false },
};

/**
 * Maps a narration status plus session presence onto the transport control
 * states so every screen derives the same playing / loading / seek matrix.
 * The flags table is exhaustive over NarrationStatus, so a new status cannot
 * silently fall through to an unseekable, non-playing state.
 */
export function deriveTransportState(status: NarrationStatus, hasSession: boolean): TransportState {
  const flags = STATUS_FLAGS[status] ?? STATUS_FLAGS.idle;
  return {
    playing: flags.playing,
    loading: flags.loading,
    canSeek: hasSession && flags.canSeek,
    started: hasSession,
  };
}

/**
 * Nearest offered speed for a store value, as the string the speed control
 * compares against, so a value between chips still highlights the closest one.
 */
export function nearestSpeedOption(speed: number): string {
  const nearest = NARRATION_SPEED_VALUES.reduce((closest, value) =>
    Math.abs(value - speed) < Math.abs(closest - speed) ? value : closest,
  );
  return String(nearest);
}

/**
 * Whether the chapter buttons of a queue-driven transport can do anything.
 * Prev falls back to rewinding one part, so it survives at a series start or
 * on a standalone story; next needs a real forward chapter in the queue.
 */
export function deriveChapterNav(
  seriesPosition: number,
  seriesLength: number,
  chunkIndex: number,
): { canPrevChapter: boolean; canNextChapter: boolean } {
  return {
    canPrevChapter: seriesPosition > 0 || chunkIndex > 0,
    canNextChapter: seriesPosition >= 0 && seriesPosition < seriesLength - 1,
  };
}
