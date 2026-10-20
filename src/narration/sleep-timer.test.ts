import { describe, expect, it } from 'vitest';

import {
  isSleepTimerExpired,
  sleepTimerRemainingMs,
  startEndOfChapterTimer,
  startMinutesTimer,
  stopSleepTimer,
} from './sleep-timer';

describe('sleep timer', () => {
  it('expires after the configured minutes', () => {
    const state = startMinutesTimer(1_000, 30);
    expect(isSleepTimerExpired(state, 1_000 + 29 * 60_000)).toBe(false);
    expect(isSleepTimerExpired(state, 1_000 + 30 * 60_000)).toBe(true);
  });

  it('clamps sub-minute values to one minute', () => {
    const state = startMinutesTimer(0, 0);
    expect(sleepTimerRemainingMs(state, 0)).toBe(60_000);
  });

  it('end-of-chapter mode never expires on the clock', () => {
    const state = startEndOfChapterTimer();
    expect(isSleepTimerExpired(state, Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(sleepTimerRemainingMs(state, 0)).toBeNull();
  });

  it('stops cleanly', () => {
    expect(stopSleepTimer()).toEqual({ mode: 'off' });
    expect(isSleepTimerExpired(stopSleepTimer(), 999)).toBe(false);
  });
});
