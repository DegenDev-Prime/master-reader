import * as Speech from 'expo-speech';

import { NarrationStoppedError, type NarratorEngine, type SpeakRequest } from '../engine';
import { normalizeSystemVoices } from '../system-voice-names';
import type { VoiceInfo } from '../types';

const MIN_RATE = 0.25;
const MAX_RATE = 3;

/**
 * Device TTS fallback (Android system engine). Zero megabytes, always
 * available offline once a system voice is installed. Robotic compared to
 * neural engines, but it makes narration work everywhere on day one.
 *
 * The platform engine synthesizes an utterance before it plays, so a chunk
 * that is only requested once the previous one finished leaves a silence
 * between chunks. The engine queues utterances, so the next one is requested
 * while the current one still plays.
 */
export const systemEngine: NarratorEngine = {
  id: 'system',
  queues: true,

  async listVoices(): Promise<VoiceInfo[]> {
    const voices = await Speech.getAvailableVoicesAsync();
    return normalizeSystemVoices(
      voices.map((voice) => ({
        id: voice.identifier,
        name: voice.name,
        language: voice.language,
      })),
    ).map((voice) => ({
      id: voice.id,
      name: voice.label,
      language: voice.language,
      engine: 'system' as const,
    }));
  },

  speak({ chunk, voiceId, language, rate }: SpeakRequest): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      Speech.speak(chunk.text, {
        voice: voiceId ?? undefined,
        language: language ?? undefined,
        rate: Math.min(MAX_RATE, Math.max(MIN_RATE, rate)),
        onDone: () => resolve(),
        onStopped: () => reject(new NarrationStoppedError()),
        onError: (error) => reject(error instanceof Error ? error : new Error(String(error))),
      });
    });
  },

  async stop(): Promise<void> {
    Speech.stop();
  },

  async isSpeaking(): Promise<boolean> {
    return Speech.isSpeakingAsync();
  },
};
