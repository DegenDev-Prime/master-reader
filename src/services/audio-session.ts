import { createAudioPlayerAdapter } from '@/narration/audio-player';
import { AudioController } from '@/narration/audio-controller';
import {
  narrationBackendKey,
  resolveNarration,
  type ResolvedNarration,
} from '@/narration/backends';
import { chunkPages, type SpeechChunk } from '@/narration/chunker';
import { getSystemTtsModule, systemTtsAvailable } from '@/narration/native/system-tts';
import { setSynthProtectedUris, setSynthSessionActive } from '@/narration/synth-store';
import { createNarrationSynthesizer } from '@/narration/synthesizer';
import { VOICE_PACKS, type VoicePackDef } from '@/narration/voice-packs';
import { voicePackStatus } from '@/narration/voice-pack-store';
import { chapterRepository } from '@/db/repositories/chapters';
import { chapterDisplayTitle } from '@/sources/content/chapter-title';
import { chapterText } from '@/sources/content/chapter-text';
import { parseChapterBlocks } from '@/sources/content/parse';
import { useAudioStore } from '@/stores/audio';
import { useSettingsStore } from '@/stores/settings';
import { t } from '@/i18n';

import { getChapterHtml } from './novel-catalog';

type AudioContext = {
  sourceId: string;
  storyId: string;
  chapterId: string;
  title: string | null;
  chapterLabel: string | null;
  canPrevChapter: boolean;
  canNextChapter: boolean;
};

let controller: AudioController | null = null;
let controllerKey = '';
let preparedKey = '';
let preparingKey = '';
let preparing: Promise<boolean> | null = null;
let chapterRequest = 0;
let advancing = false;

async function installedPacks(): Promise<VoicePackDef[]> {
  const installed: VoicePackDef[] = [];
  for (const pack of VOICE_PACKS) {
    if ((await voicePackStatus(pack)).state === 'ready') installed.push(pack);
  }
  return installed;
}

async function resolveBackend(): Promise<ResolvedNarration | null> {
  const narration = useSettingsStore.getState().settings.narration;
  const module = getSystemTtsModule();
  let systemAvailable = false;
  let systemVoiceIds: string[] = [];

  if (systemTtsAvailable() && module) {
    systemAvailable = true;
    if (narration.engine === 'system') {
      // A wedged engine init must not block chapter preparation forever.
      const result = await Promise.race([
        module
          .warmup()
          .then(() => module.getVoices())
          .then((voices) => ({ ok: true, ids: voices.map((voice) => voice.id) }))
          .catch(async () => {
            // Reset a failed engine so the next chapter can try it again.
            await module.release().catch(() => undefined);
            return { ok: false, ids: [] as string[] };
          }),
        new Promise<{ ok: boolean; ids: string[] }>((resolve) =>
          setTimeout(() => resolve({ ok: true, ids: [] }), 5_000),
        ),
      ]);
      systemAvailable = result.ok;
      systemVoiceIds = result.ids;
    }
  }

  const packs = narration.engine === 'system' && systemAvailable ? [] : await installedPacks();
  return resolveNarration(
    { engine: narration.engine, voiceId: narration.voiceId },
    { systemAvailable, systemVoiceIds, installedPacks: packs },
  );
}

async function ensureController(context: AudioContext): Promise<AudioController> {
  const backend = await resolveBackend();
  if (!backend) {
    const message = t('narration.engineUnavailable');
    useAudioStore.getState().setPlayback({
      phase: 'error',
      clipIndex: 0,
      clipId: null,
      positionMs: 0,
      durationMs: 0,
      bufferedAhead: 0,
      error: message,
    });
    throw new Error(message);
  }

  const key = `${context.sourceId}:${context.storyId}:${narrationBackendKey(backend)}`;
  if (controller && controllerKey === key) return controller;

  if (controller) await controller.destroy().catch(() => undefined);

  const synth = createNarrationSynthesizer(backend);
  const settings = useSettingsStore.getState().settings.narration;
  controller = new AudioController({
    player: createAudioPlayerAdapter(),
    synth,
    rate: settings.speed,
    // Kokoro is the slowest model; a first chunk can exceed a minute on a
    // low-end device. The cap still prevents a wedged native call forever.
    synthTimeoutMs: backend.engine === 'kokoro' ? 180_000 : 60_000,
    errorMessage: t('narration.error'),
    onEnd: onChapterEnd,
    meta: { title: context.title ?? 'Master Reader', artist: 'Master Reader' },
    onProtect: setSynthProtectedUris,
    onState: (state) => useAudioStore.getState().setPlayback(state),
  });
  controllerKey = key;
  return controller;
}

