import type { Author } from '@/models/author';
import type { Story } from '@/models/story';
import { decodeHtmlEntities, estimateWordCount } from '@/utils/html';
import {
  cleanText,
  extractElementByClass,
  extractElementById,
  getAttribute,
  stripTags,
} from '@/utils/html-parse';

import { SCRIBBLEHUB_BASE_URL, SCRIBBLEHUB_SOURCE_ID as SOURCE_ID } from './constants';
import {
  authorIdFromHref,
  authorIdFromInput,
  chapterIdFromHref,
  parseChapterPublishedAt,
  seriesIdFromInput,
  seriesUrl,
} from './protocol';
import type { StoryDetails } from '../types';

export type ScribbleHubChapter = {
  /** Provider chapter id, taken from the read URL. */
  id: string;
  /** Zero-based order within the novel. */
  index: number;
  title: string;
  /** unix seconds */
  publishedAt: number | null;
};

export type ScribbleHubListingItem = {
  id: string;
  title: string;
  url: string;
  coverUrl: string | null;
  authorId: string | null;
  authorName: string | null;
  rating: number | null;
  views: number | null;
  favorites: number | null;
  chapters: number | null;
  words: number | null;
  updatedLabel: string | null;
  genres: string[];
  description: string | null;
};

function absolute(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SCRIBBLEHUB_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** "9.68M" -> 9680000; "1,015" -> 1015. */
export function parseCount(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /([\d.]+)\s*([km])?/i.exec(value.replace(/,/g, '').trim());
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'k') return Math.round(base * 1_000);
  if (suffix === 'm') return Math.round(base * 1_000_000);
  return Math.round(base);
}

function parseStat(stats: string, label: string): number | null {
  const pattern = new RegExp(`${label}:\\s*([\\d.,]+\\s*[km]?)`, 'i');
  const match = pattern.exec(stats);
  return parseCount(match ? match[1] : null);
}

/** Splits one listing card into its fields. */
export function parseListingItem(chunk: string): ScribbleHubListingItem | null {
  const link =
    /<a\s+href="(https?:\/\/www\.scribblehub\.com\/series\/(\d+)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(
      chunk,
    );
  if (!link) return null;

  const id = link[2];
  const title = stripTags(link[3]);
  if (!id || !title) return null;

  const stats = /<div class="search_stats[^"]*">([\s\S]*?)<\/div>/i.exec(chunk);
  const statsText = stats ? stats[1] : '';

  const image = /<img[^>]+src="([^"]+)"/i.exec(chunk);
  const author = /Author:\s*<span class="a_un_st"><a([^>]*)>([\s\S]*?)<\/a>/i.exec(statsText);
  const rating = /\(([\d.]+)\)<\/span>/i.exec(chunk);
  const updated = /Updated:\s*([^,<]+)/i.exec(statsText);

  const genreBlock = /<div class="search_genre[^"]*">([\s\S]*?)<\/div>/i.exec(chunk);
  const genres = genreBlock
    ? [...genreBlock[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi)]
        .map((match) => cleanText(match[1]))
        .filter(Boolean)
    : [];

  const descriptionBlock = /<div style="padding-top:5px;[^"]*">([\s\S]*?)<span class="dots">/i.exec(
    chunk,
  );

  return {
    id,
    title,
    url: link[1],
    coverUrl: image ? absolute(image[1]) : null,
    authorId: author ? authorIdFromHref(getAttribute(author[1], 'href')) : null,
    authorName: author ? stripTags(author[2]) || null : null,
    rating: rating ? Number(rating[1]) : null,
    views: parseStat(statsText, 'Views'),
    favorites: parseStat(statsText, 'Favorites'),
    chapters: parseStat(statsText, 'Chapters'),
    words: parseStat(statsText, 'Words'),
    updatedLabel: updated ? cleanText(updated[1]) : null,
    genres,
    description: descriptionBlock ? cleanText(descriptionBlock[1]) : null,
  };
}

export function listingToStory(item: ScribbleHubListingItem): Story {
  return {
    sourceId: SOURCE_ID,
    id: seriesIdFromInput(item.id),
    title: item.title,
    authorId: item.authorId,
    authorName: item.authorName,
    description: item.description,
    coverUrl: item.coverUrl,
    rating: item.rating,
    views: item.views,
    url: item.url,
    flags: {},
    tags: item.genres,
    wordCount: item.words,
    fetchedAt: Math.floor(Date.now() / 1000),
    raw: null,
  };
}

/** Parses every listing card on a page. */
export function parseListing(html: string): ScribbleHubListingItem[] {
  const items: ScribbleHubListingItem[] = [];
  const pattern =
    /<div class="search_main_box mb">([\s\S]*?)(?=<div class="search_main_box mb">|$)/g;
  for (const match of html.matchAll(pattern)) {
    const item = parseListingItem(match[1]);
    if (item) items.push(item);
  }
  return items;
}

