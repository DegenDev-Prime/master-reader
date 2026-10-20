import { systemEngine } from './engines/system';
import { createNeuralEngine } from './engines/neural';
import type { SpeechChunk } from './chunker';
import { NarrationStoppedError } from './engine';
import { getSherpaTtsModule } from './native/sherpa-tts';
import { voicePackById } from './voice-packs';
import type { NarrationEngineId } from '@/services/settings';
import { useNarrationStore } from '@/stores/narration';
import { useSettingsStore } from '@/stores/settings';

export type SpeechPreview = {
  /** Resolves when the sample finishes speaking; rejects if failed/stopped. */
  done: Promise<void>;
  /** Best-effort stop; silences the audio. */
  stop: () => Promise<void>;
};

export function isPreviewStopped(error: unknown): boolean {
  return error instanceof NarrationStoppedError;
}

/**
 * One-shot sample utterance for the voices screen ("Preview") and the
 * pronunciation screen ("Test the voice"). Reuses the narration engines
 * verbatim — no new synthesis path — and refuses to run while a real session
 * is busy, where two engines would fight over one native voice.
 */
export function speakSample(options: {
  text: string;
  voiceId: string | null;
  engine?: NarrationEngineId;
  rate?: number;
}): SpeechPreview | null {
  const narrationStatus = useNarrationStore.getState().status;
  if (narrationStatus === 'playing' || narrationStatus === 'loading') return null;

  const settings = useSettingsStore.getState().settings.narration;
  const engineId = options.engine ?? settings.engine;
  const voiceId = options.voiceId ?? settings.voiceId;
  const rate = options.rate ?? settings.speed;
  const chunk: SpeechChunk = {
    id: 'preview',
    pageIndex: 0,
    start: 0,
    end: options.text.length,
    text: options.text,
  };

  if (engineId === 'system') {
    return {
      done: systemEngine.speak({ chunk, voiceId, rate }),
      stop: () => systemEngine.stop().catch(() => undefined),
    };
  }

  const pack = voiceId ? voicePackById(voiceId) : null;
  if (!pack || pack.engine !== engineId) return null;
  if (getSherpaTtsModule() === null) return null;

  let stopRequest: (() => Promise<void>) | null = null;
  const done = (async () => {
    const engine = createNeuralEngine(pack.engine, {
      getVoicePackId: () => pack.id,
      getLanguage: () => useSettingsStore.getState().settings.defaultLanguage,
      getTitle: () => pack.name,
      getArtist: () => pack.name,
    });
    stopRequest = () => engine.stop();
    try {
      await engine.speak({ chunk, voiceId: pack.id, rate });
    } finally {
      await engine.release?.().catch(() => undefined);
    }
  })();

  return {
    done,
    stop: () => (stopRequest ? stopRequest() : Promise.resolve()),
  };
}
