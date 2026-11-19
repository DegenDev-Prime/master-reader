import type { ClipSynthesizer } from '../clip-worker';
import { getSherpaTtsModule } from '../native/sherpa-tts';
import { synthCacheKey, synthCachePath, synthCacheStore, synthTempFile } from '../synth-store';
import { voicePackById } from '../voice-packs';
import { voicePackDir, voicePackStatus } from '../voice-pack-store';

export type NeuralSynthesizerDeps = {
  /** Resolves the extracted voice directory for the active pack id. */
  getVoicePackId: () => string | null;
};

type ActiveVoice = {
  packId: string;
  dir: string;
  sid: number;
  sampleRate: number;
};

/**
 * On-device neural TTS. Synthesis is content-addressed and file-backed, so a
 * clip is generated once and every later request is a cache hit. Playback is
 * deliberately outside this module: the stack worker only produces clips.
 */
export function createNeuralSynthesizer(
  engineId: 'piper' | 'kokoro',
  deps: NeuralSynthesizerDeps,
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