/** The series page holds the synopsis, stats and the chapter table. */
export function parseSeries(id: string, html: string): StoryDetails {
  const seriesId = seriesIdFromInput(id);

  const title =
    stripTags(/<div class="fic_title mb"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? '') ||
    cleanText(/<meta property="og:title" content="([^"]*)"/i.exec(html)?.[1] ?? '') ||
    seriesId;

  const author = /<a\b([^>]*)>\s*<span class="auth_name_fic">([\s\S]*?)<\/span>/i.exec(html);
  const authorName = author ? stripTags(author[2]) || null : null;
  const authorId = author ? authorIdFromHref(getAttribute(author[1], 'href')) : null;

  const description = cleanText(
    /<div class="wi_fic_desc"[^>]*>([\s\S]*?)<\/div>\s*<div/i.exec(html)?.[1] ?? '',
  );

  const statsBlock = /<div class="fic_stats mb">([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? '';
  // The series page prints "<value> <label>", e.g. "9.68M Views".
  const statValue = (label: string): number | null => {
    const match = new RegExp(`([\\d.,]+\\s*[km]?)\\s*${label}`, 'i').exec(statsBlock);
    return parseCount(match ? match[1] : null);
  };

  const rating = Number(
    /<div class="fic_rate_mb"[\s\S]*?<span dp="yes">([\d.]+)<\/span>/i.exec(html)?.[1] ??
      Number.NaN,
  );
  const cover = /<div class="fic_image mb">\s*<img[^>]+src="([^"]+)"/i.exec(html)?.[1] ?? null;

  const tagBlock = /<span[^>]*class="stag"[^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1] ?? '';
  const genres = [...tagBlock.matchAll(/>([^<>]+)<\/a>/gi)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);

  return {
    sourceId: SOURCE_ID,
    id: seriesId,
    title,
    authorId,
    authorName,
    description: description || null,
    coverUrl: cover ? absolute(cover) : null,
    rating: Number.isFinite(rating) ? rating : null,
    views: statValue('Views'),
    votes: statValue('Favorites'),
    url: seriesUrl(seriesId),
    flags: {},
    tags: genres,
    wordCount: null,
    seriesId: null,
    seriesTitle: null,
    series: null,
    raw: null,
  };
}

function metaContent(html: string, keys: readonly string[]): string | null {
  for (const key of keys) {
    const tag = new RegExp(`<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${key}["'][^>]*>`, 'i').exec(
      html,
    )?.[0];
    const content = tag ? getAttribute(tag, 'content') : null;
    if (content) return content;
  }
  return null;
}

