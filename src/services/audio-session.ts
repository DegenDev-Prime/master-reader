import { createAudioPlayerAdapter } from '@/narration/audio-player';
import { AudioController } from '@/narration/audio-controller';
import { chunkPages, type SpeechChunk } from '@/narration/chunker';
import { createNeuralSynthesizer } from '@/narration/engines/neural';
import { VOICE_PACKS, voicePackById, type VoicePackDef } from '@/narration/voice-packs';
import { voicePackStatus } from '@/narration/voice-pack-store';
import { chapterRepository } from '@/db/repositories/chapters';
import { chapterDisplayTitle } from '@/sources/content/chapter-title';
import { chapterText } from '@/sources/content/chapter-text';
import { parseChapterBlocks } from '@/sources/content/parse';
import { useAudioStore } from '@/stores/audio';
import { useSettingsStore } from '@/stores/settings';

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

async function resolveVoicePack(): Promise<VoicePackDef | null> {
  const settings = useSettingsStore.getState().settings.narration;
  const selected = settings.voiceId ? voicePackById(settings.voiceId) : null;
  if (selected && (await voicePackStatus(selected)).state === 'ready') return selected;

  for (const pack of VOICE_PACKS) {
    if ((await voicePackStatus(pack)).state === 'ready') return pack;
  }
  return null;
}

async function ensureController(context: AudioContext): Promise<AudioController> {
  const pack = await resolveVoicePack();
  if (!pack) {
    const error = new Error('No TTS voice pack is installed.');
    useAudioStore.getState().setPlayback({
      phase: 'error',
      clipIndex: 0,
      clipId: null,
      positionMs: 0,
      durationMs: 0,
      bufferedAhead: 0,
      error: error.message,
    });
    throw error;
  }

  const key = `${context.sourceId}:${context.storyId}:${pack.id}`;
  if (controller && controllerKey === key) return controller;

  if (controller) await controller.destroy().catch(() => undefined);

  const synth = createNeuralSynthesizer(pack.engine, {
    getVoicePackId: () => pack.id,
  });
  controller = new AudioController({
    player: createAudioPlayerAdapter(),
    synth,
    meta: { title: context.title ?? 'Master Reader', artist: 'Master Reader' },
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
): Promise<void> {
  useAudioStore.getState().setSession({
    sourceId: context.sourceId,
    storyId: context.storyId,
    chapterId: context.chapterId,
    title: context.title,
    chapterLabel: context.chapterLabel,
    canPrevChapter: context.canPrevChapter,
    canNextChapter: context.canNextChapter,
  });
  if (chunks.length === 0) return;

  // Audio-driven chapter navigation prepares the target first; the reader's
  // route change then calls prepareAudio for the same chapter, so skip that
  // second load instead of pausing the new chapter.
  const key = `${context.sourceId}:${context.storyId}:${context.chapterId}`;
  if (key === preparedKey && controller) return;

  try {
    const active = await ensureController(context);
    await active.load(chunks, startIndex, startMs);
    preparedKey = key;
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
  }
}

/**
 * Moves the audio session to the next/previous chapter. The reader follows the
 * shared chapter id; the Audio tab can move chapters without a reader mounted.
 */
export async function changeAudioChapter(direction: 1 | -1): Promise<void> {
  const state = useAudioStore.getState();
  const { sourceId, storyId, chapterId } = state;
  if (!sourceId || !storyId || !chapterId) return;

  try {
    const chapters = await chapterRepository.listMetadata(sourceId, storyId);
    const index = chapters.findIndex((chapter) => chapter.id === chapterId);
    if (index < 0) return;

    const targetIndex = index + direction;
    const target = chapters[targetIndex];
    if (!target) return;

    let html = await chapterRepository.getContent(sourceId, storyId, target.id);
    if (!html) html = await getChapterHtml(sourceId, storyId, target.id);
    if (!html) return;

    const blocks = parseChapterBlocks(html);
    const text = chapterText(blocks).text;
    const chunks = chunkPages([{ index: target.position, content: text }]);
    const wasPlaying = state.phase === 'playing' || state.phase === 'loading';

    await prepareAudio(
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

    if (wasPlaying) await toggleAudio();
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
  }
}

/** Single play/pause entry point used by every audio bar. */
export async function toggleAudio(): Promise<void> {
  if (!controller) return;
  await controller.toggle();
}

/** Skip exactly one clip in the active stack. */
export async function skipAudio(direction: 'forward' | 'backward'): Promise<void> {
  if (!controller) return;
  if (direction === 'forward') await controller.skipForward();
  else await controller.skipBackward();
}

export async function destroyAudio(): Promise<void> {
  const active = controller;
  controller = null;
  controllerKey = '';
  preparedKey = '';
  await active?.destroy().catch(() => undefined);
}