/** Replaces the pending text spine for a chapter; does not start playback. */
export async function prepareAudio(
  chunks: readonly SpeechChunk[],
  context: AudioContext,
  startIndex = 0,
  startMs = 0,
): Promise<boolean> {
  useAudioStore.getState().setSession({
    sourceId: context.sourceId,
    storyId: context.storyId,
    chapterId: context.chapterId,
    title: context.title,
    chapterLabel: context.chapterLabel,
    canPrevChapter: context.canPrevChapter,
    canNextChapter: context.canNextChapter,
  });
  if (chunks.length === 0) return false;

  // Audio-driven chapter navigation prepares the target first; the reader's
  // route change then calls prepareAudio for the same chapter, so skip that
  // second load instead of pausing the new chapter.
  const key = `${context.sourceId}:${context.storyId}:${context.chapterId}`;
  if (key === preparedKey && controller) return true;
  if (preparing && preparingKey === key) return preparing;

  preparingKey = key;
  const task = (async (): Promise<boolean> => {
    try {
      const active = await ensureController(context);
      await active.load(chunks, startIndex, startMs);
      setSynthSessionActive(true);
      preparedKey = key;
      return true;
    } catch (error) {
      useAudioStore.getState().setPlayback({
        phase: 'error',
        clipIndex: startIndex,
        clipId: null,
        positionMs: startMs,
        durationMs: 0,
        bufferedAhead: 0,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  })();
  preparing = task;
  try {
    return await task;
  } finally {
    if (preparing === task) {
      preparing = null;
      preparingKey = '';
    }
  }
}

/**
 * Moves the audio session to the next/previous chapter. The reader follows the
 * shared chapter id; the Audio tab can move chapters without a reader mounted.
 */
export async function changeAudioChapter(
  direction: 1 | -1,
  options: { autoplay?: boolean } = {},
): Promise<boolean> {
  const request = ++chapterRequest;
  const state = useAudioStore.getState();
  const { sourceId, storyId, chapterId } = state;
  if (!sourceId || !storyId || !chapterId) return false;

  try {
    const chapters = await chapterRepository.listMetadata(sourceId, storyId);
    const index = chapters.findIndex((chapter) => chapter.id === chapterId);
    if (index < 0) return false;

    const targetIndex = index + direction;
    const target = chapters[targetIndex];
    if (!target) return false;

    let html = await chapterRepository.getContent(sourceId, storyId, target.id);
    if (!html) html = await getChapterHtml(sourceId, storyId, target.id);
    if (!html) return false;

    const blocks = parseChapterBlocks(html);
    const text = chapterText(blocks).text;
    const chunks = chunkPages([{ index: target.position, content: text }]);
    const shouldPlay = options.autoplay ?? (state.phase === 'playing' || state.phase === 'loading');

    // A pause, skip or manual chapter change during the fetch wins.
    if (request !== chapterRequest) return false;

    const loaded = await prepareAudio(
      chunks,
      {
        sourceId,
        storyId,
        chapterId: target.id,
        title: state.title,
        chapterLabel: chapterDisplayTitle(target.title) || target.title || null,
        canPrevChapter: targetIndex > 0,
        canNextChapter: targetIndex < chapters.length - 1,
      },
      0,
      0,
    );

    if (loaded && shouldPlay && request === chapterRequest) await controller?.play();
    return loaded;
  } catch (error) {
    useAudioStore.getState().setPlayback({
      phase: 'error',
      clipIndex: 0,
      clipId: null,
      positionMs: 0,
      durationMs: 0,
      bufferedAhead: 0,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** The clip stack ended; advance exactly once unless the user takes over. */
function onChapterEnd(): void {
  if (advancing) return;
  advancing = true;
  void changeAudioChapter(1, { autoplay: true }).finally(() => {
    advancing = false;
  });
}

/** Single play/pause entry point used by every audio bar. */
export async function toggleAudio(): Promise<void> {
  chapterRequest += 1;
  if (!controller) return;
  await controller.toggle();
}

/** Skip exactly one clip in the active stack. */
export async function skipAudio(direction: 'forward' | 'backward'): Promise<void> {
  chapterRequest += 1;
  if (!controller) return;
  if (direction === 'forward') await controller.skipForward();
  else await controller.skipBackward();
}

export async function destroyAudio(): Promise<void> {
  chapterRequest += 1;
  const active = controller;
  controller = null;
  controllerKey = '';
  preparedKey = '';
  setSynthSessionActive(false);
  await active?.destroy().catch(() => undefined);
}

// Speed is playback-time, so a change applies to the loaded clip immediately.
// A backend/voice change starts with the next prepared chapter.
useSettingsStore.subscribe((state, previous) => {
  const next = state.settings.narration;
  const before = previous.settings.narration;
  if (next.speed !== before.speed) controller?.setRate(next.speed);
  if (next.engine !== before.engine || next.voiceId !== before.voiceId) preparedKey = '';
});
