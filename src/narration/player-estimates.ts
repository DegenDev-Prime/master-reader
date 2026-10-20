/**
 * Time estimates for the audio player.
 *
 * Narration has no clock of its own — the engine reports which chunk it is
 * speaking. Duration is therefore derived from the text itself: a chunk's word
 * count divided by a speaking rate. The rate is deliberately generous, because
 * an over-estimate makes the player feel slow rather than fast.
 */

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

/**
 * Playback timing for a chunk list. The elapsed part counts the chunks before
 * the current one plus the part of the current chunk already spoken, which is
 * approximated by the chunk's own share.
 */
export function playerTiming(
  chunks: readonly { text: string }[],
  chunkIndex: number,
  speed = 1,
): PlayerTiming {
  if (chunks.length === 0) {
    return { elapsedMs: 0, totalMs: 0, remainingMs: 0, fraction: 0 };
  }

  const index = Math.min(Math.max(chunkIndex, 0), chunks.length - 1);
  let totalChars = 0;
  for (const chunk of chunks) totalChars += chunk.text.length;
  if (totalChars === 0) {
    return { elapsedMs: 0, totalMs: 0, remainingMs: 0, fraction: 0 };
  }

  let elapsedChars = 0;
  for (let position = 0; position < index; position += 1) {
    elapsedChars += chunks[position].text.length;
  }
  // How far into the current chunk the voice is, is unknown; the midpoint is
  // the best estimate. The last chunk counts as fully spoken, so the bar can
  // actually reach the end.
  elapsedChars +=
    index === chunks.length - 1 ? chunks[index].text.length : chunks[index].text.length / 2;

  const totalMs = estimateDurationMs(chunks.map((chunk) => chunk.text).join(' '), speed);
  const elapsedMs = Math.round((elapsedChars / totalChars) * totalMs);
  const remainingMs = Math.max(0, totalMs - elapsedMs);

  return {
    elapsedMs,
    totalMs,
    remainingMs,
    fraction: Math.min(1, Math.max(0, elapsedChars / totalChars)),
  };
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
