import { describe, expect, it } from 'vitest';

import { shouldFollowAudioChapter } from './audio-follow';

const base = {
  sessionChapterId: 'b',
  sessionStoryId: 'story',
  sessionSourceId: 'source',
  routeChapterId: 'a',
  routeStoryId: 'story',
  routeSourceId: 'source',
  seenChapterId: 'a',
};

describe('shouldFollowAudioChapter', () => {
  it('follows a new audio chapter for the same story', () => {
    expect(shouldFollowAudioChapter(base)).toBe(true);
  });

  it('ignores the session value inherited at mount', () => {
    expect(shouldFollowAudioChapter({ ...base, seenChapterId: 'b' })).toBe(false);
  });

  it('does not navigate when the route already matches', () => {
    expect(shouldFollowAudioChapter({ ...base, routeChapterId: 'b' })).toBe(false);
  });

  it('never follows another story or source', () => {
    expect(shouldFollowAudioChapter({ ...base, sessionStoryId: 'other' })).toBe(false);
    expect(shouldFollowAudioChapter({ ...base, sessionSourceId: 'other' })).toBe(false);
  });

  it('ignores an empty session', () => {
    expect(shouldFollowAudioChapter({ ...base, sessionChapterId: null })).toBe(false);
  });
});
