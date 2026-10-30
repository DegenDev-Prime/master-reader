import { create } from 'zustand';

import {
  narrationBookmarksRepository,
  narrationRepository,
  progressRepository,
} from '@/db/repositories';
import { chapterRepository } from '@/db/repositories/chapters';
import { Narrator, seekTargetAfterSeconds } from '@/narration/service';
import { chunkPages, type SpeechChunk } from '@/narration/chunker';
import { systemEngine } from '@/narration/engines/system';
import { createNeuralEngine } from '@/narration/engines/neural';
import type { NarratorEngine } from '@/narration/engine';
import { chunkOffsets } from '@/narration/player-estimates';
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
import type { NarrationEngineId } from '@/services/settings';
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
  /**
   * The id of the chunk being spoken. Every screen reads this one value
   * instead of deriving the chapter from the chunk index itself.
   */
  chunkId: string | null;
  /** When the current chunk started speaking, so the voice's place in it is
   *  known even though the engine reports no position. */
  chunkStartedAt: number;
  /** The current time, kept up to date while the voice is speaking. */
  now: number;
  /** How far into the current chunk the voice is by `now`, in seconds. */
  positionAt: (now: number) => number;
  /** The real time the voice has been speaking by `now`, in milliseconds. */
  elapsedMsAt: (now: number) => number;
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
  play: (
    sourceId: string,
    storyId: string,
    title?: string | null,
    startChapterId?: string | null,
  ) => Promise<void>;
  toggle: (sourceId: string, storyId: string, title?: string | null) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seekChunk: (index: number, immediate?: boolean, intoSeconds?: number) => Promise<void>;
  skip: (seconds: number) => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  setVoice: (voiceId: string | null, engine?: NarrationEngineId) => Promise<void>;
  warmUp: () => Promise<void>;
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
  playChapter: (chapterId: string) => Promise<void>;
  playNextChapter: () => Promise<void>;
  playPrevChapter: () => Promise<void>;
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
/**
 * The narration text of every chapter of the window that has been loaded, in
 * reading order. The chunk list is rebuilt from it, so a chapter that is
 * jumped to before the background loader reached it still ends up in the
 * right place.
 */
let narrationPages: { index: number; content: string }[] = [];
let sleepTimeout: ReturnType<typeof setTimeout> | null = null;
/**
 * Identifies the current narration session. The background chapter loader
 * checks it so a session that was stopped or replaced stops loading too.
 */
let narrationSession = 0;
/** Where the voice was when it stopped, so the clock does not keep running. */
let pausedPosition = 0;
/**
 * The real time each chunk took to speak, by chunk index. The word count is
 * only an estimate, and a voice that pauses at punctuation runs slower than
 * it, so the clock counts the time the voice actually took. A chunk that is
 * spoken again replaces its entry, so the position moves back with it.
 */
let chunkDurations: number[] = [];
/** The chunk that is being spoken, or -1 when none is. */
let speakingIndex = -1;
/**
 * The clock of the player. It lives in the store rather than in a component
 * because the React compiler drops a state update whose value a component
 * never reads, and the clock has to keep ticking while the voice speaks.
 */
let clockTimer: ReturnType<typeof setInterval> | null = null;
/**
 * Skip and seek taps arrive faster than an engine can restart, so the last one
 * of a burst is the only one worth paying for: the player moves at once, the
 * engine follows once the taps stop.
 */
const SEEK_DEBOUNCE_MS = 90;
let seekTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSeek: number | null = null;
/** How far into the pending chunk the seek lands, in seconds. */
let pendingSeekInto = 0;
/** The session the pending seek belongs to, so it cannot outlive a new one. */
let pendingSeekSession = 0;
let seekRunning = false;
/**
 * How far into the chunk the voice started, in seconds, when it was entered
 * mid-way by a skip or a resume. The engines cannot seek inside an utterance
 * and get the chunk's unspoken text, so the clock has to add this head start.
 */
let chunkOffsetInto = 0;
/** The chunk the head start belongs to; any other chunk resets it. */
let offsetChunkIndex = -1;

/**
 * Builds narration pages from chapter-based sources. Starts at the reader's
 * saved chapter and loads a bounded window so a 3,000-chapter serial does not
 * block playback.
 *
 * Only the first chapter is awaited: the rest of the window is fetched in the
 * background and appended to `chunks`, which the running narrator holds, so
 * the first words are spoken while the later chapters are still loading.
 */
