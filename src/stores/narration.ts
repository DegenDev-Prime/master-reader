import { create } from 'zustand';

import {
  narrationBookmarksRepository,
  narrationRepository,
  progressRepository,
} from '@/db/repositories';
import { chapterRepository } from '@/db/repositories/chapters';
import { chunkIndexAfterSeconds, Narrator } from '@/narration/service';
import { chunkPages, type SpeechChunk } from '@/narration/chunker';
import { systemEngine } from '@/narration/engines/system';
import { createNeuralEngine } from '@/narration/engines/neural';
import type { NarratorEngine } from '@/narration/engine';
import { buildSeriesQueue } from '@/narration/queue';
import {
  chunkIndexForPage,
  pageCountForChunks,
  pageIndexForChunk,
} from '@/narration/progress-sync';
import {
  startEndOfChapterTimer,
  startMinutesTimer,
  stopSleepTimer,
  type SleepTimerState,
} from '@/narration/sleep-timer';
import type { NarrationBookmark, NarrationStatus } from '@/narration/types';
import { voicePackById } from '@/narration/voice-packs';
import {
  applyPronunciation,
  applyPronunciationMapped,
  rulesForStory,
  type MappedNarration,
} from '@/services/pronunciation';
import type { StoryPage, StorySeriesItem } from '@/models/story';
import { ensurePageContents, getStoryDetails, getStoryPages } from '@/services/catalog';
import { getChapterHtml } from '@/services/novel-catalog';
import { chapterText } from '@/sources/content/chapter-text';
import { parseChapterBlocks } from '@/sources/content/parse';
import { loadProgress, saveReadingProgress } from '@/services/reading';
import { useSettingsStore } from '@/stores/settings';
import { usePronunciationStore } from '@/stores/pronunciation';
import { htmlToPlainText } from '@/utils/html';

/** Chapters eagerly loaded for narration of a lazily-fetched novel. */
const NARRATION_CHAPTER_LIMIT = 50;
/** Chapters loaded into one chapter-based narration session. */
const NARRATION_CHAPTER_WINDOW = 5;

type NarrationState = {
  status: NarrationStatus;
  sourceId: string | null;
  storyId: string | null;
  title: string | null;
  chunkIndex: number;
  chunkCount: number;
  /** The text of the chunk being spoken, so a screen can show it live. */
  chunkText: string | null;
  /** The chapters of the loaded window, for the player's queue. */
  chapterWindow: { id: string; position: number; title: string }[];
  /** Total chapters of the story, when known. */
  chapterTotal: number;
  speed: number;
  sleep: SleepTimerState;
  bookmarks: NarrationBookmark[];
  error: string | null;
  /** Index of the narrating story within its series; -1 when standalone. */
  seriesPosition: number;
  /** Number of chapters in the narrating story's series; 0 when standalone. */
  seriesLength: number;
  play: (sourceId: string, storyId: string, title?: string | null) => Promise<void>;
  toggle: (sourceId: string, storyId: string, title?: string | null) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seekChunk: (index: number) => Promise<void>;
  skip: (seconds: number) => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  setSleepMinutes: (minutes: number | null) => void;
  setSleepEndOfChapter: () => void;
  clearSleep: () => void;
  addBookmark: (label?: string | null) => Promise<void>;
  refreshBookmarks: () => Promise<void>;
  loadBookmarksFor: (sourceId: string, storyId: string) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  playFromChunk: (
    sourceId: string,
    storyId: string,
    chunkIndex: number,
    title?: string | null,
  ) => Promise<void>;
  playNextInQueue: () => Promise<void>;
  playPrevInQueue: () => Promise<void>;
};

let narrator: Narrator | null = null;
let narratorEngineKey = '';
let activeEngine: NarratorEngine | null = null;
let chunks: SpeechChunk[] = [];
let seriesItems: StorySeriesItem[] = [];
let narrationChapterList: { id: string; position: number; title: string }[] = [];
let narrationChapterTotal = 0;
/**
 * Per-chapter source maps of the loaded narration window. The reader uses them
 * to translate spoken chunk offsets back onto the displayed blocks, so both
 * sides always agree on how the text was transformed.
 */
