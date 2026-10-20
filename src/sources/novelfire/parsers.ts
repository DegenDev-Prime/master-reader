import type { Story } from '@/models/story';
import { estimateWordCount, htmlToPlainText } from '@/utils/html';
import {
  allMatches,
  cleanText,
  extractElementById,
  firstMatch,
  getAttribute,
  stripTags,
} from '@/utils/html-parse';

import { NOVELFIRE_BASE_URL, NOVELFIRE_SOURCE_ID as SOURCE_ID } from './constants';
import { absoluteUrl, toNumberOrNull } from '../provider-utils';
import type { Category, StoryDetails } from '../types';

export type NovelFireChapter = {
  /** 1-based chapter number as published by the site. */
  number: number;
  title: string;
};

export type NovelFireListing = {
  stories: Story[];
  hasNext: boolean;
};

function metaContent(
  html: string,
  key: 'name' | 'property' | 'itemprop',
  value: string,
): string | null {
  const tag = firstMatch(html, new RegExp(`<meta\\b[^>]*\\b${key}="${value}"[^>]*>`, 'i'));
  return tag ? getAttribute(tag, 'content') : null;
}

export function slugFromHref(href: string): string {
  return href.replace(/^\/book\//, '').split(/[/?#]/)[0] ?? '';
}

export function hasNextPage(html: string, page: number): boolean {
  return new RegExp(`[?&]page=${page + 1}(?:[&"'\\s]|$)`, 'i').test(html);
}

/** Highest page number linked in the pagination controls (1 when unpaginated). */
export function parseLastPage(html: string): number {
  let last = 1;
  for (const match of allMatches(html, /[?&]page=(\d+)/g)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) last = Math.max(last, value);
  }
  return last;
}

export function parseListing(html: string, page: number): NovelFireListing {
  const items = allMatches(html, /<li[^>]*class="[^"]*novel-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi);
  const stories: Story[] = [];
  for (const item of items) {
    const story = parseListItem(item[1]);
    if (story) stories.push(story);
  }

  return { stories, hasNext: hasNextPage(html, page) };
}

function parseListItem(body: string): Story | null {
  const anchor = firstMatch(body, /<a\b[^>]*>/i);
  const href = anchor ? getAttribute(anchor, 'href') : null;
  if (!href) return null;

  const id = slugFromHref(href);
  const title = stripTags(
    firstMatch(body, /<h4[^>]*class="[^"]*novel-title[^"]*"[^>]*>([\s\S]*?)<\/h4>/i) ?? '',
  );
  if (!id || !title) return null;

  const img = firstMatch(body, /<img\b[^>]*>/i);
  const cover = img ? (getAttribute(img, 'data-src') ?? getAttribute(img, 'src')) : null;

  return {
    sourceId: SOURCE_ID,
    id,
    title,
    authorName: null,
    url: `${NOVELFIRE_BASE_URL}/book/${id}`,
    coverUrl: absoluteUrl(NOVELFIRE_BASE_URL, cover),
    rating: toNumberOrNull(firstMatch(body, /icon-star"><\/i>\s*([0-9.]+)/i)),
    votes: null,
    views: null,
    wordCount: null,
    flags: {},
    raw: null,
  };
}

export function parseBook(slug: string, html: string): StoryDetails {
  const title = stripTags(
    firstMatch(html, /<h1[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/h1>/i) ?? slug,
  );
  const author = stripTags(
    firstMatch(html, /<span[^>]*itemprop="author"[^>]*>([\s\S]*?)<\/span>/i) ?? '',
  );
  const description =
    metaContent(html, 'itemprop', 'description') ?? metaContent(html, 'name', 'description');
  const cover = metaContent(html, 'property', 'og:image');
  const genres = parseGenres(html);

  return {
    sourceId: SOURCE_ID,
    id: slug,
    title: title || slug,
    authorName: author || null,
    description: description ? cleanText(description) : null,
    categoryId: genres[0]?.id ?? null,
    categoryName: genres[0]?.name ?? null,
    url: `${NOVELFIRE_BASE_URL}/book/${slug}`,
    coverUrl: absoluteUrl(NOVELFIRE_BASE_URL, cover),
    rating: toNumberOrNull(firstMatch(html, /"ratingValue"\s*:\s*"?([0-9.]+)/i)),
    votes: toNumberOrNull(firstMatch(html, /"ratingCount"\s*:\s*"?([0-9]+)/i)),
    views: null,
    wordCount: null,
    flags: {},
    tags: genres.map((genre) => genre.name),
    seriesId: null,
    seriesTitle: null,
    series: null,
    raw: null,
  };
}

function parseGenres(html: string): Category[] {
  const block = firstMatch(html, /<div class="categories">([\s\S]*?)<\/div>/i);
  if (!block) return [];
  const categories: Category[] = [];
  for (const match of allMatches(
    block,
    /href="\/genre-([a-z0-9-]+)\/[^"]*"[^>]*title="([^"]*)"/gi,
  )) {
    categories.push({ id: match[1], name: cleanText(match[2]) });
  }
  return categories;
}

export function parseChapterList(html: string, slug: string): NovelFireChapter[] {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`href="/book/${escaped}/chapter-(\\d+)"[^>]*title="([^"]*)"`, 'gi');
  const chapters = allMatches(html, pattern).map((match) => ({
    number: Number(match[1]),
    title: cleanText(match[2]),
  }));
  return chapters
    .filter((chapter) => Number.isFinite(chapter.number) && chapter.number > 0)
    .sort((a, b) => a.number - b.number);
}

export function parseChapterContent(html: string): {
  title: string;
  content: string;
  wordCount: number;
} {
  const title = stripTags(
    firstMatch(html, /<span[^>]*class="[^"]*chapter-title[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ?? '',
  );
  const inner = extractElementById(html, 'content', 'div') ?? '';
  const content = htmlToPlainText(inner);
  return { title, content, wordCount: estimateWordCount(content) };
}
