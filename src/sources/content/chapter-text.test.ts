import { describe, expect, it } from 'vitest';

import { chapterText } from '@/sources/content/chapter-text';
import type { ChapterBlock } from '@/sources/content/parse';

function paragraph(text: string): ChapterBlock {
  return { kind: 'paragraph', spans: [{ text }], text };
}

describe('chapterText', () => {
  it('keeps the blank-line separated text and the contributing blocks', () => {
    const result = chapterText([
      { kind: 'heading', level: 2, spans: [{ text: 'Chapter 4' }], text: 'Chapter 4' },
      paragraph('First body.'),
      { kind: 'image', src: 'https://example.com/a.png', alt: 'art' },
      paragraph('Second body.'),
    ]);

    expect(result.text).toBe('Chapter 4\n\nFirst body.\n\nSecond body.');
    expect(result.blockIndexes).toEqual([0, 1, 3]);
  });

  it('skips blocks that carry no readable text', () => {
    const result = chapterText([
      { kind: 'divider' },
      { kind: 'image', src: 'https://example.com/a.png', alt: '' },
      paragraph('   '),
      paragraph('Only this.'),
    ]);

    expect(result.text).toBe('Only this.');
    expect(result.blockIndexes).toEqual([3]);
  });

  it('reports source offsets of every contributing block', () => {
    const result = chapterText([paragraph('Alpha.'), paragraph('Beta.'), paragraph('Gamma.')]);

    expect(result.spans).toEqual([
      { blockIndex: 0, start: 0, end: 6 },
      { blockIndex: 1, start: 8, end: 13 },
      { blockIndex: 2, start: 15, end: 21 },
    ]);
    for (const span of result.spans) {
      expect(result.text.slice(span.start, span.end)).toBe(
        result.text.slice(span.start, span.end).trim(),
      );
    }
    expect(result.text.slice(0, result.spans[1].start)).toBe('Alpha.\n\n');
  });
});
