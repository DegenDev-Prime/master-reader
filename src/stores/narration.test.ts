import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NarrationStatus } from '@/narration/types';

type SeriesFixture = {
  id: string;
  title: string;
  items: { id: string; title: string }[];
};

type DetailsFixture = {
  title: string;
  series?: SeriesFixture | null;
};

type PagesFixture = { index: number; content: string }[];

type ChapterFixture = {
  id: string;
  position: number;
  number: number;
  title: string;
};

const mocks = vi.hoisted(() => ({
  systemEngine: {
    id: 'system',
    listVoices: vi.fn(() => Promise.resolve([])),
    speak: vi.fn(() => new Promise<void>(() => {})),
    stop: vi.fn(() => Promise.resolve()),
    isSpeaking: vi.fn(() => Promise.resolve(false)),
    setRate: vi.fn(() => Promise.resolve(false)),
  },
  chapterText: vi.fn(() => ({ text: 'A sentence of the chapter.', blockIndexes: [], spans: [] })),
  getStoryDetails: vi.fn((_sourceId: string, storyId: string): Promise<DetailsFixture> =>
    Promise.resolve({ title: `Title ${storyId}`, series: null }),
  ),
  getStoryPages: vi.fn((): Promise<PagesFixture> => Promise.resolve([])),
  loadProgress: vi.fn((): Promise<{ pageIndex: number; pageCount: number } | null> =>
    Promise.resolve(null),
  ),
  saveReadingProgress: vi.fn(() => Promise.resolve()),
  setSetting: vi.fn(() => Promise.resolve()),
  narrationGet: vi.fn((): Promise<{ chunkIndex: number } | null> => Promise.resolve(null)),
  narrationSave: vi.fn(() => Promise.resolve()),
  bookmarksList: vi.fn(() => Promise.resolve([])),
  bookmarksAdd: vi.fn(() => Promise.resolve()),
  bookmarksRemove: vi.fn(() => Promise.resolve()),
  settingsGet: vi.fn(() => Promise.resolve(undefined)),
  settingsSet: vi.fn(() => Promise.resolve()),
  chapterList: vi.fn((): Promise<ChapterFixture[]> => Promise.resolve([])),
  chapterContent: vi.fn(
    (_sourceId: string, _novelId: string, _chapterId: string): Promise<string | null> =>
      Promise.resolve(null),
  ),
  chapterHtml: vi.fn(() => Promise.resolve(null)),
  progressGet: vi.fn(() => Promise.resolve(null)),
  progressSave: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/narration/engines/system', () => ({ systemEngine: mocks.systemEngine }));
vi.mock('@/narration/engines/neural', () => ({ createNeuralEngine: vi.fn(() => ({})) }));
vi.mock('@/services/catalog', () => ({
  getStoryDetails: mocks.getStoryDetails,
  getStoryPages: mocks.getStoryPages,
}));
vi.mock('@/services/reading', () => ({
  loadProgress: mocks.loadProgress,
  saveReadingProgress: mocks.saveReadingProgress,
}));
vi.mock('@/stores/settings', () => ({
  useSettingsStore: {
    getState: () => ({
      settings: {
        defaultLanguage: 'en',
        narration: {
          engine: 'system',
          voiceId: null,
          speed: 1,
          autoRewindSeconds: 3,
          skipSeconds: 15,
          sleepMinutes: 15,
        },
      },
      setSetting: mocks.setSetting,
    }),
  },
}));
vi.mock('@/db/repositories', () => ({
  narrationRepository: { get: mocks.narrationGet, save: mocks.narrationSave },
  narrationBookmarksRepository: {
    add: mocks.bookmarksAdd,
    listForStory: mocks.bookmarksList,
    remove: mocks.bookmarksRemove,
  },
  settingsRepository: { get: mocks.settingsGet, set: mocks.settingsSet },
  progressRepository: { get: mocks.progressGet, save: mocks.progressSave },
}));
vi.mock('@/db/repositories/chapters', () => ({
  chapterRepository: {
    listMetadata: mocks.chapterList,
    getContent: mocks.chapterContent,
  },
}));
vi.mock('@/services/novel-catalog', () => ({ getChapterHtml: mocks.chapterHtml }));
vi.mock('@/sources/content/parse', () => ({ parseChapterBlocks: vi.fn(() => []) }));
vi.mock('@/sources/content/chapter-text', () => ({
  chapterText: mocks.chapterText,
}));

type NarrationModule = typeof import('./narration');

let store: NarrationModule['useNarrationStore'];

type SessionPatch = {
  sourceId?: string | null;
  storyId?: string | null;
  status?: NarrationStatus;
  chunkIndex?: number;
};

function startSession(storyId: string, patch: SessionPatch = {}): void {
  store.setState({ sourceId: 'src', storyId, status: 'playing', chunkIndex: 0, ...patch });
}

function stubNavigation() {
  const play = vi
    .fn<(sourceId: string, storyId: string, title?: string | null) => Promise<void>>()
    .mockResolvedValue(undefined);
  const seekChunk = vi.fn<(index: number) => Promise<void>>().mockResolvedValue(undefined);
  store.setState({ play, seekChunk });
  return { play, seekChunk };
}

function mockSeries(...ids: string[]): void {
  const items = ids.map((id) => ({ id, title: `Title ${id}` }));
  mocks.getStoryDetails.mockImplementation(async (_sourceId, storyId) => ({
    title: `Title ${storyId}`,
    series: { id: 'series-1', title: 'Series', items },
  }));
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function startNarration(): Promise<void> {
  mocks.getStoryPages.mockResolvedValue([
    { index: 0, content: 'First sentence of the story.' },
    { index: 1, content: 'Second sentence of the story.' },
  ]);
  mocks.getStoryDetails.mockResolvedValue({ title: 'Title one', series: null });
  void store.getState().play('src', 'one', 'Title one');
  await vi.waitFor(() => expect(store.getState().status).toBe('playing'));
}

beforeEach(async () => {
  vi.resetModules();
  mocks.getStoryDetails.mockReset().mockResolvedValue({ title: 'Story', series: null });
  mocks.getStoryPages.mockReset().mockResolvedValue([]);
  mocks.setSetting.mockReset().mockResolvedValue(undefined);
  mocks.systemEngine.speak.mockClear();
  mocks.systemEngine.stop.mockClear();
  mocks.systemEngine.setRate.mockReset().mockResolvedValue(false);
  mocks.chapterText.mockReset().mockReturnValue({
    text: 'A sentence of the chapter.',
    blockIndexes: [],
    spans: [],
  });
  mocks.chapterList.mockReset().mockResolvedValue([]);
  mocks.chapterContent.mockReset().mockResolvedValue(null);
  mocks.narrationGet.mockClear();
  mocks.narrationSave.mockClear();
  mocks.bookmarksList.mockClear();
  mocks.loadProgress.mockClear();
  mocks.saveReadingProgress.mockClear();
  store = (await import('./narration')).useNarrationStore;
});

describe('playNextInQueue', () => {
  it('is a no-op without a session', async () => {
    const { play } = stubNavigation();
    await store.getState().playNextInQueue();
    expect(mocks.getStoryDetails).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('ignores jumps while a session is still loading', async () => {
    const { play } = stubNavigation();
    startSession('b', { status: 'loading' });
    await store.getState().playNextInQueue();
    expect(mocks.getStoryDetails).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('plays the following chapter with the details title', async () => {
    const { play } = stubNavigation();
    startSession('b');
    mockSeries('a', 'b', 'c');
    await store.getState().playNextInQueue();
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('src', 'c', 'Title c');
  });

  it('stops at the last chapter of the series', async () => {
    const { play } = stubNavigation();
    startSession('c');
    mockSeries('a', 'b', 'c');
    await store.getState().playNextInQueue();
    expect(play).not.toHaveBeenCalled();
  });

  it('never restarts the series when the story is absent from it', async () => {
    const { play } = stubNavigation();
    startSession('zzz');
    mockSeries('a', 'b', 'c');
    await store.getState().playNextInQueue();
    expect(play).not.toHaveBeenCalled();
  });

  it('does nothing for a story without a series', async () => {
    const { play } = stubNavigation();
    startSession('b');
    await store.getState().playNextInQueue();
    expect(play).not.toHaveBeenCalled();
  });
});

describe('playPrevInQueue', () => {
  it('is a no-op without a session', async () => {
    const { play, seekChunk } = stubNavigation();
    await store.getState().playPrevInQueue();
    expect(mocks.getStoryDetails).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    expect(seekChunk).not.toHaveBeenCalled();
  });

  it('ignores jumps while a session is still loading', async () => {
    const { play, seekChunk } = stubNavigation();
    startSession('b', { status: 'loading', chunkIndex: 4 });
    await store.getState().playPrevInQueue();
    expect(mocks.getStoryDetails).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    expect(seekChunk).not.toHaveBeenCalled();
  });

  it('plays the preceding chapter with the details title', async () => {
    const { play } = stubNavigation();
    startSession('c');
    mockSeries('a', 'b', 'c');
    await store.getState().playPrevInQueue();
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('src', 'b', 'Title b');
  });

  it('rewinds one part from the first chapter', async () => {
    const { play, seekChunk } = stubNavigation();
    startSession('a', { chunkIndex: 5 });
    mockSeries('a', 'b');
    await store.getState().playPrevInQueue();
    expect(seekChunk).toHaveBeenCalledTimes(1);
    expect(seekChunk).toHaveBeenCalledWith(4);
    expect(play).not.toHaveBeenCalled();
  });

  it('rewinds one part for a story without a series', async () => {
    const { play, seekChunk } = stubNavigation();
    startSession('b', { chunkIndex: 2 });
    await store.getState().playPrevInQueue();
    expect(seekChunk).toHaveBeenCalledWith(1);
    expect(play).not.toHaveBeenCalled();
  });

  it('does nothing at the very first chunk', async () => {
    const { play, seekChunk } = stubNavigation();
    startSession('a', { chunkIndex: 0 });
    mockSeries('a');
    await store.getState().playPrevInQueue();
    expect(seekChunk).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('reuses the cached series instead of refetching details', async () => {
    stubNavigation();
    startSession('a', { chunkIndex: 5 });
    mockSeries('a', 'b');
    await store.getState().playPrevInQueue();
    await store.getState().playPrevInQueue();
    expect(mocks.getStoryDetails).toHaveBeenCalledTimes(1);
  });
});

describe('setSpeed', () => {
  it('rounds to quarter steps and persists the choice', async () => {
    await store.getState().setSpeed(1.2);
    expect(store.getState().speed).toBe(1.25);
    expect(mocks.setSetting).toHaveBeenCalledWith(
      'narration',
      expect.objectContaining({ speed: 1.25 }),
    );
  });

  it('clamps to the range the engine accepts', async () => {
    await store.getState().setSpeed(9);
    expect(store.getState().speed).toBe(3);
    await store.getState().setSpeed(0.1);
    expect(store.getState().speed).toBe(0.5);
  });

  it('applies the new speed even when persistence fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.setSetting.mockRejectedValueOnce(new Error('disk full'));
    await store.getState().setSpeed(1.5);
    expect(store.getState().speed).toBe(1.5);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps a paused narration paused instead of restarting it', async () => {
    await startNarration();
    await store.getState().pause();
    expect(store.getState().status).toBe('paused');
    const speaks = mocks.systemEngine.speak.mock.calls.length;

    void store.getState().setSpeed(1.5);
    await vi.waitFor(() => expect(store.getState().speed).toBe(1.5));
    await flush();

    expect(store.getState().status).toBe('paused');
    expect(mocks.systemEngine.speak.mock.calls.length).toBe(speaks);
  });

  it('restarts a playing narration so the new rate takes effect', async () => {
    await startNarration();
    const speaks = mocks.systemEngine.speak.mock.calls.length;

    void store.getState().setSpeed(1.5);
    await vi.waitFor(() => expect(mocks.systemEngine.speak.mock.calls.length).toBe(speaks + 1));

    expect(store.getState().status).toBe('playing');
  });
});

describe('live rate changes', () => {
  it('changes the rate of the running playback when the engine supports it', async () => {
    await startNarration();
    mocks.systemEngine.setRate.mockResolvedValue(true);
    const speaks = mocks.systemEngine.speak.mock.calls.length;

    await store.getState().setSpeed(1.5);

    expect(mocks.systemEngine.setRate).toHaveBeenCalledWith(1.5);
    // The chunk that is playing is not restarted.
    expect(mocks.systemEngine.speak.mock.calls.length).toBe(speaks);
  });

  it('restarts the chunk when the engine cannot change the rate', async () => {
    await startNarration();
    mocks.systemEngine.setRate.mockResolvedValue(false);
    const speaks = mocks.systemEngine.speak.mock.calls.length;

    await store.getState().setSpeed(1.5);

    expect(mocks.systemEngine.speak.mock.calls.length).toBe(speaks + 1);
  });
});

describe('setVoice', () => {
  it('persists the voice and restarts the running session with it', async () => {
    await startNarration();
    const speaks = mocks.systemEngine.speak.mock.calls.length;

    await store.getState().setVoice('voice-2');

    expect(mocks.setSetting).toHaveBeenCalledWith(
      'narration',
      expect.objectContaining({ voiceId: 'voice-2' }),
    );
    // The new voice is heard straight away.
    expect(mocks.systemEngine.speak.mock.calls.length).toBe(speaks + 1);
  });

  it('keeps the current engine when only the voice changes', async () => {
    await startNarration();
    await store.getState().setVoice(null);
    expect(mocks.setSetting).toHaveBeenCalledWith(
      'narration',
      expect.objectContaining({ voiceId: null }),
    );
  });

  it('does nothing to a session that is not running', async () => {
    await store.getState().setVoice('voice-2');
    expect(mocks.systemEngine.speak).not.toHaveBeenCalled();
  });
});

describe('fast start', () => {
  it('speaks the first chapter before the rest of the window has loaded', async () => {
    mocks.chapterList.mockResolvedValue([
      { id: 'c1', position: 0, number: 1, title: 'One' },
      { id: 'c2', position: 1, number: 2, title: 'Two' },
    ]);
    mocks.chapterContent.mockImplementation(async (_source: string, _novel: string, id: string) => {
      if (id === 'c1') return '<p>First chapter.</p>';
      // The second chapter is still on the network.
      await new Promise(() => {});
      return null;
    });

    void store.getState().play('src', 'one', 'Title one');

    // The session is playing even though the second chapter never arrived.
    await vi.waitFor(() => expect(store.getState().status).toBe('playing'));
    expect(store.getState().chunkCount).toBe(1);
  });
});

describe('sleep timer', () => {
  it('arms and clears the end-of-chapter mode', () => {
    store.getState().setSleepEndOfChapter();
    expect(store.getState().sleep.mode).toBe('endOfChapter');
    store.getState().clearSleep();
    expect(store.getState().sleep.mode).toBe('off');
  });

  it('arms a minutes timer at now plus the delay', () => {
    const before = Date.now();
    store.getState().setSleepMinutes(10);
    const sleep = store.getState().sleep;
    expect(sleep.mode).toBe('minutes');
    if (sleep.mode === 'minutes') {
      expect(sleep.endsAtMs).toBeGreaterThanOrEqual(before + 10 * 60_000);
    }
    store.getState().clearSleep();
    expect(store.getState().sleep.mode).toBe('off');
  });

  it('cancels a pending minutes timer', () => {
    store.getState().setSleepMinutes(5);
    store.getState().setSleepMinutes(null);
    expect(store.getState().sleep.mode).toBe('off');
  });

  it('clearSleep is a no-op when no timer runs', () => {
    let updates = 0;
    const unsubscribe = store.subscribe(() => {
      updates += 1;
    });
    store.getState().clearSleep();
    unsubscribe();
    expect(updates).toBe(0);
  });

  it('clears an armed timer when a new session starts', async () => {
    store.getState().setSleepEndOfChapter();
    await startNarration();
    expect(store.getState().sleep.mode).toBe('off');
  });
});

describe('series chapter availability', () => {
  it('records a standalone story as position -1 with no series', async () => {
    await startNarration();
    expect(store.getState().seriesPosition).toBe(-1);
    expect(store.getState().seriesLength).toBe(0);
  });

  it('records the position of the narrated story within its series', async () => {
    mocks.getStoryPages.mockResolvedValue([{ index: 0, content: 'First sentence of the story.' }]);
    mockSeries('a', 'b', 'c');
    void store.getState().play('src', 'b', 'Title b');
    await vi.waitFor(() => expect(store.getState().status).toBe('playing'));
    expect(store.getState().seriesPosition).toBe(1);
    expect(store.getState().seriesLength).toBe(3);
  });

  it('resets availability when the session stops', async () => {
    await startNarration();
    await store.getState().stop();
    expect(store.getState().seriesPosition).toBe(-1);
    expect(store.getState().seriesLength).toBe(0);
  });

  it('clears a previous series while the next session loads', async () => {
    mocks.getStoryPages.mockResolvedValue([{ index: 0, content: 'First sentence of the story.' }]);
    mockSeries('a', 'b');
    void store.getState().play('src', 'a', 'Title a');
    await vi.waitFor(() => expect(store.getState().seriesLength).toBe(2));

    mocks.getStoryDetails.mockResolvedValue({ title: 'Story', series: null });
    void store.getState().play('src', 'other', 'Other');
    await vi.waitFor(() => expect(store.getState().seriesPosition).toBe(-1));
    expect(store.getState().seriesLength).toBe(0);
    await vi.waitFor(() => expect(store.getState().status).toBe('playing'));
  });
});

describe('skip responsiveness', () => {
  it('moves the player at once and restarts the engine once for a burst of taps', async () => {
    await startNarration();
    vi.useFakeTimers();
    try {
      const speaks = mocks.systemEngine.speak.mock.calls.length;

      await store.getState().seekChunk(1);
      await store.getState().seekChunk(1);

      // The part on screen moves on the tap, before the engine is touched.
      expect(store.getState().chunkIndex).toBe(1);
      expect(mocks.systemEngine.speak.mock.calls.length).toBe(speaks);

      await vi.advanceTimersByTimeAsync(300);
      expect(mocks.systemEngine.speak.mock.calls.length).toBe(speaks + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start speaking when the session is paused', async () => {
    await startNarration();
    await store.getState().pause();
    const speaks = mocks.systemEngine.speak.mock.calls.length;

    await store.getState().seekChunk(1);
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(store.getState().chunkIndex).toBe(1);
    expect(mocks.systemEngine.speak.mock.calls.length).toBe(speaks);
  });
});

describe('resume and skip inside a chunk', () => {
  /** 30 words take 12 seconds at the player's estimate. */
  const words = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');

  async function startLongSession(): Promise<void> {
    mocks.getStoryPages.mockResolvedValue([
      { index: 0, content: words },
      { index: 1, content: `${words} again` },
    ]);
    mocks.getStoryDetails.mockResolvedValue({ title: 'Title one', series: null });
    void store.getState().play('src', 'one', 'Title one');
    await vi.waitFor(() => expect(store.getState().status).toBe('playing'));
  }

  it('resumes the unspoken tail instead of restarting the chunk', async () => {
    await startLongSession();
    // The voice is six seconds into the twelve-second chunk.
    store.setState({ chunkStartedAt: Date.now() - 6000 });

    await store.getState().pause();
    expect(store.getState().positionAt(Date.now())).toBeGreaterThan(5);

    // The three second rewind keeps the resume inside the chunk: the tail is
    // spoken instead of the chunk restarting from its first word.
    await store.getState().resume();
    await vi.waitFor(() => expect(mocks.systemEngine.speak.mock.calls.length).toBe(2));
    const request = (
      (mocks.systemEngine.speak.mock.calls[1] ?? null) as unknown as
        [{ chunk: { text: string } }] | null
    )?.[0];
    expect(request).not.toBeNull();
    expect(request?.chunk.text.length).toBeLessThan(words.length);
    expect(words.endsWith(request?.chunk.text ?? '')).toBe(true);
    const position = store.getState().positionAt(Date.now());
    expect(position).toBeGreaterThanOrEqual(2.5);
    expect(position).toBeLessThan(6);
  });

  it('skips across the chunk with the time still left inside it', async () => {
    await startLongSession();
    store.setState({ chunkStartedAt: Date.now() - 6000 });

    await store.getState().skip(15);
    await new Promise((resolve) => setTimeout(resolve, 150));

    await vi.waitFor(() => expect(mocks.systemEngine.speak.mock.calls.length).toBe(2));
    const request = (
      (mocks.systemEngine.speak.mock.calls[1] ?? null) as unknown as
        [{ chunk: { id: string; text: string } }] | null
    )?.[0];
    expect(request).not.toBeNull();
    // 6s + 15s reaches 21s, nine seconds into the second page's chunk.
    expect(request?.chunk.id).toBe('1:0');
    expect(request?.chunk.text.length).toBeLessThan(`${words} again`.length);
    expect(`${words} again`.endsWith(request?.chunk.text ?? '')).toBe(true);
  });
});
