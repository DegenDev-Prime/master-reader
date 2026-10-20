import type { SpeechChunk } from '@/narration/chunker';
import { sourceRangeForNarrationRange, type MappedNarration } from '@/services/pronunciation';

/**
 * Bridges narration chunks and the reader's displayed page text.
 *
 * Chunks index into the pronunciation-applied, whitespace-normalized page text
 * ("narration space"), while the reader displays the raw plain text produced
 * by `htmlToPlainText`, whose blank-line breaks (`\n\n`) separate paragraphs.
 * Everything here is pure: it works over the reader text it is handed and the
 * mapped text produced by `applyPronunciationMapped`.
 */

export type ParagraphSpan = {
  /** Inclusive start of the paragraph within the reader text. */
  start: number;
  /** Exclusive end of the paragraph within the reader text. */
  end: number;
};

/** A chunk annotated with its index in the whole session's chunk list. */
export type ChunkEntry = {
  index: number;
  chunk: SpeechChunk;
};

/** Splits a page's text into paragraph spans, mirroring `\n\n` breaks. */
export function paragraphSpans(text: string): ParagraphSpan[] {
  const spans: ParagraphSpan[] = [];
  const breaks = /\n{2,}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = breaks.exec(text)) !== null) {
    spans.push({ start: cursor, end: match.index });
    cursor = match.index + match[0].length;
  }
  spans.push({ start: cursor, end: text.length });
  return spans;
}

/** Slices one paragraph out of the reader text. */
export function paragraphText(text: string, span: ParagraphSpan): string {
  return text.slice(span.start, span.end);
}

/** Page chunks annotated with their global index, in narration order. */
export function chunksForPage(chunks: readonly SpeechChunk[], pageIndex: number): ChunkEntry[] {
  const entries: ChunkEntry[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    if (chunks[index].pageIndex === pageIndex) entries.push({ index, chunk: chunks[index] });
  }
  return entries;
}

/** Narration-space range of a chunk, translated into reader-text space. */
export function sourceRangeForChunk(
  mapped: MappedNarration,
  chunk: SpeechChunk,
): { start: number; end: number } {
  return sourceRangeForNarrationRange(mapped, chunk.start, chunk.end);
}

/** Paragraph indexes the narration-space range reaches; empty when it is blank. */
export function paragraphIndexesForRange(
  spans: readonly ParagraphSpan[],
  range: { start: number; end: number },
): number[] {
  const hits: number[] = [];
  for (let index = 0; index < spans.length; index += 1) {
    const span = spans[index];
    if (span.start < range.end && range.start < span.end) hits.push(index);
  }
  return hits;
}

/**
 * Global index of the first chunk whose reader-space range touches the
 * paragraph — the chunk the voice should jump to for tap-to-move. Falls back
 * to the nearest following chunk so trailing pages never lose their taps.
 */
export function chunkIndexForParagraph(
  entries: readonly ChunkEntry[],
  mapped: MappedNarration,
  span: ParagraphSpan,
): number | null {
  for (const entry of entries) {
    const range = sourceRangeForChunk(mapped, entry.chunk);
    if (range.start < span.end && span.start < range.end) return entry.index;
  }
  for (const entry of entries) {
    if (sourceRangeForChunk(mapped, entry.chunk).end > span.start) return entry.index;
  }
  return entries.length > 0 ? entries[entries.length - 1].index : null;
}
