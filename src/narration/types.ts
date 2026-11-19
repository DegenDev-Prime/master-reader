/** Persisted narration data. Framework-agnostic; no RN imports. */

export type NarrationProgress = {
  sourceId: string;
  storyId: string;
  engine?: string | null;
  voiceId?: string | null;
  speed?: number | null;
  chunkIndex: number;
  /** Character offset inside the current chunk (0 when at a boundary). */
  charOffset: number;
  /** unix seconds */
  updatedAt: number;
};

export type NarrationBookmark = {
  id: string;
  sourceId: string;
  storyId: string;
  chunkIndex: number;
  label: string | null;
  /** unix seconds */
  createdAt: number;
};
