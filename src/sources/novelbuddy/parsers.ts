import type { Author } from '@/models/author';
import type { Story } from '@/models/story';
import { decodeHtmlEntities, estimateWordCount, htmlToPlainText } from '@/utils/html';

import { NOVELBUDDY_SOURCE_ID as SOURCE_ID } from './constants';
import type {
  NovelBuddyChapter,
  NovelBuddyChapterDetail,
  NovelBuddyListItem,
  NovelBuddyPagination,
  NovelBuddyTitle,
} from './client';
import { authorUrl, orderChapters, siteUrl, stripFrontMatter } from './protocol';
import type { AuthorPage, StoryDetails } from '../types';

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
    authorId: item.authors?.[0]?.slug ?? null,
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
    authorId: title.authors?.[0]?.slug ?? null,
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

type NovelBuddyAuthorData = {
  props?: {
    pageProps?: {
      slug?: string | null;
      items?: NovelBuddyListItem[] | null;
      pagination?: NovelBuddyPagination | null;
    } | null;
  } | null;
};

function readNextData(html: string): NovelBuddyAuthorData | null {
  const match = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as NovelBuddyAuthorData;
  } catch {
    return null;
  }
}

function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function authorName(html: string, slug: string): string {
  const meta = (html.match(/<meta\b[^>]*>/gi) ?? []).find((tag) =>
    /property=["']og:title["']/i.test(tag),
  );
  const content = meta ? /content=["']([^"']*)["']/i.exec(meta)?.[1] : undefined;
  const title = content ? decodeHtmlEntities(content) : '';
  const name = title.replace(/\s*-\s*Novels by Author\s*-\s*NovelBuddy\s*$/i, '').trim();
  return name || humanizeSlug(slug);
}

export function parseAuthorPage(html: string, fallbackSlug?: string): AuthorPage | null {
  const pageProps = readNextData(html)?.props?.pageProps;
  const slug = pageProps?.slug?.trim() || fallbackSlug?.trim();
  if (!pageProps || !slug) return null;

  const name = authorName(html, slug);
  const author: Author = {
    sourceId: SOURCE_ID,
    id: slug,
    name,
    url: authorUrl(slug),
    avatarUrl: null,
    bio: null,
    worksCount: pageProps?.pagination?.total ?? null,
    fetchedAt: Math.floor(Date.now() / 1000),
    raw: null,
  };
  const stories = (pageProps?.items ?? []).map((item) => ({
    ...parseListItem(item),
    authorId: slug,
    authorName: name,
  }));
  const pagination = pageProps?.pagination;

  return {
    author,
    stories: {
      items: stories,
      page: pagination?.page ?? 1,
      hasNext: pagination?.has_next ?? false,
      total: pagination?.total ?? stories.length,
    },
  };
}