let narrationPageMaps = new Map<number, { text: string; mapped: MappedNarration }>();
let sleepTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Builds narration pages from chapter-based sources. Starts at the reader's
 * saved chapter and loads a bounded window so a 3,000-chapter serial does not
 * block playback.
 */
async function loadChapterNarrationPages(
  sourceId: string,
  storyId: string,
): Promise<Pick<StoryPage, 'index' | 'content'>[] | null> {
  const list = await chapterRepository.listMetadata(sourceId, storyId);
  if (list.length === 0) return null;

  const progress = await progressRepository.get(sourceId, storyId);
  const savedIndex = progress?.chapterId
    ? list.findIndex((chapter) => chapter.id === progress.chapterId)
    : -1;
  const startIndex =
    savedIndex >= 0 ? savedIndex : Math.min(Math.max(progress?.pageIndex ?? 0, 0), list.length - 1);
  const window = list.slice(startIndex, startIndex + NARRATION_CHAPTER_WINDOW);
  const rules = rulesForStory(usePronunciationStore.getState().rules, sourceId, storyId);

  const pages: Pick<StoryPage, 'index' | 'content'>[] = [];
  const pageMaps = new Map<number, { text: string; mapped: MappedNarration }>();
  for (let offset = 0; offset < window.length; offset += 3) {
    const batch = window.slice(offset, offset + 3);
    const loaded = await Promise.all(
      batch.map(async (chapter) => {
        try {
          let html = await chapterRepository.getContent(sourceId, storyId, chapter.id);
          if (!html) html = await getChapterHtml(sourceId, storyId, chapter.id);
          if (!html) return null;
          const text = chapterText(parseChapterBlocks(html)).text;
          if (!text) return null;
          // The mapped text is the narration text: pronunciation applied and
          // whitespace normalized, exactly what the chunker will index into.
          const mapped = applyPronunciationMapped(text, rules);
          pageMaps.set(chapter.position, { text, mapped });
          return {
            index: chapter.position,
            content: mapped.text,
          };
        } catch {
          return null;
        }
      }),
    );
    for (const page of loaded) {
      if (page) pages.push(page);
    }
  }

  if (pages.length === 0) return null;
  pages.sort((a, b) => a.index - b.index);
  narrationChapterList = window.map((chapter) => ({
    id: chapter.id,
    position: chapter.position,
    title: chapter.title,
  }));
  narrationChapterTotal = list.length;
  narrationPageMaps = pageMaps;
  useNarrationStore.setState({
    chapterWindow: [...narrationChapterList],
    chapterTotal: narrationChapterTotal,
  });
  return pages;
}

/**
 * Series chapters of the narrating story, cached after `play()` loads them so
 * queue jumps do not refetch story details on every press. Cleared whenever a
 * session starts or stops so a jump can never follow a stale series.
 */
async function ensureSeries(sourceId: string, storyId: string): Promise<StorySeriesItem[]> {
  if (seriesItems.length > 0) return seriesItems;
  const details = await getStoryDetails(sourceId, storyId, { includeContent: false }).catch(
    () => null,
  );
  seriesItems = details?.series?.items ?? [];
  return seriesItems;
}

/** Resolves the configured engine, verifying neural voice packs are installed. */
function resolveEngine(): NarratorEngine {
  const narration = useSettingsStore.getState().settings.narration;
  if (narration.engine === 'system') return systemEngine;
  const pack = narration.voiceId ? voicePackById(narration.voiceId) : null;
  if (!pack || pack.engine !== narration.engine) {
    throw new Error('Selected neural voice is not downloaded.');
  }
  return createNeuralEngine(narration.engine, {
    getVoicePackId: () => pack.id,
    getLanguage: () => useSettingsStore.getState().settings.defaultLanguage,
    getTitle: () => useNarrationStore.getState().title ?? 'Narration',
    getArtist: () => pack.name,
  });
}

