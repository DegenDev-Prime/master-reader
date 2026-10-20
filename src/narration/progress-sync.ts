import type { SpeechChunk } from './chunker';

/**
 * Bidirectional mapping between narration chunks and reader pages so audio
 * and text stay in sync: listening advances the reading position, and
 * starting narration resumes from the furthest of the two. Pure functions,
 * covered by unit tests.
 */

/** Reader page index containing the given chunk. */
export function pageIndexForChunk(chunks: SpeechChunk[], chunkIndex: number): number {
  if (chunks.length === 0) return 0;
  const clamped = Math.min(Math.max(0, Math.floor(chunkIndex)), chunks.length - 1);
  return chunks[clamped].pageIndex;
}

/** Total reader page count covered by the chunks. */
export function pageCountForChunks(chunks: SpeechChunk[]): number {
  if (chunks.length === 0) return 0;
  return chunks.reduce((max, chunk) => Math.max(max, chunk.pageIndex), 0) + 1;
}

/** First chunk at or after the given reader page (for resuming audio from text). */
export function chunkIndexForPage(chunks: SpeechChunk[], pageIndex: number): number {
  if (chunks.length === 0) return 0;
  const found = chunks.findIndex((chunk) => chunk.pageIndex >= Math.max(0, pageIndex));
  return found === -1 ? chunks.length - 1 : found;
}
