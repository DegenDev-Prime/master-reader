import type { Story } from '@/models/story';
import { decodeHtmlEntities, estimateWordCount, htmlToPlainText } from '@/utils/html';

import { NOVELBUDDY_SOURCE_ID as SOURCE_ID } from './constants';
import type {
  NovelBuddyChapter,
  NovelBuddyChapterDetail,
  NovelBuddyListItem,
  NovelBuddyTitle,
} from './client';
import { orderChapters, siteUrl, stripFrontMatter } from './protocol';
import type { StoryDetails } from '../types';

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
    coverUrl: siteUrl(item.cover),
    rating: item.rating ?? null,
    views: item.stats?.views ?? null,
    votes: item.stats?.ratings_count ?? null,
    url: siteUrl(item.url),
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
    coverUrl: siteUrl(title.cover),
    rating: title.rating ?? null,
    votes: title.stats?.ratings_count ?? null,
    views: title.stats?.views ?? null,
    url: siteUrl(title.url),
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
  number: number | null;
  title: string;
  url: string;
};

export function parseChapters(chapters: NovelBuddyChapter[]): NovelBuddyChapterRef[] {
  return orderChapters(
    chapters.map((chapter) => ({
      id: chapter.id,
      number: chapter.number ?? null,
      title: chapter.name,
      url: chapter.url,
    })),
  );
}

export function parseChapterContent(detail: NovelBuddyChapterDetail): {
  content: string;
  wordCount: number;
} {
  const content = stripFrontMatter(detail.content ?? '');
  const text = decodeHtmlEntities(content.replace(/<[^>]+>/g, ' '));
  return { content, wordCount: detail.word_count ?? estimateWordCount(text) };
}
