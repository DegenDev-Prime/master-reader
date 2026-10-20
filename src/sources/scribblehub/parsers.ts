import type { Story } from '@/models/story';
import { decodeHtmlEntities, estimateWordCount } from '@/utils/html';
import { cleanText, stripTags } from '@/utils/html-parse';

import { SCRIBBLEHUB_BASE_URL, SCRIBBLEHUB_SOURCE_ID as SOURCE_ID } from './constants';
import type { StoryDetails } from '../types';

export type ScribbleHubChapter = {
  /** Provider chapter id, taken from the read URL. */
  id: string;
  /** Zero-based order within the novel. */
  index: number;
  title: string;
  /** Path of the chapter on the provider. */
  path: string;
  publishedAt: number | null;
};

export type ScribbleHubListingItem = {
  id: string;
  title: string;
  url: string;
  coverUrl: string | null;
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

/** Cloudflare serves an interstitial challenge page to non-browser clients. */
export function isCloudflareChallenge(html: string): boolean {
  return (
    /<title>\s*Just a moment/i.test(html) ||
    /cf-mitigated|challenges\.cloudflare\.com/i.test(html) ||
    /id="challenge-(running|form)"/i.test(html)
  );
}

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
  const author = /Author:\s*<span class="a_un_st"><a[^>]*>([\s\S]*?)<\/a>/i.exec(statsText);
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
    authorName: author ? stripTags(author[1]) || null : null,
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
    id: item.id,
    title: item.title,
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
  const title =
    stripTags(/<div class="fic_title mb"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? '') ||
    cleanText(/<meta property="og:title" content="([^"]*)"/i.exec(html)?.[1] ?? '') ||
    id;

  const author =
    stripTags(/<span class="auth_name_fic">([\s\S]*?)<\/span>/i.exec(html)?.[1] ?? '') || null;

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
    id,
    title,
    authorName: author,
    description: description || null,
    coverUrl: cover ? absolute(cover) : null,
    rating: Number.isFinite(rating) ? rating : null,
    views: statValue('Views'),
    votes: statValue('Favorites'),
    url: `https://www.scribblehub.com/series/${id}/`,
    flags: {},
    tags: genres,
    wordCount: null,
    seriesId: null,
    seriesTitle: null,
    series: null,
    raw: null,
  };
}

/**
 * Parses the chapter table. The provider serves it newest-first, so the list
 * is reversed into reading order and numbered by position.
 */
export function parseChapterList(html: string): ScribbleHubChapter[] {
  const entries: { id: string; title: string; path: string; publishedAt: number | null }[] = [];
  const pattern =
    /<a class="toc_a" href="([^"]*\/read\/[^"]*\/chapter\/(\d+)\/)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = stripTags(match[3]);
    if (!title) continue;
    const path = new URL(match[1], SCRIBBLEHUB_BASE_URL).pathname;
    entries.push({ id: match[2], title, path, publishedAt: null });
  }
  return entries.reverse().map((entry, index) => ({ ...entry, index }));
}

/** Chapter body text, taken from the reading view. */
export function parseChapterContent(html: string): { content: string; wordCount: number } {
  const body = /<div[^>]*class="chp_raw"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? '';
  const content = body.trim();
  const text = decodeHtmlEntities(content.replace(/<[^>]+>/g, ' '));
  return { content, wordCount: estimateWordCount(text) };
}
