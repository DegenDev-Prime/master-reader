import { describe, expect, it } from 'vitest';

import type { NarrationStatus } from '@/narration/types';

import {
  deriveChapterNav,
  deriveTransportState,
  nearestSpeedOption,
  NARRATION_SPEED_VALUES,
} from './transport-state';

describe('deriveTransportState', () => {
  it('keeps a cold start free of session-only controls', () => {
    expect(deriveTransportState('idle', false)).toEqual({
      playing: false,
      loading: false,
      canSeek: false,
      started: false,
    });
  });

  it('enables seeking while playing or paused with a session', () => {
    expect(deriveTransportState('playing', true)).toEqual({
      playing: true,
      loading: false,
      canSeek: true,
      started: true,
    });
    expect(deriveTransportState('paused', true)).toEqual({
      playing: false,
      loading: false,
      canSeek: true,
      started: true,
    });
  });

  it('locks seeking while loading but keeps the session for resume', () => {
    expect(deriveTransportState('loading', true)).toEqual({
      playing: false,
      loading: true,
      canSeek: false,
      started: true,
    });
  });

  it('keeps play available after an error so it can retry', () => {
    expect(deriveTransportState('error', true)).toEqual({
      playing: false,
      loading: false,
      canSeek: false,
      started: true,
    });
    expect(deriveTransportState('error', false).started).toBe(false);
  });

  it('never seeks without a session even when the engine reports playing', () => {
    expect(deriveTransportState('playing', false).canSeek).toBe(false);
  });

  it('produces a coherent matrix for every narration status', () => {
    const allStatuses = Object.keys({
      idle: true,
      loading: true,
      playing: true,
      paused: true,
      error: true,
    } satisfies Record<NarrationStatus, true>) as NarrationStatus[];

    expect(allStatuses).toHaveLength(5);
    for (const status of allStatuses) {
      const withSession = deriveTransportState(status, true);
      expect(withSession.started).toBe(true);
      expect(withSession.loading).toBe(status === 'loading');
      expect(withSession.playing).toBe(status === 'playing');
      expect(withSession.canSeek).toBe(status === 'playing' || status === 'paused');

      const withoutSession = deriveTransportState(status, false);
      expect(withoutSession.started).toBe(false);
      expect(withoutSession.canSeek).toBe(false);
    }
  });
});

describe('nearestSpeedOption', () => {
  it('returns offered speeds unchanged', () => {
    for (const value of NARRATION_SPEED_VALUES) {
      expect(nearestSpeedOption(value)).toBe(String(value));
    }
  });

  it('snaps a value between chips to the closer neighbour', () => {
    expect(nearestSpeedOption(0.8)).toBe('0.75');
    expect(nearestSpeedOption(0.9)).toBe('1');
    expect(nearestSpeedOption(1.1)).toBe('1');
    expect(nearestSpeedOption(1.2)).toBe('1.25');
    expect(nearestSpeedOption(1.4)).toBe('1.5');
  });

  it('breaks exact ties towards the slower chip', () => {
    expect(nearestSpeedOption(1.125)).toBe('1');
    expect(nearestSpeedOption(1.375)).toBe('1.25');
  });

  it('keeps out-of-range rates on the closest edge chip', () => {
    expect(nearestSpeedOption(0.1)).toBe('0.75');
    expect(nearestSpeedOption(0.5)).toBe('0.75');
    expect(nearestSpeedOption(3)).toBe('2');
  });
});

describe('NARRATION_SPEED_VALUES', () => {
  it('runs from 0.75× to 2× in ascending quarter steps', () => {
    expect([...NARRATION_SPEED_VALUES]).toEqual([0.75, 1, 1.25, 1.5, 2]);
    for (const value of NARRATION_SPEED_VALUES) {
      expect(Number.isInteger(value * 4)).toBe(true);
    }
    const ascending = [...NARRATION_SPEED_VALUES].every(
      (value, index, all) => index === 0 || value > all[index - 1],
    );
    expect(ascending).toBe(true);
  });

  it('stays inside the range the narration store clamps to', () => {
    for (const value of NARRATION_SPEED_VALUES) {
      expect(value).toBeGreaterThanOrEqual(0.5);
      expect(value).toBeLessThanOrEqual(3);
    }
  });
});

describe('deriveChapterNav', () => {
  it('disables both chapter buttons on a story without a series', () => {
    expect(deriveChapterNav(-1, 0, 0)).toEqual({
      canPrevChapter: false,
      canNextChapter: false,
    });
  });

  it('keeps prev alive on a standalone story once it has parts to rewind', () => {
    expect(deriveChapterNav(-1, 0, 3)).toEqual({
      canPrevChapter: true,
      canNextChapter: false,
    });
  });

  it('opens next at a series start and prev once past the first chapter', () => {
    expect(deriveChapterNav(0, 3, 0)).toEqual({
      canPrevChapter: false,
      canNextChapter: true,
    });
    expect(deriveChapterNav(1, 3, 0)).toEqual({
      canPrevChapter: true,
      canNextChapter: true,
    });
  });

  it('closes next at the last chapter but leaves prev rewinding', () => {
    expect(deriveChapterNav(2, 3, 0)).toEqual({
      canPrevChapter: true,
      canNextChapter: false,
    });
    expect(deriveChapterNav(0, 1, 2)).toEqual({
      canPrevChapter: true,
      canNextChapter: false,
    });
  });
});