function ensureNarrator(): Narrator {
  const narration = useSettingsStore.getState().settings.narration;
  const key = `${narration.engine}:${narration.voiceId ?? ''}`;
  if (!narrator || narratorEngineKey !== key) {
    const engine = resolveEngine();
    activeEngine = engine;
    narrator = new Narrator(
      {
        engine,
        getSleepState: () => useNarrationStore.getState().sleep,
        nowMs: () => Date.now(),
        onProgress: (chunkIndex) => {
          const state = useNarrationStore.getState();
          if (state.sourceId && state.storyId) {
            void narrationRepository.save({
              sourceId: state.sourceId,
              storyId: state.storyId,
              engine: useSettingsStore.getState().settings.narration.engine,
              voiceId: useSettingsStore.getState().settings.narration.voiceId,
              speed: state.speed,
              chunkIndex,
            });
            // Keep the text reader in sync so it opens where audio left off.
            const chunk = chunks[chunkIndex];
            if (narrationChapterList.length > 0 && chunk) {
              const chapter = narrationChapterList.find(
                (item) => item.position === chunk.pageIndex,
              );
              if (chapter) {
                const chapterChunks = chunks.filter((item) => item.pageIndex === chunk.pageIndex);
                const within = chapterChunks.indexOf(chunk);
                void progressRepository.save({
                  sourceId: state.sourceId,
                  storyId: state.storyId,
                  pageIndex: chapter.position,
                  chapterId: chapter.id,
                  pageCount: narrationChapterTotal,
                  scrollPct:
                    chapterChunks.length > 1
                      ? Math.min(1, Math.max(0, within / (chapterChunks.length - 1)))
                      : 0,
                  paragraphIndex: 0,
                });
              }
            } else {
              const pageIndex = pageIndexForChunk(chunks, chunkIndex);
              const pageCount = pageCountForChunks(chunks);
              if (pageCount > 0) {
                void saveReadingProgress({
                  sourceId: state.sourceId,
                  storyId: state.storyId,
                  pageIndex,
                  pageCount,
                });
              }
            }
          }
          useNarrationStore.setState({ chunkIndex });
        },
      },
      {
        onStatus: (status) => useNarrationStore.setState({ status }),
        onChunk: (index) =>
          useNarrationStore.setState({
            chunkIndex: index,
            chunkText: chunks[index]?.text ?? null,
          }),
        onDone: (reason) => {
          const store = useNarrationStore.getState();
          if (reason === 'sleep' || reason === 'endOfChapter') {
            store.clearSleep();
          }
          if (reason === 'finished') {
            void store.playNextInQueue();
          }
        },
        onError: (error) => {
          console.warn('Narration failed', error);
          useNarrationStore.setState({ error: error.message, status: 'error' });
        },
      },
    );
    narratorEngineKey = key;
  }
  return narrator;
}

function clearSleepTimeout(): void {
  if (sleepTimeout) {
    clearTimeout(sleepTimeout);
    sleepTimeout = null;
  }
}

function clampSpeed(speed: number): number {
  return Math.min(3, Math.max(0.5, speed));
}

/**
 * Chunk text of the loaded narration session (after the pronunciation-rule
 * pass). Exposed for the player's spoken-context block; null when nothing is
 * loaded or the index is out of range.
 */
export function narrationChunkAt(index: number): SpeechChunk | null {
  return chunks[index] ?? null;
}

/** Chunks grouped under one reader page, in order; null when none are loaded. */
export function narrationPageChunks(pageIndex: number): SpeechChunk[] | null {
  if (chunks.length === 0) return null;
  const pageChunks = chunks.filter((chunk) => chunk.pageIndex === pageIndex);
  return pageChunks.length > 0 ? pageChunks : null;
}

/**
 * The loaded session's chunk list, read-only. Identity changes whenever a new
 * session replaces the list; readers can key memos off it without copying.
 */
export function narrationChunks(): readonly SpeechChunk[] {
  return chunks;
}

