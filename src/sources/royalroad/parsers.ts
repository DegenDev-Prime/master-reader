import type { Story } from '@/models/story';
import { decodeHtmlEntities, estimateWordCount, htmlToPlainText } from '@/utils/html';
import {
  allMatches,
  cleanText,
  extractElementByClass,
  extractElementById,
  firstMatch,
  getAttribute,
  stripTags,
} from '@/utils/html-parse';

import { ROYALROAD_BASE_URL, ROYALROAD_SOURCE_ID as SOURCE_ID } from './constants';
import { absoluteUrl, toNumberOrNull } from '../provider-utils';
import type { StoryDetails } from '../types';

export type RoyalRoadChapter = { number: number; path: string; title: string };
/** Cloudflare serves an interstitial challenge page to non-browser clients. */
export function isCloudflareChallenge(html: string): boolean {
  return (
    /<title>\s*Just a moment/i.test(html) ||
    /cf-mitigated|challenges\.cloudflare\.com/i.test(html) ||
    /id="challenge-(running|form)"/i.test(html)
  );
}

function metaContent(html: string, key: 'name' | 'property', value: string): string | null {
  const tag = firstMatch(html, new RegExp(`<meta\\b[^>]*\\b${key}="${value}"[^>]*>`, 'i'));
  return tag ? getAttribute(tag, 'content') : null;
}

function splitItems(html: string, marker: string): string[] {
  const attr = new RegExp(`class="(?:[^"]*\\s)?${marker}(?:\\s[^"]*)?"`, 'g');
  const chunks: string[] = [];
  let start = -1;
  for (const match of html.matchAll(attr)) {
    if (start >= 0) chunks.push(html.slice(start, match.index));
    start = match.index ?? -1;
  }
  if (start >= 0) chunks.push(html.slice(start));
  return chunks;
}

export function parseListing(html: string, page: number): { stories: Story[]; hasNext: boolean } {
  const stories: Story[] = [];
  for (const chunk of splitItems(html, 'fiction-list-item')) {
    const story = parseListItem(chunk);
    if (story) stories.push(story);
  }

  const nextPage = new RegExp(`[?&]page=${page + 1}(?:[&"'\\s]|$)`, 'i');
  return { stories, hasNext: nextPage.test(html) };
}

function parseListItem(chunk: string): Story | null {
  const full =
    /<h2[^>]*class="[^"]*fiction-title[^"]*"[^>]*>[\s\S]*?<a\s+href="(\/fiction\/(\d+)\/([^"/]+))"[^>]*>([\s\S]*?)<\/a>/i.exec(
      chunk,
    );
  if (!full) return null;

  const id = full[2];
  const title = stripTags(full[4]);
  if (!id || !title) return null;

  const img = firstMatch(chunk, /<img\b[^>]*>/i);
  const coverSrc = img ? (imgAttribute(img, 'src') ?? imgAttribute(img, 'data-src')) : null;
  const description =
    firstMatch(chunk, /<div[^>]*class="[^"]*fiction-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ??
    firstMatch(chunk, /<div[^>]*\bid="description-\d+"[^>]*>([\s\S]*?)<\/div>/i);

  return {
    sourceId: SOURCE_ID,
    id,
    title,
    // Cards no longer carry an author element; profile links inside a card's
    // description (cover artists, sponsorships) are not the author.
    authorName: parseAuthor(chunk),
    url: `${ROYALROAD_BASE_URL}${full[1]}`,
    coverUrl: absoluteUrl(ROYALROAD_BASE_URL, coverSrc),
    description: description ? htmlToPlainText(description) : null,
    rating: parseRating(chunk),
    flags: {},
    tags: parseTags(chunk),
    raw: null,
  };
}

/**
 * Reads a quoted attribute anchored to whitespace/tags, so `onError` fallback
 * fragments like `this.src='/x'` inside attribute values are not mistaken for
 * the attribute itself (`getAttribute`'s `\b` boundary does match them).
 */
function imgAttribute(tag: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag);
  return match ? decodeHtmlEntities(match[1]) : null;
}

/**
 * Older cards put the author link right under the title; today's cards have no
 * author element at all. Only accept a profile link that appears before the
 * first tags block, so description links (cover artist etc.) are never taken
 * as the author.
 */
function parseAuthor(chunk: string): string | null {
  const tagsMarker = chunk.search(/class="[^"]*\btags\b/i);
  const head = tagsMarker >= 0 ? chunk.slice(0, tagsMarker) : chunk;
  return stripTags(firstMatch(head, /href="\/profile\/[^"]*"[^>]*>([^<]+)<\/a>/i) ?? '') || null;
}

/** Rating: legacy `4.85` text, then the star span `title`, then `aria-label`. */
function parseRating(chunk: string): number | null {
  for (const pattern of [
    /<span[^>]*class="[^"]*\bfont-red-sunglo\b[^"]*"[^>]*>\s*([0-9.]+)/i,
    /class="[^"]*\bfont-red-sunglo\b[^"]*"[^>]*\btitle="([0-9.]+)"/i,
    /aria-label="Rating:\s*([0-9.]+)/i,
  ]) {
    const rating = toNumberOrNull(firstMatch(chunk, pattern));
    if (rating !== null) return rating;
  }
  return null;
}

export function parseFiction(id: string, html: string): StoryDetails {
  const title = stripTags(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? '') || id;
  const author = stripTags(firstMatch(html, /href="\/profile\/[^"]*"[^>]*>([^<]+)<\/a>/i) ?? '');
  const descriptionHtml = firstMatch(
    html,
    /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );

  return {
    sourceId: SOURCE_ID,
    id,
    title,
    authorName: author || null,
    description: descriptionHtml
      ? htmlToPlainText(descriptionHtml)
      : metaContent(html, 'property', 'og:description'),
    url: `${ROYALROAD_BASE_URL}/fiction/${id}`,
    coverUrl: absoluteUrl(ROYALROAD_BASE_URL, metaContent(html, 'property', 'og:image')),
    rating: toNumberOrNull(firstMatch(html, /"ratingValue"\s*:\s*"?([0-9.]+)/i)),
    votes: toNumberOrNull(firstMatch(html, /"ratingCount"\s*:\s*"?([0-9]+)/i)),
    flags: {},
    tags: parseTags(html),
    seriesId: null,
    seriesTitle: null,
    series: null,
    raw: null,
  };
}

function parseTags(html: string): string[] {
  return allMatches(html, /href="\/fictions\/search\?tagsAdd=[^"]*"[^>]*>([^<]+)<\/a>/gi)
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
}

export function parseChapterList(html: string, id: string): RoyalRoadChapter[] {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scope = extractElementById(html, 'chapters', 'table') ?? html;
  const pattern = new RegExp(
    `href="(/fiction/${escaped}/(?:[^"/]+/)?chapter/(\\d+)(?:/[^"]*)?)"[^>]*>([\\s\\S]*?)</a>`,
    'gi',
  );
  const byNumber = new Map<number, RoyalRoadChapter>();
  for (const match of allMatches(scope, pattern)) {
    const number = Number(match[2]);
    if (!Number.isFinite(number) || number <= 0) continue;
    if (byNumber.has(number)) continue;
    const title = stripTags(match[3]);
    if (!title) continue;
    byNumber.set(number, { number, path: match[1], title });
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

export function parseChapterContent(html: string): {
  title: string;
  content: string;
  wordCount: number;
} {
  const title = stripTags(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? '');
  const inner = extractElementByClass(html, 'chapter-content');
  const content = htmlToPlainText(inner ?? '');
  return { title, content, wordCount: estimateWordCount(content) };
}
