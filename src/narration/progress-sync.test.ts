import { describe, expect, it } from 'vitest';

import type { SpeechChunk } from './chunker';
import { chunkIndexForPage, pageCountForChunks, pageIndexForChunk } from './progress-sync';

function chunk(pageIndex: number, id: string): SpeechChunk {
  return { id, pageIndex, start: 0, end: 10, text: 'text' };
}

const chunks = [chunk(0, '0:0'), chunk(0, '0:1'), chunk(1, '1:0'), chunk(2, '2:0')];

describe('pageIndexForChunk', () => {
  it('maps chunks to their reader page', () => {
    expect(pageIndexForChunk(chunks, 0)).toBe(0);
    expect(pageIndexForChunk(chunks, 1)).toBe(0);
    expect(pageIndexForChunk(chunks, 2)).toBe(1);
  });

  it('clamps out-of-range indexes', () => {
    expect(pageIndexForChunk(chunks, -5)).toBe(0);
    expect(pageIndexForChunk(chunks, 99)).toBe(2);
    expect(pageIndexForChunk([], 0)).toBe(0);
  });
});

describe('pageCountForChunks', () => {
  it('derives the page count from chunk page indexes', () => {
    expect(pageCountForChunks(chunks)).toBe(3);
    expect(pageCountForChunks([])).toBe(0);
  });
});

describe('chunkIndexForPage', () => {
  it('returns the first chunk of the requested page', () => {
    expect(chunkIndexForPage(chunks, 0)).toBe(0);
    expect(chunkIndexForPage(chunks, 1)).toBe(2);
    expect(chunkIndexForPage(chunks, 2)).toBe(3);
  });

  it('clamps past the end to the last chunk', () => {
    expect(chunkIndexForPage(chunks, 99)).toBe(3);
    expect(chunkIndexForPage([], 0)).toBe(0);
  });
});
