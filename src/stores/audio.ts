import { create } from 'zustand';

export type AudioPhase = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

type AudioSession = {
  sourceId: string | null;
  storyId: string | null;
  chapterId: string | null;
  title: string | null;
  chapterLabel: string | null;
  canPrevChapter: boolean;
  canNextChapter: boolean;
};

type AudioPlayback = {
  phase: AudioPhase;
  clipIndex: number;
  clipId: string | null;
  positionMs: number;
  durationMs: number;
  bufferedAhead: number;
  error: string | null;
};

type AudioState = AudioSession &
  AudioPlayback & {
    setSession: (session: AudioSession) => void;
    setPlayback: (playback: AudioPlayback) => void;
    clearSession: () => void;
  };

const IDLE_PLAYBACK: AudioPlayback = {
  phase: 'idle',
  clipIndex: 0,
  clipId: null,
  positionMs: 0,
  durationMs: 0,
  bufferedAhead: 0,
  error: null,
};

/** The single UI projection of the audio controller. */
export const useAudioStore = create<AudioState>((set) => ({
  sourceId: null,
  storyId: null,
  chapterId: null,
  title: null,
  chapterLabel: null,
  canPrevChapter: false,
  canNextChapter: false,
  ...IDLE_PLAYBACK,

  setSession: (session) => set({ ...session }),
  setPlayback: (playback) => set({ ...playback }),
  clearSession: () =>
    set({
      sourceId: null,
      storyId: null,
      chapterId: null,
      title: null,
      chapterLabel: null,
      canPrevChapter: false,
      canNextChapter: false,
      ...IDLE_PLAYBACK,
    }),
}));