async function loadChapterNarrationPages(
  sourceId: string,
  storyId: string,
  chunks: SpeechChunk[],
  session: number,
  startChapterId?: string | null,
): Promise<Pick<StoryPage, 'index' | 'content'>[] | null> {
  const list = await chapterRepository.listMetadata(sourceId, storyId);
  if (list.length === 0) return null;

  const progress = await progressRepository.get(sourceId, storyId);
  const wanted = startChapterId ?? progress?.chapterId;
  const savedIndex = wanted ? list.findIndex((chapter) => chapter.id === wanted) : -1;
  const startIndex =
    savedIndex >= 0 ? savedIndex : Math.min(Math.max(progress?.pageIndex ?? 0, 0), list.length - 1);
  const window = list.slice(startIndex, startIndex + NARRATION_CHAPTER_WINDOW);
  const rules = rulesForStory(usePronunciationStore.getState().rules, sourceId, storyId);

  narrationChapterList = window.map((chapter) => ({
    id: chapter.id,
    position: chapter.position,
    title: chapter.title,
  }));
  narrationChapterTotal = list.length;
  useNarrationStore.setState({
    chapterWindow: [...narrationChapterList],
    chapterTotal: narrationChapterTotal,
  });

  const loadChapter = async (chapter: (typeof window)[number]) => {
    try {
      let html = await chapterRepository.getContent(sourceId, storyId, chapter.id);
      if (!html) html = await getChapterHtml(sourceId, storyId, chapter.id);
      if (!html) return null;
      const text = chapterText(parseChapterBlocks(html)).text;
      if (!text) return null;
      // The mapped text is the narration text: pronunciation applied and
      // whitespace normalized, exactly what the chunker will index into.
      const mapped = applyPronunciationMapped(text, rules);
      narrationPageMaps.set(chapter.position, { text, mapped });
      return { index: chapter.position, content: mapped.text };
    } catch {
      return null;
    }
  };

  const first = await loadChapter(window[0]);
  if (!first) return null;
  narrationPages = [first];

  void (async () => {
    for (let offset = 1; offset < window.length; offset += 3) {
      if (session !== narrationSession) return;
      const batch = window.slice(offset, offset + 3);
      const loaded = await Promise.all(batch.map((chapter) => loadChapter(chapter)));
      if (session !== narrationSession) return;
      const pages = loaded.filter(
        (page): page is { index: number; content: string } => page != null,
      );
      if (pages.length === 0) continue;
      pages.sort((a, b) => a.index - b.index);
      narrationPages = [...narrationPages, ...pages].sort((a, b) => a.index - b.index);
      // The narrator holds this array, so growing it extends the run.
      chunks.push(
        ...chunkPages(pages.map((page) => ({ index: page.index, content: page.content }))),
      );
      useNarrationStore.setState({ chunkCount: chunks.length });
    }
  })();

  return [first];
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

/**
 * Stops the current narrator and releases its engine. Used when the engine
 * or the voice changes: the narrator is bound to the engine it was built
 * with, so the old one has to go before a new one is created.
 */
async function releaseNarrator(): Promise<void> {
  const previous = narrator;
  narrator = null;
  narratorEngineKey = '';
  if (previous) {
    try {
      await previous.stop();
    } catch {
      // The engine is going away anyway.
    }
  }
  try {
    await activeEngine?.release?.();
  } catch {
    // Best-effort native cleanup.
  }
  activeEngine = null;
}

/** The engine and voice the narrator is currently bound to. */
function narratorKey(): string {
  const narration = useSettingsStore.getState().settings.narration;
  return `${narration.engine}:${narration.voiceId ?? ''}`;
}

function ensureNarrator(): Narrator {
  const key = narratorKey();
  if (!narrator || narratorEngineKey !== key) {
    const engine = resolveEngine();
    activeEngine = engine;
    narrator = new Narrator(
      {
        engine,
        getSleepState: () => useNarrationStore.getState().sleep,
        nowMs: () => Date.now(),
        getRate: () => useNarrationStore.getState().speed,
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
        onStatus: (status) => {
          const now = Date.now();
          const previous = useNarrationStore.getState().chunkStartedAt;
          if (status !== 'playing' && previous > 0) {
            // The voice stopped: the time it spent belongs to it, the pause
            // that follows does not.
            if (speakingIndex >= 0) {
              chunkDurations[speakingIndex] = Math.max(0, now - previous);
            }
            pausedPosition = (now - previous) / 1000 + chunkOffsetInto;
          }
          useNarrationStore.setState({ status, chunkStartedAt: now, now });
          if (status === 'playing') startClock();
          else stopClock();
        },
        onChunk: (index) => {
          const now = Date.now();
          const previous = useNarrationStore.getState().chunkStartedAt;
          if (previous > 0 && speakingIndex >= 0) {
            chunkDurations[speakingIndex] = Math.max(0, now - previous);
          }
          // The head start covers only the chunk it was entered with; once the
          // voice moves on, the plain chunk clock is the position again.
          if (index !== offsetChunkIndex) chunkOffsetInto = 0;
          speakingIndex = index;
          useNarrationStore.setState({
            chunkIndex: index,
            chunkId: chunks[index]?.id ?? null,
            chunkText: chunks[index]?.text ?? null,
            chunkStartedAt: now,
          });
        },
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

/** Starts the clock that the player's time display follows. */
function startClock(): void {
  if (clockTimer) return;
  useNarrationStore.setState({ now: Date.now() });
  clockTimer = setInterval(() => {
    useNarrationStore.setState({ now: Date.now() });
  }, 1000);
}

function stopClock(): void {
  if (!clockTimer) return;
  clearInterval(clockTimer);
  clockTimer = null;
}

function scheduleSeek(delay = SEEK_DEBOUNCE_MS): void {
  if (seekTimer) clearTimeout(seekTimer);
  seekTimer = setTimeout(() => {
    seekTimer = null;
    void drainSeek();
  }, delay);
}

/** Restarts the engine at the last requested chunk, once the taps settle. */
async function drainSeek(): Promise<void> {
  if (seekRunning) {
    scheduleSeek(60);
    return;
  }
  const index = pendingSeek;
  pendingSeek = null;
  if (index == null) return;
  // A session that was replaced while the taps were settling wins.
  if (pendingSeekSession !== narrationSession) return;
  const state = useNarrationStore.getState();
  if (!state.sourceId || !state.storyId || chunks.length === 0) return;
  seekRunning = true;
  try {
    const narration = useSettingsStore.getState().settings.narration;
    const into = pendingSeekInto;
    pendingSeekInto = 0;
    chunkOffsetInto = into;
    offsetChunkIndex = index;
    try {
      await ensureNarrator().pause();
    } catch {
      // An engine that cannot be stopped lets the new run replace it anyway.
    }
    ensureNarrator().play({
      chunks,
      startIndex: index,
      startOffsetSeconds: into,
      voiceId: narration.voiceId,
      rate: useNarrationStore.getState().speed,
    });
  } catch (error) {
    useNarrationStore.setState({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    seekRunning = false;
    if (pendingSeek != null) scheduleSeek(0);
  }
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

/** Jumps one chapter forward or back in the narrating story. */
async function stepChapter(direction: 1 | -1): Promise<void> {
  const store = useNarrationStore.getState();
  const { sourceId, storyId, status, chunkIndex } = store;
  if (!sourceId || !storyId || status === 'loading') return;
  if (narrationChapterList.length === 0) {
    if (direction > 0) await store.playNextInQueue();
    else await store.playPrevInQueue();
    return;
  }
  const position = chunks[chunkIndex]?.pageIndex;
  const index = narrationChapterList.findIndex((chapter) => chapter.position === position);
  if (index < 0) return;
  const target = narrationChapterList[index + direction];
  if (target) {
    await store.playChapter(target.id);
    return;
  }
  // The window ends before the story does, so the next chapter is read from
  // the story's own list rather than giving up at the edge.
  const list = await chapterRepository.listMetadata(sourceId, storyId).catch(() => []);
  const currentAt = list.findIndex((chapter) => chapter.id === narrationChapterList[index].id);
  const neighbour = currentAt >= 0 ? list[currentAt + direction] : undefined;
  if (neighbour) await store.playChapter(neighbour.id);
}

export const useNarrationStore = create<NarrationState>((set, get) => ({
  status: 'idle',
  sourceId: null,
  storyId: null,
  title: null,
  chunkIndex: 0,
  chunkCount: 0,
  chunkText: null,
  chunkId: null,
  chunkStartedAt: 0,
  now: Date.now(),
  chapterWindow: [],
  chapterTotal: 0,
  speed: 1,
  sleep: stopSleepTimer(),
  bookmarks: [],
  error: null,
  seriesPosition: -1,
  seriesLength: 0,

  async play(sourceId, storyId, title = null, startChapterId = null) {
    const current = get();
    const narratingChapterId = (() => {
      const chunk = chunks[current.chunkIndex];
      if (!chunk) return null;
      return narrationChapterList.find((item) => item.position === chunk.pageIndex)?.id ?? null;
    })();
    const wantsAnotherChapter = startChapterId != null && startChapterId !== narratingChapterId;
    if (
      current.status === 'playing' &&
      current.sourceId === sourceId &&
      current.storyId === storyId &&
      !wantsAnotherChapter
    ) {
      return;
    }
    try {
      // A narrator bound to another engine or voice keeps running otherwise.
      if (narrator && narratorEngineKey !== narratorKey()) await releaseNarrator();
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
    if (seekTimer) {
      clearTimeout(seekTimer);
      seekTimer = null;
    }
    pendingSeek = null;
    pendingSeekInto = 0;
    chunkOffsetInto = 0;
    offsetChunkIndex = -1;
    narrationSession += 1;
    const session = narrationSession;
    seriesItems = [];
    narrationChapterList = [];
    narrationChapterTotal = 0;
    narrationPageMaps = new Map();
    narrationPages = [];
    // The narrator keeps this array, so the background loader can extend it.
    const sessionChunks: SpeechChunk[] = [];
    chunks = sessionChunks;
    chunkDurations = [];
    speakingIndex = -1;
    pausedPosition = 0;
    set({
      status: 'loading',
      sourceId,
      storyId,
      title,
      chunkIndex: 0,
      chunkCount: 0,
      chunkText: null,
      chunkId: null,
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

      const chapterPages = await loadChapterNarrationPages(
        sourceId,
        storyId,
        sessionChunks,
        session,
        startChapterId,
      );
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

      const initial = chunkPages(
        pages.map((page) => ({
          index: page.index,
          content: page.content ?? '',
        })),
      );
      if (initial.length === 0) throw new Error('No readable text found.');
      sessionChunks.push(...initial);
      set({ chunkCount: sessionChunks.length });

      const narration = useSettingsStore.getState().settings.narration;
      let startIndex = 0;
      if (chapterMode) {
        const progress = await progressRepository.get(sourceId, storyId);
        const wanted = startChapterId ?? progress?.chapterId;
        const chapter = narrationChapterList.find((item) => item.id === wanted);
        startIndex = chunkIndexForPage(sessionChunks, chapter?.position ?? pages[0]?.index ?? 0);
      } else {
        const saved = await narrationRepository.get(sourceId, storyId);
        const read = await loadProgress(sourceId, storyId).catch(() => null);
        // Resume from whichever memory is further along: audio or text.
        const audioChunk = Math.min(saved?.chunkIndex ?? 0, sessionChunks.length - 1);
        const textChunk =
          read && read.pageCount
            ? chunkIndexForPage(sessionChunks, Math.min(read.pageIndex, read.pageCount - 1))
            : 0;
        startIndex = Math.max(audioChunk, textChunk);
      }
      set({
        chunkIndex: startIndex,
        chunkId: sessionChunks[startIndex]?.id ?? null,
        chunkText: sessionChunks[startIndex]?.text ?? null,
        chunkStartedAt: Date.now(),
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

      if (session !== narrationSession) return;
      // The run happens in the background: awaiting it would keep every
      // caller — the transport button, the reader — pending for a whole
      // chapter.
      ensureNarrator().play({
        chunks: sessionChunks,
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
    // A failed session keeps its place: the voice picks up where it stopped
    // rather than starting the story over.
    if (status === 'error' && get().sourceId && chunks.length > 0) {
      await get().seekChunk(get().chunkIndex);
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
      const { autoRewindSeconds, voiceId } = useSettingsStore.getState().settings.narration;
      const target = seekTargetAfterSeconds(
        chunks,
        chunkIndex,
        -autoRewindSeconds,
        speed,
        get().positionAt(Date.now()),
      );
      try {
        await ensureNarrator().pause();
      } catch {
        // An engine that cannot be stopped lets the new run replace it anyway.
      }
      chunkOffsetInto = target.intoSeconds;
      offsetChunkIndex = target.index;
      ensureNarrator().play({
        chunks,
        startIndex: target.index,
        startOffsetSeconds: target.intoSeconds,
        voiceId,
        rate: speed,
      });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  },

  async stop() {
    get().clearSleep();
    stopClock();
    if (seekTimer) {
      clearTimeout(seekTimer);
      seekTimer = null;
    }
    pendingSeek = null;
    pendingSeekInto = 0;
    chunkOffsetInto = 0;
    offsetChunkIndex = -1;
    // The background chapter loader stops with the session.
    narrationSession += 1;
    try {
      // The existing narrator, not a new one: stopping a session that never
      // started must not load an engine.
      await narrator?.stop();
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
      chunkId: null,
      chunkStartedAt: 0,
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

  async seekChunk(index, immediate = false, intoSeconds = 0) {
    const { sourceId, storyId } = get();
    if (!sourceId || !storyId || chunks.length === 0) return;
    const target = Math.min(Math.max(0, Math.round(index)), chunks.length - 1);
    // The player moves on the tap; the engine restart is debounced behind it,
    // so a burst of skips feels instant instead of queueing stop/start pairs.
    pendingSeek = target;
    pendingSeekInto = Math.max(0, intoSeconds);
    pendingSeekSession = narrationSession;
    pausedPosition = pendingSeekInto;
    chunkOffsetInto = pendingSeekInto;
    offsetChunkIndex = target;
    set({
      chunkIndex: target,
      chunkId: chunks[target]?.id ?? null,
      chunkText: chunks[target]?.text ?? null,
      // The clock starts as if the chunk began intoSeconds ago, so the shown
      // position lands where the seek asked for, not at the chunk's start.
      chunkStartedAt: Date.now() - pendingSeekInto * 1000,
      now: Date.now(),
    });
    // While paused the engine is already stopped: the position is enough, and
    // pressing play resumes from it. Otherwise the restart is coalesced.
    if (get().status !== 'paused') {
      if (immediate) await drainSeek();
      else scheduleSeek();
    }
  },

  /**
   * How far into the story the voice is by `now`, in milliseconds. The chunks
   * that have been spoken count the time they really took; the ones that have
   * not count their estimate, so the position is continuous.
   */
  elapsedMsAt(now: number): number {
    const { chunkIndex, chunkStartedAt, status, speed } = get();
    const offsets = chunkOffsets(chunks, speed);
    let total = (offsets[chunkIndex] ?? 0) * 1000;
    // The estimate is a per-chunk constant, so only the difference between a
    // chunk's real time and its estimate has to be added; the clock ticks once
    // a second and must not re-split thousands of strings to do it.
    for (let index = 0; index < chunkIndex; index += 1) {
      const known = chunkDurations[index];
      if (known == null) continue;
      total += known - (offsets[index + 1] - offsets[index]) * 1000;
    }
    if (status === 'playing' && chunkStartedAt > 0) {
      total += Math.max(0, now - chunkStartedAt) + chunkOffsetInto;
    }
    return total;
  },

  /** How far into the current chunk the voice is by `now`, in seconds. */
  positionAt(now: number): number {
    const { chunkStartedAt, status } = get();
    if (chunkStartedAt <= 0) return 0;
    if (status !== 'playing') return pausedPosition;
    return Math.max(0, (now - chunkStartedAt) / 1000 + chunkOffsetInto);
  },

  async skip(seconds) {
    const { chunkIndex, speed } = get();
    if (chunks.length === 0) return;
    // The voice's place inside the chunk comes from the same clock the player
    // shows, so a skip of a few seconds really moves that far and a rewind
    // after a pause is not counted from the pause.
    const target = seekTargetAfterSeconds(
      chunks,
      chunkIndex,
      seconds,
      speed,
      get().positionAt(Date.now()),
    );
    await get().seekChunk(target.index, false, target.intoSeconds);
  },

  /**
   * Loads the engine before the session starts, so the model is ready when
   * the reader presses play. Failures are ignored: the session reports them
   * when it actually starts.
   */
  async warmUp() {
    try {
      await ensureNarrator().warmUp();
    } catch {
      // The session surfaces the failure when it starts.
    }
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
    // The next chunk is spoken at the new rate. The chunk that is playing now
    // only changes when the engine can adjust it live; the system engine
    // cannot, so it is restarted with the new rate.
    const applied = await ensureNarrator().setRate(next);
    if (applied) return;
    const { status, chunkIndex } = get();
    if (status === 'playing' && chunks.length > 0) {
      await get().seekChunk(chunkIndex, true);
    }
  },

  /**
   * Switches the voice of the running session. The narrator is rebuilt for the
   * new engine and the current chunk is spoken again, so the change is heard
   * straight away instead of at the next session.
   */
  async setVoice(voiceId: string | null, engine?: NarrationEngineId) {
    const narration = useSettingsStore.getState().settings.narration;
    const next = {
      ...narration,
      voiceId,
      ...(engine ? { engine } : {}),
    };
    try {
      await useSettingsStore.getState().setSetting('narration', next);
    } catch (error) {
      console.warn('Could not persist narration voice', error);
    }
    const { status, sourceId, storyId, chunkIndex } = get();
    if (!sourceId || !storyId || chunks.length === 0) return;
    if (status === 'idle' || status === 'error') return;
    // The engine is bound to the narrator, so it is rebuilt for the new voice.
    await releaseNarrator();
    await get().seekChunk(chunkIndex, true);
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
    await get().seekChunk(chunkIndex, true);
  },

  /**
   * Jumps to a chapter of the current session. A chapter that the background
   * loader has not reached yet is fetched first, so the queue is always
   * playable.
   */
  async playChapter(chapterId: string) {
    const { sourceId, storyId } = get();
    if (!sourceId || !storyId) return;
    let chapter = narrationChapterList.find((item) => item.id === chapterId);
    if (!chapter) {
      // A chapter outside the loaded window is still playable: the player's
      // "up next" list and a jump to chapter 900 must not stop at the window.
      const list = await chapterRepository.listMetadata(sourceId, storyId).catch(() => []);
      const meta = list.find((item) => item.id === chapterId);
      if (!meta) return;
      chapter = { id: meta.id, position: meta.position, title: meta.title };
      narrationChapterList = [...narrationChapterList, chapter].sort(
        (a, b) => a.position - b.position,
      );
      narrationChapterTotal = Math.max(narrationChapterTotal, list.length);
      set({
        chapterWindow: [...narrationChapterList],
        chapterTotal: narrationChapterTotal,
      });
    }

    if (!narrationPages.some((page) => page.index === chapter.position)) {
      const rules = rulesForStory(usePronunciationStore.getState().rules, sourceId, storyId);
      try {
        let html = await chapterRepository.getContent(sourceId, storyId, chapter.id);
        if (!html) html = await getChapterHtml(sourceId, storyId, chapter.id);
        if (!html) return;
        const text = chapterText(parseChapterBlocks(html)).text;
        if (!text) return;
        const mapped = applyPronunciationMapped(text, rules);
        narrationPageMaps.set(chapter.position, { text, mapped });
        narrationPages = [
          ...narrationPages,
          { index: chapter.position, content: mapped.text },
        ].sort((a, b) => a.index - b.index);
      } catch {
        return;
      }
    }

    // The chunk list is rebuilt so the chapters stay in reading order, in the
    // same array the narrator holds.
    const rebuilt = chunkPages(narrationPages);
    if (rebuilt.length === 0) return;
    chunks.splice(0, chunks.length, ...rebuilt);
    set({ chunkCount: chunks.length });
    await get().seekChunk(chunkIndexForPage(chunks, chapter.position), true);
  },

  /**
   * Moves to the next or previous chapter of the narrated story. In chapter
   * mode the window is the truth; legacy page-based sessions fall back to the
   * series queue.
   */
  async playNextChapter() {
    await stepChapter(1);
  },

  async playPrevChapter() {
    await stepChapter(-1);
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
