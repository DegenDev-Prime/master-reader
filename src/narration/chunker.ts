import type { StoryPage } from '@/models/story';

export type SpeechChunk = {
  id: string;
  pageIndex: number;
  /** Character offset of the chunk within its page's normalized text. */
  start: number;
  end: number;
  text: string;
};

export type ChunkOptions = {
  /** Soft cap per chunk; sentences are never split except as a last resort. */
  maxChars?: number;
};

const DEFAULT_MAX_CHARS = 600;

// Sentence-ending punctuation (Latin + CJK) followed by whitespace or end.
const SENTENCE_BOUNDARY = /([.!?…。！？]+["'”’)\]]*)\s+/g;

/**
 * Splits reader pages into speakable chunks. Pure and deterministic so the
 * same text always maps to the same chunk ids, which keeps narration progress
 * and bookmarks stable across sessions.
 */
export function chunkPages(
  pages: Pick<StoryPage, 'index' | 'content'>[],
  options: ChunkOptions = {},
): SpeechChunk[] {
  const maxChars = Math.max(1, Math.floor(options.maxChars ?? DEFAULT_MAX_CHARS));
  const chunks: SpeechChunk[] = [];

  for (const page of pages) {
    const sentences = splitSentences(normalize(page.content ?? ''));
    let ordinal = 0;
    let offset = 0;
    for (const group of packSentences(sentences, maxChars)) {
      const text = group.join(' ');
      chunks.push({
        id: `${page.index}:${ordinal}`,
        pageIndex: page.index,
        start: offset,
        end: offset + text.length,
        text,
      });
      ordinal += 1;
      offset += text.length + 1;
    }
  }

  return chunks;
}

/** Greedily packs sentences into groups capped at maxChars. */
export function packSentences(sentences: string[], maxChars: number): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  let length = 0;

  const flush = () => {
    if (current.length > 0) groups.push(current);
    current = [];
    length = 0;
  };

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      flush();
      for (const part of hardSplit(sentence, maxChars)) groups.push([part]);
      continue;
    }
    const next = length + (current.length > 0 ? 1 : 0) + sentence.length;
    if (next > maxChars) flush();
    current.push(sentence);
    length += (current.length > 1 ? 1 : 0) + sentence.length;
  }
  flush();
  return groups;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  if (!text) return [];
  const sentences: string[] = [];
  let start = 0;
  SENTENCE_BOUNDARY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_BOUNDARY.exec(text)) !== null) {
    const end = match.index + match[0].length;
    sentences.push(text.slice(start, end).trim());
    start = end;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences.filter(Boolean);
}

function hardSplit(sentence: string, maxChars: number): string[] {
  const words = sentence.split(' ').filter(Boolean);
  const parts: string[] = [];
  let current = '';
  const pushWord = (word: string) => {
    if (word.length <= maxChars) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChars && current) {
        parts.push(current);
        current = word;
      } else {
        current = candidate;
      }
      return;
    }
    if (current) {
      parts.push(current);
      current = '';
    }
    for (let i = 0; i < word.length; i += maxChars) parts.push(word.slice(i, i + maxChars));
  };
  for (const word of words) pushWord(word);
  if (current) parts.push(current);
  return parts.length > 0 ? parts : [sentence];
}
