import type { SpeechChunk } from './chunker';
import type { NarrationEngineId, VoiceInfo } from './types';

export class NarrationStoppedError extends Error {
  constructor() {
    super('Narration stopped');
    this.name = 'NarrationStoppedError';
  }
}

export type SpeakRequest = {
  chunk: SpeechChunk;
  voiceId?: string | null;
  language?: string;
  /** Playback rate multiplier (1 = normal). */
  rate: number;
};

/**
 * A speech backend. Implementations stream one chunk at a time; `speak`
 * resolves when the chunk finishes, rejects with `NarrationStoppedError` when
 * pre-empted via `stop()`, and rejects with any other error on failure.
 * Neural engines (Phase 2) implement this same contract, so the service and
 * UI never depend on a specific engine.
 */
export type NarratorEngine = {
  readonly id: NarrationEngineId;
  /**
   * When true the engine keeps its own queue: asking it to speak the next
   * chunk while the current one plays does not interrupt it. Engines that
   * play one file at a time leave this unset.
   */
  readonly queues?: boolean;
  listVoices(): Promise<VoiceInfo[]>;
  speak(request: SpeakRequest): Promise<void>;
  stop(): Promise<void>;
  isSpeaking(): Promise<boolean>;
  /** Best-effort background synthesis of upcoming chunks (neural engines). */
  prefetch?(requests: SpeakRequest[]): void;
  /**
   * Applies a new rate to the utterance that is already playing. Returns false
   * when the engine cannot change it live, so the caller restarts the chunk
   * instead.
   */
  setRate?(rate: number): Promise<boolean>;
  /**
   * Loads whatever the engine needs before the first word is spoken, so the
   * model is not loaded on the critical path of pressing play.
   */
  warmup?(): Promise<void>;
  /** Frees native resources (model memory). Optional; no-op by default. */
  release?(): Promise<void>;
};

/** Rough spoken duration for skip math; ~150 wpm at 1x. */
export function estimateChunkSeconds(text: string, rate: number): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return words / (Math.max(0.25, rate) * 2.5);
}
