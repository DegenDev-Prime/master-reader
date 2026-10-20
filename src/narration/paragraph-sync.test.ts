import { describe, expect, it } from 'vitest';

import { chunkPages } from '@/narration/chunker';
import {
  chunkIndexForParagraph,
  chunksForPage,
  paragraphIndexesForRange,
  paragraphSpans,
  sourceRangeForChunk,
} from '@/narration/paragraph-sync';
import {
  applyPronunciation,
  applyPronunciationMapped,
  type PronunciationRule,
} from '@/services/pronunciation';

const RAW = [
  'Alpha text opens the page with two sentences of setup.',
  'Bravo paragraph follows and needs enough words that the chunker has to work.',
  'Final paragraph mentions Vondry tonight and then trails off quietly.',
].join('\n\n');

const RULES: PronunciationRule[] = [
  // Deliberately longer than its target: narration offsets past this point
  // drift +2 against the raw text, which is what the mapped pass must undo.
  { id: 'r1', scope: 'global', find: 'Vondry', replace: 'Von-drey' },
];

function chunkWith(partial: string, maxChars = 40) {
  const applied = applyPronunciation(RAW, RULES);
  const chunks = chunkPages([{ index: 0, content: applied }], { maxChars });
  const entry = chunks.find((chunk) => chunk.text.includes(partial));
  expect(entry).toBeDefined();
  return entry;
}

describe('applyPronunciationMapped', () => {
  it('maps every letter back onto its source character without rules', () => {
    const mapped = applyPronunciationMapped(RAW, []);
    expect(mapped.text).toBe(RAW.replace(/\s+/g, ' ').trim());
    for (let index = 0; index < mapped.text.length; index += 1) {
      if (mapped.text[index] === ' ') continue;
      expect(RAW.slice(mapped.starts[index], mapped.ends[index])).toBe(mapped.text[index]);
    }
  });

  it('maps replacement output into its rule target span', () => {
    // raw: A(0) ␣(1) Vondry(2..8) ␣(8) B(9)
    const mapped = applyPronunciationMapped('A Vondry B', RULES);
    expect(mapped.text).toBe('A Von-drey B');
    // Every replacement char points back at the "Vondry" span [2, 8).
    for (let index = 2; index < 10; index += 1) {
      expect(mapped.starts[index]).toBe(2);
      expect(mapped.ends[index]).toBe(8);
    }
    // The tail after the replacement is identity-mapped again.
    expect(mapped.starts[11]).toBe(9);
    expect(mapped.ends[11]).toBe(10);
  });

  it('collapses whitespace runs to their outer source bounds', () => {
    // raw: ␣␣ padded(2..8) ␣␣␣(8..11) text(11..15) ␣␣(15..17)
    const mapped = applyPronunciationMapped('  padded   text  ', []);
    expect(mapped.text).toBe('padded text');
    expect(mapped.starts[0]).toBe(2);
    expect(mapped.ends[0]).toBe(3);
    // The single collapsed space spans the three-space run.
    expect(mapped.starts[6]).toBe(8);
    expect(mapped.ends[6]).toBe(11);
  });

  it('matches the text chunkPages would see, pronunciation included', () => {
    const applied = applyPronunciation(RAW, RULES);
    const mapped = applyPronunciationMapped(RAW, RULES);
    expect(mapped.text).toBe(applied.replace(/\s+/g, ' ').trim());
  });
});

describe('paragraph sync', () => {
  const mapped = applyPronunciationMapped(RAW, RULES);
  const spans = paragraphSpans(RAW);

  it('splits paragraphs exactly on the blank-line breaks', () => {
    expect(spans).toHaveLength(3);
    spans.forEach((span, index) => {
      expect(RAW.slice(span.start, span.end)).not.toMatch(/\n{2}/);
      if (index > 0) expect(span.start).toBeGreaterThan(spans[index - 1].start);
    });
    expect(spans[0].start).toBe(0);
    expect(spans[2].end).toBe(RAW.length);
  });

  it('translates chunk offsets so replacement drift collapses', () => {
    const chunk = chunkWith('tonight');
    if (!chunk) throw new Error('chunk fixture missing');
    const range = sourceRangeForChunk(mapped, chunk);
    const hits = paragraphIndexesForRange(spans, range);
    // "tonight" is raw-offset shifted by the +2 replacement; a naive mapping
    // would keep it in the wrong paragraph.
    expect(hits).toEqual([2]);
  });

  it('keeps the current-chunk highlight on its spoken paragraph', () => {
    const chunks = chunkPages([{ index: 0, content: applyPronunciation(RAW, RULES) }], {
      maxChars: 40,
    });
    const entries = chunksForPage(chunks, 0);
    expect(entries.length).toBeGreaterThan(1);
    for (const entry of entries) {
      const range = sourceRangeForChunk(mapped, entry.chunk);
      const hits = paragraphIndexesForRange(spans, range);
      expect(hits.length).toBeGreaterThan(0);
    }
  });

  it('resolves tap-to-move to the first chunk of the tapped paragraph', () => {
    const chunks = chunkPages([{ index: 0, content: applyPronunciation(RAW, RULES) }], {
      maxChars: 40,
    });
    const entries = chunksForPage(chunks, 0);
    expect(chunkIndexForParagraph(entries, mapped, spans[0])).toBe(0);
    // The last paragraph resolves to a chunk whose range touches it.
    const lastTap = chunkIndexForParagraph(entries, mapped, spans[2]);
    expect(lastTap).not.toBeNull();
    const range = sourceRangeForChunk(mapped, chunks[lastTap as number]);
    expect(paragraphIndexesForRange(spans, range)).toContain(2);
  });

  it('returns null when no chunks exist for the page', () => {
    expect(chunkIndexForParagraph([], mapped, spans[0])).toBeNull();
  });

  it('falls back to the nearest chunk for trailing paragraphs', () => {
    const chunks = chunkPages([{ index: 0, content: applyPronunciation(RAW, RULES) }], {
      maxChars: 200,
    });
    const entries = chunksForPage(chunks, 0);
    const tapAt = chunkIndexForParagraph(entries, mapped, spans[0]);
    expect(tapAt).toBe(0);
  });
});
