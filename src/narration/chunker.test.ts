import { describe, expect, it } from 'vitest';

import { chunkPages, packSentences } from './chunker';

describe('chunkPages', () => {
  it('returns no chunks for empty pages', () => {
    expect(chunkPages([])).toEqual([]);
    expect(chunkPages([{ index: 0, content: '   ' }])).toEqual([]);
  });

  it('splits sentences and assigns stable ids', () => {
    const chunks = chunkPages([{ index: 2, content: 'Hello world. How are you? Fine!' }]);
    expect(chunks.map((chunk) => chunk.id)).toEqual(['2:0']);
    expect(chunks[0].text).toBe('Hello world. How are you? Fine!');
    expect(chunks[0].pageIndex).toBe(2);
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].end).toBe(chunks[0].text.length);
  });

  it('packs across the cap into sequential chunks', () => {
    const sentence = 'The quick brown fox jumps over the lazy dog. ';
    const chunks = chunkPages([{ index: 0, content: sentence.repeat(20) }], { maxChars: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 100)).toBe(true);
    expect(chunks.map((chunk) => chunk.id)).toEqual(chunks.map((_, i) => `0:${i}`));
    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i].start).toBeGreaterThan(chunks[i - 1].start);
    }
  });

  it('keeps page boundaries and skips blank pages', () => {
    const chunks = chunkPages([
      { index: 0, content: 'First page here.' },
      { index: 1, content: '' },
      { index: 2, content: 'Second page here.' },
    ]);
    expect(chunks.map((chunk) => chunk.pageIndex)).toEqual([0, 2]);
  });

  it('handles CJK sentence punctuation', () => {
    const chunks = chunkPages([{ index: 0, content: '你好。再见！谢谢。' }], { maxChars: 6 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('packSentences', () => {
  it('hard-splits an oversized sentence on word boundaries', () => {
    const long = `word ${'x'.repeat(200)} end`;
    const groups = packSentences([long], 80);
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.flat().join(' ')).toContain('word');
  });
});
