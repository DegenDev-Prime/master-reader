export type SleepMode = 'off' | 'minutes' | 'endOfChapter';

export type SleepTimerState =
  { mode: 'off' } | { mode: 'minutes'; endsAtMs: number } | { mode: 'endOfChapter' };

/**
 * Pure sleep-timer transitions. Time-based expiry is decided by comparing
 * `endsAtMs` against a clock the caller supplies (keeps this unit-testable);
 * the `endOfChapter` mode is resolved by the playback service when a chapter
 * finishes.
 */
export function startMinutesTimer(nowMs: number, minutes: number): SleepTimerState {
  return { mode: 'minutes', endsAtMs: nowMs + Math.max(1, minutes) * 60_000 };
}

export function startEndOfChapterTimer(): SleepTimerState {
  return { mode: 'endOfChapter' };
}

export function stopSleepTimer(): SleepTimerState {
  return { mode: 'off' };
}

export function isSleepTimerExpired(state: SleepTimerState, nowMs: number): boolean {
  return state.mode === 'minutes' && nowMs >= state.endsAtMs;
}

export function sleepTimerRemainingMs(state: SleepTimerState, nowMs: number): number | null {
  if (state.mode !== 'minutes') return null;
  return Math.max(0, state.endsAtMs - nowMs);
}
