import { describe, expect, it } from 'vitest';

import { blockIndexForRange, chunkIndexForBlock } from '@/narration/chapter-highlight';
import type { SpeechChunk } from '@/narration/chunker';
import { applyPronunciationMapped } from '@/services/pronunciation';

const SOURCE = 'Siobhan met Siobhan. The crowd cheered. Siobhan smiled.';
const RULES = [{ id: '1', scope: 'global', find: 'Siobhan', replace: 'Shi-VAWN' }];

const SPANS = [
  { blockIndex: 0, start: 0, end: 26 },
  { blockIndex: 1, start: 28, end: 45 },
  { blockIndex: 2, start: 47, end: 62 },
];

function chunk(pageIndex: number, start: number, end: number): SpeechChunk {
  return { id: `${pageIndex}:${start}`, pageIndex, start, end, text: '' };
}

describe('blockIndexForRange', () => {
  it('finds the block a source range lands in', () => {
    expect(blockIndexForRange(SPANS, { start: 4, end: 10 })).toBe(0);
    expect(blockIndexForRange(SPANS, { start: 30, end: 31 })).toBe(1);
    expect(blockIndexForRange(SPANS, { start: 50, end: 60 })).toBe(2);
  });

  it('returns null for an empty range', () => {
    expect(blockIndexForRange(SPANS, { start: 10, end: 10 })).toBeNull();
  });
});

describe('chunkIndexForBlock', () => {
  it('finds the chunk that speaks a block despite pronunciation rules', () => {
    const mapped = applyPronunciationMapped(SOURCE, RULES);
    const chunks = [chunk(0, 0, 24), chunk(0, 25, 48), chunk(0, 49, 72)];

    expect(chunkIndexForBlock(chunks, mapped, SPANS, 0, 0)).toBe(0);
    expect(chunkIndexForBlock(chunks, mapped, SPANS, 1, 0)).toBe(1);
    expect(chunkIndexForBlock(chunks, mapped, SPANS, 2, 0)).toBe(2);
  });

  it('ignores chunks from other chapters', () => {
    const mapped = applyPronunciationMapped(SOURCE, RULES);
    const chunks = [chunk(1, 0, 24), chunk(2, 0, 24)];

    expect(chunkIndexForBlock(chunks, mapped, SPANS, 0, 0)).toBeNull();
  });

  it('returns null for an unknown block', () => {
    const mapped = applyPronunciationMapped(SOURCE, RULES);
    expect(chunkIndexForBlock([chunk(0, 0, 10)], mapped, SPANS, 9, 0)).toBeNull();
  });
});
