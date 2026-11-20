export type AudioFollowState = {
  sessionChapterId: string | null;
  sessionStoryId: string | null;
  sessionSourceId: string | null;
  routeChapterId: string;
  routeStoryId: string | null | undefined;
  routeSourceId: string | null | undefined;
  /** The session chapter this reader already saw. */
  seenChapterId: string | null;
};

/**
 * The audio session is a projection of what is playing, not a navigation
 * command. Only a chapter change observed after this reader mounted, for the
 * same story, is allowed to move the route; the value inherited at mount is
 * the previous session and must be ignored.
 */
export function shouldFollowAudioChapter(state: AudioFollowState): boolean {
  if (state.sessionChapterId === state.seenChapterId) return false;
  if (!state.sessionChapterId || state.sessionChapterId === state.routeChapterId) return false;
  return (
    state.sessionSourceId === state.routeSourceId && state.sessionStoryId === state.routeStoryId
  );
}
