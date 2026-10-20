/**
 * End-of-item detection for the audio player.
 *
 * A player does not reset its position when an item finishes, so a plain
 * "position reached the duration" check reports the *previous* item as
 * finished the moment the next one is loaded. That restarts the same file
 * over and over.
 *
 * The detector therefore only trusts the position once the new item has been
 * seen playing from its start, and prefers the player's own finish event.
 * The logic is pure so it can be tested without a native player.
 */

export type PlaybackStatusLike = {
  didJustFinish?: boolean;
  playing?: boolean;
  currentTime?: number;
};

export type PlaybackPositionLike = {
  isLoaded?: boolean;
  duration?: number;
  currentTime?: number;
};

/** A position this close to zero means the player is at the start of an item. */
export const RESET_EPS_S = 0.05;
/** How close to the end counts as finished when the event is missing. */
export const END_MARGIN_S = 0.3;

export type EndDetector = {
  /** Feeds a status update; returns true once the item has finished. */
  observe(status: PlaybackStatusLike): boolean;
  /** Whether the position alone says the item has finished. */
  positionFinished(position: PlaybackPositionLike): boolean;
  /** Whether the item has been seen playing. */
  readonly sawPlaying: boolean;
  /** Whether the item has been seen at its start. */
  readonly atStart: boolean;
};

export function createEndDetector(): EndDetector {
  let sawPlaying = false;
  let atStart = false;

  return {
    observe(status) {
      if (status.didJustFinish) return true;
      if (status.playing) sawPlaying = true;
      if (typeof status.currentTime === 'number' && status.currentTime <= RESET_EPS_S) {
        atStart = true;
      }
      return false;
    },

    positionFinished(position) {
      if (!sawPlaying || !atStart) return false;
      if (!position.isLoaded) return false;
      const duration = position.duration ?? 0;
      const currentTime = position.currentTime ?? 0;
      if (duration <= 0) return false;
      return currentTime >= duration - END_MARGIN_S;
    },

    get sawPlaying() {
      return sawPlaying;
    },

    get atStart() {
      return atStart;
    },
  };
}
