import type { Story } from '@/models/story';
import { decodeHtmlEntities, estimateWordCount, htmlToPlainText } from '@/utils/html';
import {
  allMatches,
  cleanText,
  extractElementByClass,
  firstMatch,
  getAttribute,
  stripTags,
} from '@/utils/html-parse';

import {
  authorIdFromHref,
  authorUrl,
  fictionIdFromHref,
  fictionUrl,
  hasNextPage,
  ROYALROAD_BASE_URL,
  ROYALROAD_SOURCE_ID as SOURCE_ID,
} from './protocol';
import { absoluteUrl, toNumberOrNull } from '../provider-utils';
import type { AuthorPage, StoryDetails } from '../types';

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

  return { stories, hasNext: hasNextPage(html, page) };
}

function parseListItem(chunk: string): Story | null {
  const full =
    /<h2[^>]*class="[^"]*fiction-title[^"]*"[^>]*>[\s\S]*?<a\s+href="(\/fiction\/(\d+)\/([^"/]+))"[^>]*>([\s\S]*?)<\/a>/i.exec(
      chunk,
    );
  if (!full) return null;

  const href = full[1];
  const id = fictionIdFromHref(href);
  const title = stripTags(full[4]);
  if (!id || !title) return null;

  const img = firstMatch(chunk, /<img\b[^>]*>/i);
  const coverSrc = img ? (imgAttribute(img, 'src') ?? imgAttribute(img, 'data-src')) : null;
  const description =
    firstMatch(chunk, /<div[^>]*class="[^"]*fiction-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ??
    firstMatch(chunk, /<div[^>]*\bid="description-\d+"[^>]*>([\s\S]*?)<\/div>/i);
  const author = parseAuthor(chunk);

  return {
    sourceId: SOURCE_ID,
    id,
    title,
    // Cards no longer carry an author element; profile links inside a card's
    // description (cover artists, sponsorships) are not the author.
    authorId: author?.id ?? null,
    authorName: author?.name || null,
    url: absoluteUrl(ROYALROAD_BASE_URL, href),
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
function parseAuthor(chunk: string): { id: string | null; name: string } | null {
  const tagsMarker = chunk.search(/class="[^"]*\btags\b/i);
  const head = tagsMarker >= 0 ? chunk.slice(0, tagsMarker) : chunk;
  const match = /<a\b[^>]*\bhref="([^"]*\/profile\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(head);
  if (!match) return null;
  return { id: authorIdFromHref(match[1]), name: stripTags(match[2]) };
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
  const authorLink = /<a\b[^>]*\bhref="([^"]*\/profile\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(
    html,
  );
  const author = authorLink ? stripTags(authorLink[2]) : '';
  const descriptionHtml = firstMatch(
    html,
    /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );

  return {
    sourceId: SOURCE_ID,
    id,
    title,
    authorId: authorLink ? authorIdFromHref(authorLink[1]) : null,
    authorName: author || null,
    description: descriptionHtml
      ? htmlToPlainText(descriptionHtml)
      : metaContent(html, 'property', 'og:description'),
    url: fictionUrl(id),
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

/**
 * Profile pages list an author's fictions either as the same cards as listings
 * or, on older captures, as plain `/fiction/{id}/{slug}` anchors.
 */
export function parseAuthorPage(authorId: string, html: string, page: number): AuthorPage {
  const name = parseAuthorName(html);
  const listing = parseListing(html, page);
  const stories = (listing.stories.length > 0 ? listing.stories : parseFictionAnchors(html)).map(
    (story) => ({
      ...story,
      authorId: story.authorId ?? authorId,
      authorName: story.authorName || name,
    }),
  );

  return {
    author: {
      sourceId: SOURCE_ID,
      id: authorId,
      name: name ?? authorId,
      url: authorUrl(authorId),
      avatarUrl: parseAvatar(html),
      bio: parseBio(html),
      followers: parseStat(html, 'followers'),
      worksCount: parseStat(html, 'fictions') ?? parseStat(html, 'works'),
    },
    stories: { items: stories, page, hasNext: listing.hasNext },
  };
}

function parseAuthorName(html: string): string | null {
  const heading = stripTags(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? '');
  if (heading) return heading;

  const meta = metaContent(html, 'property', 'og:title');
  const title = meta ?? stripTags(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? '');
  return title.replace(/\s*[|·-]\s*Royal Road.*$/i, '').trim() || null;
}

function parseBio(html: string): string | null {
  const listMarker = html.search(/class="[^"]*\bfiction-list-item\b/i);
  const profile = listMarker >= 0 ? html.slice(0, listMarker) : html;
  for (const className of ['profile-bio', 'profile-description', 'description', 'about']) {
    const inner = extractElementByClass(profile, className);
    const text = inner ? htmlToPlainText(inner) : '';
    if (text) return text;
  }
  return (
    metaContent(html, 'property', 'og:description') ?? metaContent(html, 'name', 'description')
  );
}

function parseAvatar(html: string): string | null {
  const meta = metaContent(html, 'property', 'og:image');
  if (meta) return absoluteUrl(ROYALROAD_BASE_URL, meta);

  const tag = firstMatch(html, /<img\b[^>]*\bclass="[^"]*(?:avatar|profile)[^"]*"[^>]*>/i);
  return tag
    ? absoluteUrl(ROYALROAD_BASE_URL, imgAttribute(tag, 'src') ?? imgAttribute(tag, 'data-src'))
    : null;
}

/** Stats are printed as "Followers 1,234" / "Fictions: 7" inside a stats block. */
function parseStat(html: string, label: string): number | null {
  const scope = extractElementByClass(html, 'profile-stats') ?? html;
  return toNumberOrNull(
    firstMatch(stripTags(scope), new RegExp(`${label}\\s*:?\\s*([\\d,]+)`, 'i')),
  );
}

function parseFictionAnchors(html: string): Story[] {
  const seen = new Set<string>();
  const stories: Story[] = [];
  for (const match of allMatches(
    html,
    /<a\b[^>]*\bhref="(\/fiction\/(\d+)\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const id = match[2];
    const title = stripTags(match[3]);
    if (seen.has(id) || !title) continue;
    seen.add(id);
    stories.push({
      sourceId: SOURCE_ID,
      id,
      title,
      authorId: null,
      authorName: null,
      url: absoluteUrl(ROYALROAD_BASE_URL, match[1]),
      coverUrl: null,
      description: null,
      rating: null,
      flags: {},
      tags: [],
      raw: null,
    });
  }
  return stories;
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
