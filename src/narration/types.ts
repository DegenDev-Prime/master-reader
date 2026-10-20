/** Shared narration domain types. Framework-agnostic; no RN imports. */

import type { NarrationEngineId } from '@/services/settings';

export type { NarrationEngineId };

export type NarrationStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type VoiceInfo = {
  id: string;
  name: string;
  language: string;
  engine: NarrationEngineId;
};

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

export type VoicePackState = {
  engine: 'piper' | 'kokoro';
  voiceId: string;
  bytes: number;
  ready: boolean;
};