/**
 * The chapters of the loaded narration window, in reading order. The player
 * uses it to show what comes next and where the voice currently is.
 */
export function narrationChapterWindow(): {
  chapters: { id: string; position: number; title: string }[];
  total: number;
} {
  return { chapters: [...narrationChapterList], total: narrationChapterTotal };
}

/**
 * The source map of a narrated chapter, when the loaded window covers it and
 * the reader displays the same text. Null otherwise: without an exact map a
 * reader must not guess where a chunk lands in the visible text.
 */
export function narrationPageMap(pageIndex: number, text: string): MappedNarration | null {
  const entry = narrationPageMaps.get(pageIndex);
  if (!entry || entry.text !== text) return null;
  return entry.mapped;
}

/**
 * The plain text the voice reads: htmlToPlainText followed by the
 * pronunciation-rule pass for this story, so spoken text matches what the
 * player and reader highlight.
 */
function narratablePlainText(html: string, sourceId: string, storyId: string): string {
  const text = htmlToPlainText(html);
  if (!text) return '';
  const rules = rulesForStory(usePronunciationStore.getState().rules, sourceId, storyId);
  return applyPronunciation(text, rules);
}

export const useNarrationStore = create<NarrationState>((set, get) => ({
  status: 'idle',
  sourceId: null,
  storyId: null,
  title: null,
  chunkIndex: 0,
  chunkCount: 0,
  chunkText: null,
  chapterWindow: [],
  chapterTotal: 0,
  speed: 1,
  sleep: stopSleepTimer(),
  bookmarks: [],
  error: null,
  seriesPosition: -1,
  seriesLength: 0,

  async play(sourceId, storyId, title = null) {
    const current = get();
    if (
      current.status === 'playing' &&
      current.sourceId === sourceId &&
      current.storyId === storyId
    ) {
      return;
    }
    try {
      await ensureNarrator().stop();
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    // A new session must not leave an armed timer badge with a dead timeout.
    get().clearSleep();
    seriesItems = [];
    narrationChapterList = [];
    narrationChapterTotal = 0;
    narrationPageMaps = new Map();
    set({
      status: 'loading',
      sourceId,
      storyId,
      title,
      chunkIndex: 0,
      chunkCount: 0,
      chunkText: null,
      chapterWindow: [],
      chapterTotal: 0,
      error: null,
      bookmarks: [],
      seriesPosition: -1,
      seriesLength: 0,
    });

    try {
      // Pronunciation rules live in the settings store; hydrate once, then the
      // per-chunk rule pass below reads the hydrated snapshot synchronously.
      await usePronunciationStore.getState().hydrate();

      const chapterPages = await loadChapterNarrationPages(sourceId, storyId);
      let pages: Pick<StoryPage, 'index' | 'content'>[];
      const chapterMode = chapterPages != null;
      if (chapterPages) {
        pages = chapterPages;
      } else {
        pages = await getStoryPages(sourceId, storyId);
        // Legacy providers may return content-less stubs; load a bounded
        // window so playback can start without pulling an entire serial.
        if (!pages.some((page) => page.content)) {
          pages = await ensurePageContents(sourceId, storyId, undefined, NARRATION_CHAPTER_LIMIT);
        }
        pages = pages.map((page) => ({
          index: page.index,
          content: narratablePlainText(page.content ?? '', sourceId, storyId),
        }));
      }

      chunks = chunkPages(
        pages.map((page) => ({
          index: page.index,
          content: page.content ?? '',
        })),
      );
      if (chunks.length === 0) throw new Error('No readable text found.');
      set({ chunkCount: chunks.length });

      const narration = useSettingsStore.getState().settings.narration;
      let startIndex = 0;
      if (chapterMode) {
        const progress = await progressRepository.get(sourceId, storyId);
        const chapter = narrationChapterList.find((item) => item.id === progress?.chapterId);
        startIndex = chunkIndexForPage(chunks, chapter?.position ?? pages[0]?.index ?? 0);
      } else {
        const saved = await narrationRepository.get(sourceId, storyId);
        const read = await loadProgress(sourceId, storyId).catch(() => null);
        // Resume from whichever memory is further along: audio or text.
        const audioChunk = Math.min(saved?.chunkIndex ?? 0, chunks.length - 1);
        const textChunk =
          read && read.pageCount
            ? chunkIndexForPage(chunks, Math.min(read.pageIndex, read.pageCount - 1))
            : 0;
        startIndex = Math.max(audioChunk, textChunk);
      }
      set({
        chunkIndex: startIndex,
        chunkText: chunks[startIndex]?.text ?? null,
        speed: narration.speed,
      });

      if (!chapterMode) {
        const details = await getStoryDetails(sourceId, storyId, { includeContent: false }).catch(
          () => null,
        );
        if (!get().title && details?.title) set({ title: details.title });
        seriesItems = details?.series?.items ?? [];
        set({
          seriesPosition: seriesItems.findIndex((item) => item.id === storyId),
          seriesLength: seriesItems.length,
        });
      }
      await get().refreshBookmarks();

      await ensureNarrator().play({
        chunks,
        startIndex,
        voiceId: narration.voiceId,
        rate: narration.speed,
      });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async toggle(sourceId, storyId, title = null) {
    const { status } = get();
    if (status === 'playing') {
      await get().pause();
      return;
    }
    if (status === 'paused') {
      await get().resume();
      return;
    }
    // Finished narration keeps the session: start the story over instead of
    // replaying only its final chunk.
    if (status === 'idle' && get().sourceId && chunks.length > 0) {
      await get().seekChunk(0);
      return;
    }
    await get().play(sourceId, storyId, title);
  },

  async pause() {
    try {
      await ensureNarrator().pause();
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  },

  async resume() {
    const { sourceId, storyId, chunkIndex, speed } = get();
    if (!sourceId || !storyId || chunks.length === 0) return;
    try {
      const { autoRewindSeconds } = useSettingsStore.getState().settings.narration;
      const narration = useSettingsStore.getState().settings.narration;
      const startIndex = chunkIndexAfterSeconds(chunks, chunkIndex, -autoRewindSeconds, speed);
      await ensureNarrator().play({ chunks, startIndex, voiceId: narration.voiceId, rate: speed });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  },

  async stop() {
    get().clearSleep();
    try {
      await ensureNarrator().stop();
    } catch {
      // Releasing an already-released engine is not an error.
    }
    try {
      await activeEngine?.release?.();
    } catch {
      // Best-effort native cleanup.
    }
    activeEngine = null;
    if (useSettingsStore.getState().settings.narration.engine !== 'system') {
      const { unloadAudioPlayer } = await import('@/narration/audio-output');
      await unloadAudioPlayer();
    }
    set({
      sourceId: null,
      storyId: null,
      title: null,
      chunkIndex: 0,
      chunkCount: 0,
      chunkText: null,
      chapterWindow: [],
      chapterTotal: 0,
      seriesPosition: -1,
      seriesLength: 0,
    });
    chunks = [];
    seriesItems = [];
    narrationChapterList = [];
    narrationChapterTotal = 0;
    narrationPageMaps = new Map();
  },

  async seekChunk(index) {
    const { sourceId, storyId, speed } = get();
    if (!sourceId || !storyId || chunks.length === 0) return;
    try {
      const narration = useSettingsStore.getState().settings.narration;
      await ensureNarrator().pause();
      await ensureNarrator().play({
        chunks,
        startIndex: index,
        voiceId: narration.voiceId,
        rate: speed,
      });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  },

  async skip(seconds) {
    const { chunkIndex, speed } = get();
    if (chunks.length === 0) return;
    await get().seekChunk(chunkIndexAfterSeconds(chunks, chunkIndex, seconds, speed));
  },

  async setSpeed(speed) {
    const next = clampSpeed(Math.round(speed * 4) / 4);
    // The selected chip follows the tap immediately; the disk write cannot gate it.
    set({ speed: next });
    try {
      await useSettingsStore.getState().setSetting('narration', {
        ...useSettingsStore.getState().settings.narration,
        speed: next,
      });
    } catch (error) {
      console.warn('Could not persist narration speed', error);
    }
    const { status, chunkIndex } = get();
    // A paused engine runs no utterance, so restarting would resume playback;
    // the new rate is picked up by the next resume instead.
    if (status === 'playing' && chunks.length > 0) {
      try {
        const narration = useSettingsStore.getState().settings.narration;
        await ensureNarrator().pause();
        await ensureNarrator().play({
          chunks,
          startIndex: chunkIndex,
          voiceId: narration.voiceId,
          rate: next,
        });
      } catch (error) {
        set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    }
  },

  setSleepMinutes(minutes) {
    clearSleepTimeout();
    if (minutes === null) {
      set({ sleep: stopSleepTimer() });
      return;
    }
    set({ sleep: startMinutesTimer(Date.now(), minutes) });
    sleepTimeout = setTimeout(() => {
      sleepTimeout = null;
      void get().pause();
      get().clearSleep();
    }, minutes * 60_000);
  },

  setSleepEndOfChapter() {
    clearSleepTimeout();
    set({ sleep: startEndOfChapterTimer() });
  },

  clearSleep() {
    clearSleepTimeout();
    if (get().sleep.mode !== 'off') set({ sleep: stopSleepTimer() });
  },

  async addBookmark(label = null) {
    const { sourceId, storyId, chunkIndex } = get();
    if (!sourceId || !storyId) return;
    await narrationBookmarksRepository.add(sourceId, storyId, chunkIndex, label);
    await get().refreshBookmarks();
  },

  async refreshBookmarks() {
    const { sourceId, storyId } = get();
    if (!sourceId || !storyId) {
      set({ bookmarks: [] });
      return;
    }
    set({ bookmarks: await narrationBookmarksRepository.listForStory(sourceId, storyId) });
  },

  async loadBookmarksFor(sourceId, storyId) {
    set({ bookmarks: await narrationBookmarksRepository.listForStory(sourceId, storyId) });
  },

  async removeBookmark(id) {
    await narrationBookmarksRepository.remove(id);
    await get().refreshBookmarks();
  },

  async playFromChunk(sourceId, storyId, chunkIndex, title = null) {
    const current = get();
    if (current.sourceId !== sourceId || current.storyId !== storyId || chunks.length === 0) {
      await get().play(sourceId, storyId, title);
      if (chunks.length === 0) return;
    }
    await get().seekChunk(chunkIndex);
  },

  async playNextInQueue() {
    const { sourceId, storyId, status } = get();
    // Jumping while a session is still loading would race it; the transport
    // disables these buttons during load anyway.
    if (!sourceId || !storyId || status === 'loading') return;
    const items = await ensureSeries(sourceId, storyId);
    const queue = buildSeriesQueue(items, new Map(), storyId);
    // A story absent from its own series list has no forward chain: queue[0]
    // would be the series' first chapter, not the next one.
    if (queue[0]?.storyId !== storyId) return;
    const next = queue[1];
    if (!next) return;
    const details = await getStoryDetails(sourceId, next.storyId, { includeContent: false }).catch(
      () => null,
    );
    await get().play(sourceId, next.storyId, details?.title ?? next.title);
  },

  async playPrevInQueue() {
    const { sourceId, storyId, chunkIndex, status } = get();
    if (!sourceId || !storyId || status === 'loading') return;
    const items = await ensureSeries(sourceId, storyId);
    const position = items.findIndex((item) => item.id === storyId);
    if (position > 0) {
      const previous = items[position - 1];
      const details = await getStoryDetails(sourceId, previous.id, { includeContent: false }).catch(
        () => null,
      );
      await get().play(sourceId, previous.id, details?.title ?? previous.title);
      return;
    }
    // A story outside a series has no previous chapter: rewind one part instead.
    if (chunkIndex > 0) await get().seekChunk(chunkIndex - 1);
  },
}));
