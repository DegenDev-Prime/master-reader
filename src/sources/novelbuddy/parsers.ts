import type { Story } from '@/models/story';
import { decodeHtmlEntities, estimateWordCount, htmlToPlainText } from '@/utils/html';

import { NOVELBUDDY_SOURCE_ID as SOURCE_ID, NOVELBUDDY_WEB_URL } from './constants';
import type {
  NovelBuddyChapter,
  NovelBuddyChapterDetail,
  NovelBuddyListItem,
  NovelBuddyTitle,
} from './client';
import type { StoryDetails } from '../types';

const WEB_URL = NOVELBUDDY_WEB_URL;

function coverUrl(value?: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('http')) return value;
  return `${WEB_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

function webUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${WEB_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Summaries arrive as HTML fragments; the reader wants plain text. */
function summaryToText(summary?: string | null): string | null {
  if (!summary) return null;
  const text = htmlToPlainText(summary);
  return text || null;
}

export function parseListItem(item: NovelBuddyListItem): Story {
  return {
    sourceId: SOURCE_ID,
    id: item.id,
    title: item.name,
    authorName: null,
    description: summaryToText(item.summary),
    coverUrl: coverUrl(item.cover),
    rating: item.rating ?? null,
    views: item.stats?.views ?? null,
    votes: item.stats?.ratings_count ?? null,
    url: webUrl(item.url),
    flags: {},
    tags: (item.genres ?? []).map((genre) => genre.name),
    wordCount: null,
    fetchedAt: Math.floor(Date.now() / 1000),
    raw: null,
  };
}

export function parseTitle(title: NovelBuddyTitle): StoryDetails {
  const genres = (title.genres ?? []).map((genre) => genre.name);
  const tags = (title.tags ?? []).map((tag) => tag.name);
  return {
    sourceId: SOURCE_ID,
    id: title.id,
    title: title.name,
    authorName: title.authors?.[0]?.name ?? null,
    description: summaryToText(title.summary),
    coverUrl: coverUrl(title.cover),
    rating: title.rating ?? null,
    votes: title.stats?.ratings_count ?? null,
    views: title.stats?.views ?? null,
    url: webUrl(title.url),
    flags: {},
    tags: [...genres, ...tags],
    wordCount: null,
    seriesId: null,
    seriesTitle: null,
    series: null,
    raw: null,
  };
}

export type NovelBuddyChapterRef = {
  id: string;
  number: number;
  title: string;
  url: string;
};

/**
 * The API returns chapters newest-first. Readers expect ascending order, so
 * the list is sorted by chapter number and every chapter keeps a stable
 * position regardless of gaps in the numbering.
 */
export function parseChapters(chapters: NovelBuddyChapter[]): NovelBuddyChapterRef[] {
  const byId = new Map<string, NovelBuddyChapterRef>();
  for (const chapter of chapters) {
    if (byId.has(chapter.id)) continue;
    byId.set(chapter.id, {
      id: chapter.id,
      number: chapter.number ?? Number.MAX_SAFE_INTEGER,
      title: chapter.name,
      url: chapter.url,
    });
  }
  return [...byId.values()].sort((a, b) => a.number - b.number);
}

/**
 * Machine-translated series carry a preamble before the chapter: the novel
 * title, the translator credit, a summary and a "Main text" marker. Only the
 * body after that marker is the chapter.
 */
export function stripFrontMatter(html: string): string {
  const marker = /<p>\s*(?:main\s+text|正文)\s*<\/p>/i.exec(html);
  if (marker) {
    return html
      .slice(marker.index + marker[0].length)
      .replace(/^\s*<p>\s*<\/p>/, '')
      .trim();
  }

  // Without the marker, drop a leading title/author/summary block.
  const paragraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
  if (paragraphs.length < 3) return html.trim();

  const isPreamble = (text: string): boolean => {
    const value = text.trim().toLowerCase();
    if (value.length === 0) return true;
    if (value.startsWith('author:')) return true;
    if (value === 'summary:' || value === 'summary') return true;
    if (value.startsWith('translator:')) return true;
    if (value.startsWith('novel:')) return true;
    return false;
  };

  let index = 0;
  while (index < paragraphs.length && isPreamble(paragraphs[index][1])) index += 1;
  if (index === 0 || index >= paragraphs.length) return html.trim();
  return html.slice(paragraphs[index].index).trim();
}

export function parseChapterContent(detail: NovelBuddyChapterDetail): {
  content: string;
  wordCount: number;
} {
  const content = stripFrontMatter(detail.content ?? '');
  const text = decodeHtmlEntities(content.replace(/<[^>]+>/g, ' '));
  return { content, wordCount: detail.word_count ?? estimateWordCount(text) };
}
