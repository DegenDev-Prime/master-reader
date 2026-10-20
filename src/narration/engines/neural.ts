import { File } from 'expo-file-system';

import { isAudioPlaying, pauseAudio, playAudioFile } from '../audio-output';
import { NarrationStoppedError, type NarratorEngine, type SpeakRequest } from '../engine';
import { getSherpaTtsModule } from '../native/sherpa-tts';
import { synthCacheKey, synthCachePath, synthCacheStore } from '../synth-store';
import type { VoiceInfo } from '../types';
import { voicePackById, voicePacksForEngine } from '../voice-packs';
import { voicePackDir, voicePackStatus } from '../voice-pack-store';

export type NeuralEngineDeps = {
  /** Resolves the extracted voice directory for the active pack id. */
  getVoicePackId: () => string | null;
  getLanguage: () => string | undefined;
  getTitle: () => string;
  getArtist: () => string;
};

const PREFETCH_AHEAD = 2;

type ActiveVoice = {
  packId: string;
  dir: string;
  sid: number;
  sampleRate: number;
};

/**
 * On-device neural TTS via the sherpa-tts native module. Each chunk is
 * synthesized once to a content-addressed WAV file, then played through the
 * shared expo-audio output — so lockscreen, headset and background behavior
 * come for free, and replays cost no inference.
 */
export function createNeuralEngine(
  engineId: 'piper' | 'kokoro',
  deps: NeuralEngineDeps,
): NarratorEngine & { prefetch(requests: SpeakRequest[]): void } {
  let active: ActiveVoice | null = null;
  let aborted = false;
  const prefetching = new Set<string>();
  // Native synthesis is CPU-bound and stateful (one engine instance), so all
  // synthesis is serialized through this promise chain.
  let queueTail: Promise<unknown> = Promise.resolve();

  function runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = queueTail.then(task, task);
    queueTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function ensureVoice(packId: string): Promise<ActiveVoice> {
    const module = getSherpaTtsModule();
    if (!module) throw new Error('Neural narration is not available in this build.');
    if (active && active.packId === packId) return active;
    const def = voicePackById(packId);
    if (!def || def.engine !== engineId) throw new Error('Voice pack is not installed.');
    const status = await voicePackStatus(def);
    if (status.state !== 'ready') throw new Error('Voice pack is not installed.');
    const dir = voicePackDir(def.id);
    const { sampleRate } = await module.initVoice(engineId, dir, 2);
    active = { packId, dir, sid: def.sid ?? 0, sampleRate };
    return active;
  }

  async function synthesizeToFile(text: string, voice: ActiveVoice, rate: number): Promise<string> {
    const module = getSherpaTtsModule();
    if (!module) throw new Error('Neural narration is not available in this build.');
    const key = await synthCacheKey(engineId, voice.packId, text);
    const hit = await synthCachePath(key);
    if (hit) return hit;
    const tmp = new File(voice.dir, `chunk-${key.slice(0, 16)}.wav`);
    if (tmp.exists) tmp.delete();
    // Speed is applied by the player; synthesis always runs at 1x so one
    // cached file serves every playback rate.
    await module.synthesize(text, voice.sid, tmp.uri);
    void rate;
    const cached = await synthCacheStore(key, tmp);
    if (tmp.exists) tmp.delete();
    return cached;
  }

  function prefetch(requests: SpeakRequest[]): void {
    const packId = deps.getVoicePackId();
    if (!packId || aborted) return;
    void (async () => {
      try {
        for (const request of requests.slice(0, PREFETCH_AHEAD)) {
          if (aborted) return;
          const key = await synthCacheKey(engineId, packId, request.chunk.text);
          const marker = `${packId}:${key}`;
          if (prefetching.has(marker)) continue;
          if (await synthCachePath(key)) continue;
          prefetching.add(marker);
          try {
            await runExclusive(async () => {
              if (aborted || (await synthCachePath(key))) return;
              const voice = await ensureVoice(packId);
              await synthesizeToFile(request.chunk.text, voice, request.rate);
            });
          } finally {
            prefetching.delete(marker);
          }
        }
      } catch {
        // Prefetch is best-effort; the foreground speak() surfaces real errors.
      }
    })();
  }

  return {
    id: engineId,

    async listVoices(): Promise<VoiceInfo[]> {
      const packs = voicePacksForEngine(engineId);
      const installed: VoiceInfo[] = [];
      for (const pack of packs) {
        const status = await voicePackStatus(pack).catch(() => ({ state: 'missing' as const }));
        if (status.state === 'ready') {
          installed.push({
            id: pack.id,
            name: pack.name,
            language: pack.language,
            engine: engineId,
          });
        }
      }
      return installed;
    },

    async speak(request: SpeakRequest): Promise<void> {
      aborted = false;
      const packId = deps.getVoicePackId() ?? request.voiceId;
      if (!packId) throw new Error('No neural voice selected.');
      const uri = await runExclusive(async () => {
        const voice = await ensureVoice(packId);
        return synthesizeToFile(request.chunk.text, voice, request.rate);
      });
      if (aborted) throw new NarrationStoppedError();
      await playAudioFile(
        uri,
        { title: deps.getTitle(), artist: deps.getArtist() },
        request.rate,
        () => aborted,
      );
    },

    prefetch,

    async stop(): Promise<void> {
      aborted = true;
      await pauseAudio();
    },

    async release(): Promise<void> {
      aborted = true;
      active = null;
      await getSherpaTtsModule()
        ?.release()
        .catch(() => undefined);
    },

    async isSpeaking(): Promise<boolean> {
      return isAudioPlaying();
    },
  };
}
