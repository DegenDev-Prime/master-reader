import type { SpeechChunk } from '@/narration/chunker';
import { sourceRangeForNarrationRange, type MappedNarration } from '@/services/pronunciation';

/**
 * Bridges narration chunks and the reader's block list for chapter-based
 * narration.
 *
 * Chunks index into the pronunciation-applied, whitespace-normalized chapter
 * text ("narration space"), while the reader displays the raw block text.
 * `MappedNarration` translates a narration-space range back into source-text
 * offsets, and a block span says which source offsets belong to which block.
 * Together they let the reader highlight the spoken block and seek to the
 * chunk that speaks a tapped block.
 */

export type ChapterBlockSpan = {
  blockIndex: number;
  /** Inclusive start of the block inside the chapter text. */
  start: number;
  /** Exclusive end of the block inside the chapter text. */
  end: number;
};

/** The block a source-text range falls in; null when the range is empty. */
export function blockIndexForRange(
  spans: readonly ChapterBlockSpan[],
  range: { start: number; end: number },
): number | null {
  if (range.end <= range.start) return null;
  for (const span of spans) {
    if (span.start < range.end && range.start < span.end) return span.blockIndex;
  }
  return null;
}

/**
 * Index of the chunk that speaks a block. Only chunks of the same chapter
 * count: a chunk from another chapter indexes a different narration text and
 * would map to the wrong offsets. The returned index is into `chunks`.
 */
export function chunkIndexForBlock(
  chunks: readonly SpeechChunk[],
  mapped: MappedNarration,
  spans: readonly ChapterBlockSpan[],
  blockIndex: number,
  pageIndex: number,
): number | null {
  const span = spans.find((item) => item.blockIndex === blockIndex);
  if (!span) return null;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (chunk.pageIndex !== pageIndex) continue;
    const range = sourceRangeForNarrationRange(mapped, chunk.start, chunk.end);
    if (range.start < span.end && span.start < range.end) return index;
  }
  return null;
}