function authorNameFromHtml(html: string, fallback: string): string {
  const headingBlock =
    extractElementByClass(html, 'breadcrumb') ?? extractElementByClass(html, 'profile_name') ?? '';
  const headingText = stripTags(headingBlock);
  const breadcrumb = /\/\s*Profile\s*\/\s*([^/]+)/i.exec(headingText)?.[1]?.trim();
  const headingName = /\/\s*Profile/i.test(headingText) ? '' : headingText;
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const metaTitle = metaContent(html, ['og:title', 'twitter:title']) ?? '';
  const description = metaContent(html, ['og:description', 'twitter:description']) ?? '';

  const candidates = [
    breadcrumb ?? '',
    headingName,
    h1 ? stripTags(h1) : '',
    title ? stripTags(title).replace(/\s*['’]s Profile\s*\|[\s\S]*$/i, '') : '',
    metaTitle ? stripTags(metaTitle).replace(/\s*['’]s Profile\s*\|[\s\S]*$/i, '') : '',
    description.split(/\s*['’]s\s/)[0] ?? '',
  ];
  return candidates.find((value) => value && !/^scribble hub$/i.test(value)) || fallback;
}

function authorBio(html: string): string | null {
  const block =
    extractElementByClass(html, 'user_bio_profile') ??
    /<div[^>]*class="[^"]*\bprofile_bio\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ??
    null;
  if (block) {
    const paragraphs = [...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => stripTags(match[1]))
      .filter(Boolean);
    const text = paragraphs.length ? paragraphs.join('\n\n') : stripTags(block);
    if (text) return text;
  }
  return (
    metaContent(html, ['description'])
      ?.replace(/\s*['’]s Profile\s*$/i, '')
      .replace(/\s*\|[\s\S]*$/, '') ?? null
  );
}

function authorTableRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => stripTags(cell[1]).replace(/:$/, '').trim())
      .filter(Boolean);
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

function authorStat(html: string, rows: string[][], label: string): number | null {
  const row = rows.find((cells) => cells[0]?.toLowerCase() === label.toLowerCase());
  if (row) return parseCount(row[1]);
  const match = new RegExp(`${label}\\s*:?\\s*(?:<[^>]+>\\s*)*([\\d.,]+\\s*[km]?)`, 'i').exec(html);
  return parseCount(match?.[1] ?? null);
}

function authorAvatar(html: string): string | null {
  const meta = metaContent(html, ['og:image', 'twitter:image']);
  if (meta) return absolute(meta);
  const tag = /<img\b[^>]*class=["'][^"']*\bavatar\b[^"']*["'][^>]*>/i.exec(html)?.[0];
  const src = tag ? getAttribute(tag, 'src') : null;
  return src ? absolute(src) : null;
}

export type ScribbleHubAuthorSeries = {
  id: string;
  title: string;
  url: string;
};

function seriesLinksInChunk(chunk: string): ScribbleHubAuthorSeries[] {
  const titled = [
    extractElementByClass(chunk, 'search_title'),
    extractElementByClass(chunk, 'search_img'),
  ].filter((value): value is string => typeof value === 'string');
  const sources = titled.length > 0 ? titled : [chunk];

  const items: ScribbleHubAuthorSeries[] = [];
  for (const source of sources) {
    for (const match of source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = getAttribute(match[1], 'href');
      const id = /\/series\/(\d+)(?:[/?#]|$)/i.exec(href ?? '')?.[1];
      if (!id) continue;
      const image = /<img\b[^>]*>/i.exec(match[2])?.[0];
      const title =
        stripTags(match[2]) ||
        getAttribute(match[1], 'title') ||
        (image ? getAttribute(image, 'alt') : null);
      if (!title) continue;
      items.push({ id, title, url: absolute(href) ?? seriesUrl(id) });
    }
  }
  return items;
}

/** The profile series tab renders the same cards as search listings. */
export function parseAuthorSeries(html: string): ScribbleHubAuthorSeries[] {
  const container =
    extractElementByClass(html, 'p_series_tab') ??
    extractElementByClass(html, 'p_load_series') ??
    html;
  const cards = [
    ...container.matchAll(
      /<div class="search_main_box[^"]*">([\s\S]*?)(?=<div class="search_main_box|$)/gi,
    ),
  ].map((match) => match[1]);

  const items: ScribbleHubAuthorSeries[] = [];
  const seen = new Set<string>();
  const hasComments =
    /class=["'][^"']*(?:p_profile_post|profile_comments|p_messages_recent|profile_reply)[^"']*["']/i.test(
      html,
    );
  const chunks = cards.length > 0 ? cards : container === html && !hasComments ? [html] : [];
  for (const chunk of chunks) {
    for (const item of seriesLinksInChunk(chunk)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

export function parseAuthor(authorId: string, html: string): Author {
  const id = authorIdFromInput(authorId);
  const rows = authorTableRows(html);
  return {
    sourceId: SOURCE_ID,
    id,
    name: authorNameFromHtml(html, id),
    url: `${SCRIBBLEHUB_BASE_URL}/profile/${encodeURIComponent(id)}/`,
    avatarUrl: authorAvatar(html),
    bio: authorBio(html),
    followers: authorStat(html, rows, 'Followers'),
    worksCount: authorStat(html, rows, 'Series'),
    wordCount: authorStat(html, rows, 'Total Words'),
    fetchedAt: Math.floor(Date.now() / 1000),
    raw: null,
  };
}

export function authorSeriesToStory(item: ScribbleHubAuthorSeries, author: Author): Story {
  return {
    sourceId: SOURCE_ID,
    id: item.id,
    title: item.title,
    authorId: author.id,
    authorName: author.name,
    url: item.url,
    flags: {},
    fetchedAt: Math.floor(Date.now() / 1000),
  };
}

function chapterDateAfter(html: string, offset: number): number | null {
  const chunk = html.slice(offset, offset + 400);
  const span = /<span[^>]*class="[^"]*\bfic_date_pub\b[^"]*"[^>]*>/i.exec(chunk)?.[0];
  if (!span) return null;
  const title = /title="([^"]*)"/i.exec(span)?.[1];
  if (title) return parseChapterPublishedAt(title);
  const text = /<span[^>]*class="[^"]*\bfic_date_pub\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(
    chunk,
  )?.[1];
  return parseChapterPublishedAt(text);
}

/**
 * Parses the chapter table. The provider serves it newest-first, so the list
 * is reversed into reading order and numbered by position. Duplicate anchors
 * (the page repeats its table) are collapsed by chapter id.
 */
export function parseChapterList(html: string): ScribbleHubChapter[] {
  const entries: Omit<ScribbleHubChapter, 'index'>[] = [];
  const seen = new Set<string>();
  const pattern = /(<a\b[^>]*\bclass=["'][^"']*\btoc_a\b[^"']*["'][^>]*>)([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = getAttribute(match[1], 'href');
    const id = href ? chapterIdFromHref(href) : null;
    const title = stripTags(match[2]);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    entries.push({
      id,
      title,
      publishedAt: chapterDateAfter(html, match.index + match[0].length),
    });
  }

  return entries.reverse().map((entry, index) => ({ ...entry, index }));
}

/** Chapter body text, taken from the reading view. */
export function parseChapterContent(html: string): { content: string; wordCount: number } {
  const body =
    extractElementById(html, 'chp_raw') ??
    /<div[^>]*class="chp_raw"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ??
    '';
  const content = body.trim();
  const text = decodeHtmlEntities(content.replace(/<[^>]+>/g, ' '));
  return { content, wordCount: estimateWordCount(text) };
}
