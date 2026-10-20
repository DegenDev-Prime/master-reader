import type { ChapterRef } from '@/sources/types';

/**
 * The chapter number shown to the reader.
 *
 * Providers name their chapters in many ways ("Chapter 6", "Part 2", "6: The
 * Title"), so the number is read from the title when it leads with one. A
 * provider whose ids are plain numbers but whose titles carry no number — the
 * creator archives, for instance — returns null, and the reader counts the
 * chapters itself.
 */
export function chapterNumberFromRef(ref: ChapterRef): number | null {
  const leading = /^\s*(?:chapter|chap|ch|part|episode|ep)\.?\s*#?\s*(\d+)/i.exec(ref.title ?? '');
  if (leading) {
    const value = Number(leading[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}
