import { isAudioPlaying, pauseAudio, playAudioFile, setAudioRate } from '../audio-output';
import type { ClipSynthesizer } from '../clip-worker';
import { NarrationStoppedError, type NarratorEngine, type SpeakRequest } from '../engine';
import { getSherpaTtsModule } from '../native/sherpa-tts';
import { synthCacheKey, synthCachePath, synthCacheStore, synthTempFile } from '../synth-store';
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

type ActiveVoice = {
  packId: string;
  dir: string;
  sid: number;
  sampleRate: number;
};

/**
 * On-device neural TTS. Synthesis is content-addressed and file-backed, so a
 * clip is generated once and every later playback is a cache hit. This module
 * only produces audio; the stack worker decides what to synthesise and the
 * narrator decides what to play.
 */
export function createNeuralSynthesizer(
  engineId: 'piper' | 'kokoro',
  deps: NeuralEngineDeps,
): ClipSynthesizer {
  let active: ActiveVoice | null = null;
  let released = false;
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

  async function synthesize(text: string): Promise<{ uri: string; durationMs: number | null }> {
    if (released) throw new Error('The neural engine was released.');
    return runExclusive(async () => {
      if (released) throw new Error('The neural engine was released.');
      const module = getSherpaTtsModule();
      if (!module) throw new Error('Neural narration is not available in this build.');
      const packId = deps.getVoicePackId();
      if (!packId) throw new Error('No neural voice selected.');
      const voice = await ensureVoice(packId);
      const key = await synthCacheKey(engineId, voice.packId, text);
      const hit = await synthCachePath(key);
      if (hit) return { uri: hit, durationMs: null };

      const tmp = synthTempFile(key);
      try {
        if (tmp.exists) tmp.delete();
        const result = await module.synthesize(text, voice.sid, tmp.uri);
        const uri = await synthCacheStore(key, tmp);
        const durationMs =
          result.sampleRate > 0 ? Math.round((result.frames / result.sampleRate) * 1000) : null;
        return { uri, durationMs };
      } finally {
        // A failed synthesis must not leave a WAV behind in any directory.
        if (tmp.exists) tmp.delete();
      }
    });
  }

  return {
    synthesize,
    async warmup(): Promise<void> {
      const packId = deps.getVoicePackId();
      if (!packId) return;
      await ensureVoice(packId);
    },
    async release(): Promise<void> {
      released = true;
      active = null;
      await getSherpaTtsModule()
        ?.release()
        .catch(() => undefined);
    },
  };
}

/**
 * Legacy one-chunk-at-a-time engine. The main narrator uses the clip stack and
 * this is kept for voice previews, where a single utterance is all that plays.
 */
export function createNeuralEngine(
  engineId: 'piper' | 'kokoro',
  deps: NeuralEngineDeps,
): NarratorEngine {
  const synthesizer = createNeuralSynthesizer(engineId, deps);
  let generation = 0;
  let released = false;

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
      generation += 1;
      const mine = generation;
      const { uri } = await synthesizer.synthesize(request.chunk.text);
      if (released || mine !== generation) throw new NarrationStoppedError();
      await playAudioFile(
        uri,
        { title: deps.getTitle(), artist: deps.getArtist() },
        request.rate,
        () => released || mine !== generation,
      );
    },

    async warmup(): Promise<void> {
      await synthesizer.warmup?.();
    },

    async setRate(rate: number): Promise<boolean> {
      return setAudioRate(rate);
    },

    async stop(): Promise<void> {
      generation += 1;
      await pauseAudio();
    },

    async release(): Promise<void> {
      released = true;
      generation += 1;
      await synthesizer.release?.();
    },

    async isSpeaking(): Promise<boolean> {
      return isAudioPlaying();
    },
  };
}
