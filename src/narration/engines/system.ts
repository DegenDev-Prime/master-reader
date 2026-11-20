import { SynthError, type ClipSynthesizer } from '../clip-worker';
import { getSystemTtsModule, systemTtsAvailable } from '../native/system-tts';
import { synthCacheKey, synthCachePath, synthCacheStore, synthTempFile } from '../synth-store';

const RELEASE_WAIT_MS = 5_000;

export type SystemSynthesizerDeps = {
  getVoiceId: () => string | null;
};

function isPermanent(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === 'TTS_INIT' || code === 'TTS_RELEASED';
}

/**
 * Android system TTS, rendered to a cache file. Once synthesized, the system
 * engine is indistinguishable from Piper or Kokoro to the rest of the stack.
 */
export function createSystemSynthesizer(deps: SystemSynthesizerDeps): ClipSynthesizer {
  let released = false;
  let queueTail: Promise<unknown> = Promise.resolve();

  function runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = queueTail.then(task, task);
    queueTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function synthesize(text: string): Promise<{ uri: string; durationMs: null }> {
    if (released) throw new SynthError('The system engine was released.', true);
    return runExclusive(async () => {
      if (released) throw new SynthError('The system engine was released.', true);
      const module = getSystemTtsModule();
      if (!module || !systemTtsAvailable()) {
        throw new SynthError('System text-to-speech is not available.', true);
      }

      const voiceId = deps.getVoiceId();
      const key = await synthCacheKey('system', voiceId ?? 'default', text);
      const hit = await synthCachePath(key);
      if (hit) return { uri: hit, durationMs: null };

      const tmp = synthTempFile(key);
      try {
        if (tmp.exists) tmp.delete();
        await module.synthesize(text, voiceId, tmp.uri);
        if (!tmp.exists || tmp.size === 0) {
          throw new SynthError('The system engine wrote no audio.', false);
        }
        const uri = await synthCacheStore(key, tmp);
        // The player reports the exact duration when it loads the file.
        return { uri, durationMs: null };
      } catch (error) {
        if (error instanceof SynthError) throw error;
        throw new SynthError(
          error instanceof Error ? error.message : String(error),
          isPermanent(error),
        );
      } finally {
        if (tmp.exists) tmp.delete();
      }
    });
  }

  return {
    synthesize,
    async warmup(): Promise<void> {
      if (released) return;
      const module = getSystemTtsModule();
      if (!module || !systemTtsAvailable()) {
        throw new SynthError('System text-to-speech is not available.', true);
      }
      await module.warmup().catch((error: unknown) => {
        throw new SynthError(
          error instanceof Error ? error.message : String(error),
          isPermanent(error),
        );
      });
    },
    async release(): Promise<void> {
      if (released) return;
      released = true;
      const drained = await Promise.race([
        queueTail.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), RELEASE_WAIT_MS)),
      ]);
      if (!drained) return;
      await getSystemTtsModule()
        ?.release()
        .catch(() => undefined);
    },
  };
}
