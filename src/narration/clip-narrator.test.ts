import { describe, expect, it, vi } from 'vitest';

import { ClipNarrator, type ClipPlayer } from './clip-narrator';
import type { SpeechChunk } from './chunker';
import { startEndOfChapterTimer, stopSleepTimer } from './sleep-timer';

vi.mock('./audio-output', () => ({
  playAudioFile: vi.fn(),
  pauseAudio: vi.fn(async () => {}),
  isAudioPlaying: vi.fn(() => false),
  setAudioRate: vi.fn(() => true),
  audioPosition: vi.fn(() => null),
  audioDuration: vi.fn(() => null),
  unloadAudioPlayer: vi.fn(async () => {}),
}));

const chunk = (index: number, text: string, pageIndex = 0): SpeechChunk => ({
  id: `${pageIndex}:${index}`,
  pageIndex,
  start: 0,
  end: text.length,
  text,
});

const chunks = [chunk(0, 'one'), chunk(1, 'two'), chunk(2, 'three')];

class FakePlayer implements ClipPlayer {
  readonly played: string[] = [];
  failures = 0;
  rate = 1;
  paused = false;
  private resolve: (() => void) | null = null;
  private reject: ((error: Error) => void) | null = null;

  play(
    uri: string,
    _meta: { title: string; artist: string },
    _rate: number,
    _isAborted: () => boolean,
    _startSeconds?: number,
    onStart?: () => void,
  ): Promise<void> {
    this.played.push(uri);
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(new Error('play failed'));
    }
    onStart?.();
    return new Promise<void>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  finish(): void {
    this.resolve?.();
    this.reset();
  }

  fail(error: Error): void {
    this.reject?.(error);
    this.reset();
  }

  async pause(): Promise<void> {
    this.paused = true;
  }

  isPlaying(): boolean {
    return !this.paused;
  }

  setRate(rate: number): boolean {
    this.rate = rate;
    return true;
  }

  positionSeconds(): number | null {
    return 0;
  }

  private reset(): void {
    this.resolve = null;
    this.reject = null;
  }
}

function makeNarrator(
  player: FakePlayer,
  options: {
    synthesize?: (text: string) => Promise<{ uri: string; durationMs?: number }>;
    sleep?: () => ReturnType<typeof stopSleepTimer> | ReturnType<typeof startEndOfChapterTimer>;
    onDone?: (reason: string) => void;
    onError?: (error: Error) => void;
    onChunk?: (index: number) => void;
    onWarning?: (index: number) => void;
  } = {},
) {
  return new ClipNarrator(
    {
      synth: {
        synthesize:
          options.synthesize ??
          (async (text) => ({ uri: `file:///${text}.wav`, durationMs: 1000 })),
      },
      title: () => 'story',
      artist: () => 'voice',
      getSleepState: options.sleep ?? (() => stopSleepTimer()),
      nowMs: () => 0,
      getRate: () => 1,
      onProgress: vi.fn(),
      player,
      retryDelay: async () => {},
    },
    {
      onDone: options.onDone,
      onError: options.onError,
      onChunk: options.onChunk,
      onWarning: options.onWarning,
    },
  );
}

async function waitFor(condition: () => boolean, timeoutMs = 500): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('ClipNarrator', () => {
  it('plays ready clips in stack order and advances on finish', async () => {
    const player = new FakePlayer();
    const onChunk = vi.fn();
    const narrator = makeNarrator(player, { onChunk });

    narrator.play({ chunks, startIndex: 0, rate: 1 });
    await waitFor(() => player.played.length === 1);
    expect(player.played[0]).toBe('file:///one.wav');
    expect(onChunk).toHaveBeenLastCalledWith(0);

    player.finish();
    await waitFor(() => player.played.length === 2);
    expect(player.played[1]).toBe('file:///two.wav');
    expect(onChunk).toHaveBeenLastCalledWith(1);
  });

  it('skips a clip that cannot be synthesized and plays the next one', async () => {
    const player = new FakePlayer();
    const onError = vi.fn();
    const onWarning = vi.fn();
    const narrator = makeNarrator(player, {
      synthesize: async (text) => {
        if (text === 'one') throw new Error('synth failed');
        return { uri: `file:///${text}.wav` };
      },
      onError,
      onWarning,
    });

    narrator.play({ chunks, startIndex: 0, rate: 1 });
    await waitFor(() => player.played.length === 1);

    expect(player.played[0]).toBe('file:///two.wav');
    expect(onError).not.toHaveBeenCalled();
    expect(onWarning).toHaveBeenCalledWith(0);
  });

  it('retries a playback failure once, then skips the clip', async () => {
    const player = new FakePlayer();
    player.failures = 1;
    const narrator = makeNarrator(player);

    narrator.play({ chunks, startIndex: 0, rate: 1 });
    await waitFor(() => player.played.length >= 2);
    expect(player.played[0]).toBe('file:///one.wav');
    expect(player.played[1]).toBe('file:///one.wav');

    player.finish();
    await waitFor(() => player.played.length >= 3);
    expect(player.played[2]).toBe('file:///two.wav');
  });

  it('reports a fatal error when every clip dies', async () => {
    const player = new FakePlayer();
    const onError = vi.fn();
    const narrator = makeNarrator(player, {
      synthesize: async () => {
        throw new Error('synth failed');
      },
      onError,
    });

    narrator.play({ chunks, startIndex: 0, rate: 1 });
    await waitFor(() => onError.mock.calls.length > 0);

    expect(player.played).toEqual([]);
  });

  it('pauses at a chapter boundary for the end-of-chapter sleep timer', async () => {
    const player = new FakePlayer();
    const onDone = vi.fn();
    const narrator = makeNarrator(player, {
      sleep: () => startEndOfChapterTimer(),
      onDone,
    });

    narrator.play({
      chunks: [chunk(0, 'one', 0), chunk(1, 'two', 1)],
      startIndex: 0,
      rate: 1,
    });
    await waitFor(() => player.played.length === 1);
    player.finish();

    await waitFor(() => onDone.mock.calls.length > 0);
    expect(onDone).toHaveBeenCalledWith('endOfChapter');
    expect(player.played).toHaveLength(1);
  });
});
