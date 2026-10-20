import { describe, expect, it } from 'vitest';

import { chunkPages } from '@/narration/chunker';
import { blockIndexForRange, chunkIndexForBlock } from '@/narration/chapter-highlight';
import { applyPronunciationMapped, sourceRangeForNarrationRange } from '@/services/pronunciation';
import { chapterText } from '@/sources/content/chapter-text';
import type { ChapterBlock } from '@/sources/content/parse';

const RULES = [{ id: '1', scope: 'global', find: 'Siobhan', replace: 'Shi-VAWN' }];

function blocks(): ChapterBlock[] {
  return [
    { kind: 'paragraph', spans: [{ text: 'Siobhan met Siobhan.' }], text: 'Siobhan met Siobhan.' },
    {
      kind: 'paragraph',
      spans: [{ text: 'The crowd cheered loudly.' }],
      text: 'The crowd cheered loudly.',
    },
    { kind: 'paragraph', spans: [{ text: 'Siobhan smiled.' }], text: 'Siobhan smiled.' },
  ];
}

describe('chapter narration mapping', () => {
  it('maps spoken chunks onto the displayed blocks', () => {
    const text = chapterText(blocks());
    const mapped = applyPronunciationMapped(text.text, RULES);
    const chunks = chunkPages([{ index: 0, content: mapped.text }]);

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      const range = sourceRangeForNarrationRange(mapped, chunk.start, chunk.end);
      expect(blockIndexForRange(text.spans, range)).not.toBeNull();
    }
  });

  it('seeks to the chunk that speaks a tapped block', () => {
    const text = chapterText(blocks());
    const mapped = applyPronunciationMapped(text.text, RULES);
    const chunks = chunkPages([{ index: 0, content: mapped.text }]);

    for (const span of text.spans) {
      const index = chunkIndexForBlock(chunks, mapped, text.spans, span.blockIndex, 0);
      expect(index).not.toBeNull();
      const range = sourceRangeForNarrationRange(mapped, chunks[index!].start, chunks[index!].end);
      expect(range.start).toBeLessThan(span.end);
      expect(range.end).toBeGreaterThan(span.start);
    }
  });
});
