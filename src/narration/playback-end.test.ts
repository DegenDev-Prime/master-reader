import { describe, expect, it } from 'vitest';

import { createEndDetector } from './playback-end';

describe('createEndDetector', () => {
  it('ends the item on the finish event', () => {
    const detector = createEndDetector();
    expect(detector.observe({ playing: true, currentTime: 0 })).toBe(false);
    expect(detector.observe({ playing: true, currentTime: 3 })).toBe(false);
    expect(detector.observe({ didJustFinish: true })).toBe(true);
  });

  it('does not end the item on the position of the previous item', () => {
    const detector = createEndDetector();
    // The player still reports the finished item: loaded, at the end.
    expect(detector.positionFinished({ isLoaded: true, duration: 12, currentTime: 12 })).toBe(
      false,
    );
  });

  it('ends the item on the position once the new one is playing from its start', () => {
    const detector = createEndDetector();
    detector.observe({ playing: true, currentTime: 0 });
    detector.observe({ playing: true, currentTime: 4 });
    expect(detector.positionFinished({ isLoaded: true, duration: 12, currentTime: 11.8 })).toBe(
      true,
    );
  });

  it('does not end the item when the position was never seen at the start', () => {
    const detector = createEndDetector();
    detector.observe({ playing: true, currentTime: 4 });
    expect(detector.positionFinished({ isLoaded: true, duration: 12, currentTime: 12 })).toBe(
      false,
    );
  });

  it('ignores a position that is not loaded or has no duration', () => {
    const detector = createEndDetector();
    detector.observe({ playing: true, currentTime: 0 });
    expect(detector.positionFinished({ isLoaded: false, duration: 12, currentTime: 12 })).toBe(
      false,
    );
    expect(detector.positionFinished({ isLoaded: true, duration: 0, currentTime: 0 })).toBe(false);
  });
});
