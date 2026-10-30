/**
 * Time estimates for the audio player.
 *
 * Narration has no clock of its own — the engine reports which chunk it is
 * speaking. Duration is therefore derived from the text itself: a chunk's word
 * count divided by a speaking rate. The rate is deliberately generous, because
 * an over-estimate makes the player feel slow rather than fast.
 */

/** A chunk of speech. Only its text matters for the timing. */
type TimedChunk = { text: string };

/** Words a narrator gets through in a minute at the default speed. */
export const WORDS_PER_MINUTE = 150;

export type PlayerTiming = {
  /** Elapsed time at the current speed. */
  elapsedMs: number;
  /** Total time of the loaded session. */
  totalMs: number;
  /** Time left. */
  remainingMs: number;
  /** Playback progress, 0 to 1. */
  fraction: number;
};

/** Milliseconds a piece of text takes to speak at a given speed. */
export function estimateDurationMs(text: string, speed = 1): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const rate = Math.max(0.25, speed) * WORDS_PER_MINUTE;
  return Math.round((words / rate) * 60_000);
}

/** Seconds a piece of text takes to speak at a given speed. */
export function estimateSeconds(text: string, speed = 1): number {
  return estimateDurationMs(text, speed) / 1000;
}

/**
 * The start time of every chunk on the session timeline, in seconds. The
 * engine reports no position, so the timeline is built from the estimated
 * length of each chunk.
 *
 * The clock recomputes this every second while the voice speaks, so the result
 * is kept for the session's chunk array: a long serial has thousands of chunks
 * and splitting every one of them once a second would cost more than the
 * speech itself.
 */
export function chunkOffsets(chunks: readonly TimedChunk[], speed = 1): number[] {
  const cached = offsetsCache.get(chunks);
  if (cached && cached.length === chunks.length && cached.speed === speed) {
    return cached.offsets;
  }
  const offsets: number[] = [];
  let elapsed = 0;
  for (const chunk of chunks) {
    offsets.push(elapsed);
    elapsed += estimateSeconds(chunk.text, speed);
  }
  offsetsCache.set(chunks, { length: chunks.length, speed, offsets });
  return offsets;
}

type OffsetsCacheEntry = { length: number; speed: number; offsets: number[] };
const offsetsCache = new WeakMap<readonly TimedChunk[], OffsetsCacheEntry>();

/**
 * Playback timing for a chunk list. The elapsed part counts the chunks before
 * the current one plus the part of the current chunk already spoken, which is
 * approximated by the chunk's own share. The timeline is the same one the
 * skip controls use, so the time on screen and a skip agree.
 */
export function playerTiming(
  chunks: readonly TimedChunk[],
  chunkIndex: number,
  speed = 1,
  intoChunk = 0,
  realElapsedMs = 0,
  count = chunks.length,
): PlayerTiming {
  if (chunks.length === 0 || count <= 0) {
    return { elapsedMs: 0, totalMs: 0, remainingMs: 0, fraction: 0 };
  }

  // `count` is how much of the session is loaded; the chunk array itself keeps
  // growing behind the clock, and passing it whole lets the offsets cache hit.
  const last = Math.min(count, chunks.length) - 1;
  const index = Math.min(Math.max(chunkIndex, 0), last);
  const offsets = chunkOffsets(chunks, speed);
  const totalMs = Math.round((offsets[last] + estimateSeconds(chunks[last].text, speed)) * 1000);
  if (totalMs <= 0) {
    return { elapsedMs: 0, totalMs: 0, remainingMs: 0, fraction: 0 };
  }

  // How far into the current chunk the voice is: known while it speaks, and
  // otherwise the midpoint is the best estimate. The last chunk counts as
  // fully spoken, so the bar can actually reach the end.
  const duration = estimateSeconds(chunks[index].text, speed);
  const into =
    index === last ? duration : intoChunk > 0 ? Math.min(intoChunk, duration) : duration / 2;
  const estimatedElapsedMs = Math.round((offsets[index] + into) * 1000);

  // The word count is an estimate, and a voice that pauses at punctuation
  // runs slower than it. When the real time is known, the clock shows it and
  // the total is scaled by the same factor, so the bar stays honest.
  let elapsedMs = estimatedElapsedMs;
  let scaledTotalMs = totalMs;
  if (realElapsedMs > 0 && estimatedElapsedMs > 0) {
    elapsedMs = realElapsedMs;
    scaledTotalMs = Math.round(totalMs * Math.max(1, realElapsedMs / estimatedElapsedMs));
  }

  return {
    elapsedMs,
    totalMs: scaledTotalMs,
    remainingMs: Math.max(0, scaledTotalMs - elapsedMs),
    fraction: Math.min(1, Math.max(0, elapsedMs / scaledTotalMs)),
  };
}

/**
 * The part of `text` a voice starting `seconds` in has not spoken yet. Used to
 * resume or skip inside a chunk, which the engines cannot seek to on their
 * own: they restart a chunk, so the caller hands them the tail of its text.
 * Lands on the word after a boundary so a half-spoken word is not read out.
 */
export function textFromSeconds(text: string, seconds: number, rate = 1): string {
  const duration = estimateSeconds(text, rate);
  if (seconds <= 0 || text.length === 0 || duration <= 0) return text;
  let offset = Math.min(Math.floor((seconds / duration) * text.length), text.length - 1);
  if (offset > 0) {
    // Speak whole words: start after the space ahead of the boundary when
    // there is one, otherwise after the one behind it, so an end-of-text
    // offset still lands on the final word instead of its last letter.
    const ahead = text.indexOf(' ', offset);
    const behind = text.lastIndexOf(' ', offset);
    offset = (ahead >= 0 ? ahead : behind) + 1;
  }
  if (offset >= text.length) offset = Math.max(0, text.length - 1);
  return text.slice(offset);
}

/** `14:02` for a duration under an hour, `1:02:03` beyond it. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/** A rough length of a chapter, used for the "up next" estimates. */
export function formatChapterLength(wordCount: number | null | undefined): string | null {
  if (!wordCount || wordCount <= 0) return null;
  const minutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  return `${minutes} min`;
}
