import type { ChapterBlock } from '@/sources/content/parse';
import { stripDividerLines } from '@/utils/speech-text';

export type ChapterText = {
  /** Text-bearing blocks joined with a blank line, matching narration text. */
  text: string;
  /** Original block indexes that contributed text, in order. */
  blockIndexes: number[];
  /**
   * Source offsets of each contributing block inside `text`. The ranges are
   * contiguous and separated by the two-character blank line, so a character
   * offset in `text` always resolves to exactly one block.
   */
  spans: { blockIndex: number; start: number; end: number }[];
};

/** Plain chapter text used for TTS, search and paragraph progress. */
export function chapterText(blocks: readonly ChapterBlock[]): ChapterText {
  const parts: string[] = [];
  const blockIndexes: number[] = [];
  const spans: { blockIndex: number; start: number; end: number }[] = [];

  let cursor = 0;
  blocks.forEach((block, index) => {
    // Divider blocks ("***", "——") are decoration, not prose: dropping them
    // here keeps the voice and the reader on the same text.
    const text =
      block.kind === 'image' || block.kind === 'divider' ? '' : stripDividerLines(block.text);
    if (!text.trim()) return;
    if (parts.length > 0) cursor += 2;
    parts.push(text);
    blockIndexes.push(index);
    spans.push({ blockIndex: index, start: cursor, end: cursor + text.length });
    cursor += text.length;
  });

  return { text: parts.join('\n\n'), blockIndexes, spans };
}
