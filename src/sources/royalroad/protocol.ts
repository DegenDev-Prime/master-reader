/**
 * Royal Road's model: a fiction is identified by a numeric id, everything
 * about it lives on the fiction page, and chapters are lazily read one at a
 * time.
 *
 * Protocol:
 * - fiction metadata: GET /fiction/{id}
 * - chapter list:    embedded in the fiction page (`window.chapters` and
 *                    `window.volumes`; the `#chapters` table is the fallback)
 * - chapter text:    GET /fiction/{id}/{slug}/chapter/{chapterId}/{slug}
 *
 * Legacy persisted chapter ids are the site path (not the numeric chapter id),
 * so they keep resolving for existing library entries and downloads.
 *
 * Reads run through the in-app thin browser because Cloudflare serves a
 * JavaScript challenge to plain HTTP clients.
 */
import {
  allMatches,
  cleanText,
  extractElementById,
  firstMatch,
  getAttribute,
  stripTags,
} from '@/utils/html-parse';

import { NotFoundError, SourceError } from '../transport';
import type { ChapterRef, HtmlLoader } from '../types';

export const ROYALROAD_SOURCE_ID = 'royalroad';
export const ROYALROAD_BASE_URL = 'https://www.royalroad.com';
export const ROYALROAD_WEB_URL = 'https://www.royalroad.com';
export const ROYALROAD_PAGE_SIZE = 20;
export const ROYALROAD_PAGE_SELECTOR = 'h1';
export const ROYALROAD_USES_BROWSER = true;

export type RoyalRoadListingKind = 'popular' | 'latest';

const LISTING_PATHS: Record<RoyalRoadListingKind, string> = {
  popular: '/fictions/best-rated',
  latest: '/fictions/latest-updates',
};

const FICTION_HREF = /^(?:https?:\/\/[^/]+)?\/fiction\/(\d+)(?:[/?#]|$)/i;
const CHAPTER_HREF =
  /^(?:https?:\/\/[^/]+)?(\/fiction\/(\d+)(?:\/[^/?#]+)?\/chapter\/(\d+)(?:\/[^?#]*)?)/i;

export function royalRoadUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('//')) return `https:${path}`;
  return `${ROYALROAD_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Reads the numeric fiction id from an id or a fiction URL. */
export function normalizeFictionId(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  return fictionIdFromHref(trimmed);
}

export function fictionIdFromHref(href: string): string | null {
  return FICTION_HREF.exec(href)?.[1] ?? null;
}

export function fictionPath(storyId: string): string {
  return `/fiction/${storyId}`;
}

export function fictionUrl(storyId: string): string {
  return royalRoadUrl(fictionPath(storyId));
}

export function listingPath(kind: RoyalRoadListingKind, page: number): string {
  return `${LISTING_PATHS[kind]}?page=${page}`;
}

export function listingUrl(kind: RoyalRoadListingKind, page: number): string {
  return royalRoadUrl(listingPath(kind, page));
}

export function searchPath(query: string, page: number): string {
  return `/fictions/search?title=${encodeURIComponent(query)}&page=${page}`;
}

export function searchUrl(query: string, page: number): string {
  return royalRoadUrl(searchPath(query, page));
}

/** Listings print the next page link only when another page exists. */
export function hasNextPage(html: string, page: number): boolean {
  return new RegExp(`[?&]page=${page + 1}(?:[&"'\\s]|$)`, 'i').test(html);
}

/** Resolves a persisted chapter id (path, absolute URL, or bare numeric id). */
export function chapterUrl(storyId: string, chapterId: string): string {
  const trimmed = chapterId.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) return royalRoadUrl(trimmed);
  if (trimmed.startsWith('/')) return royalRoadUrl(trimmed);
  if (/^\d+$/.test(trimmed)) return royalRoadUrl(`${fictionPath(storyId)}/chapter/${trimmed}`);
  return royalRoadUrl(trimmed);
}

export type RoyalRoadChapter = {
  /** Site chapter id, distinct from the path stored as the library id. */
  chapterId: number;
  path: string;
  title: string;
  volumeId: number | null;
  volumeTitle: string | null;
  volumeIndex: number | null;
  /** unix seconds; null when the site omits the date */
  publishedAt: number | null;
};

/** Maps parsed chapters to library chapter refs, preserving legacy path ids. */
export function toChapterRefs(chapters: RoyalRoadChapter[], storyId: string): ChapterRef[] {
  return chapters.map((chapter, index) => ({
    id: chapter.path,
    index,
    title: chapter.title,
    url: chapterUrl(storyId, chapter.path),
    volume: chapter.volumeTitle,
    volumeIndex: chapter.volumeIndex,
    publishedAt: chapter.publishedAt,
  }));
}

/**
 * The fiction page embeds the authoritative chapter list plus optional volume
 * titles. Older captures only have the `#chapters` table, so that stays as a
 * fallback and as the fixture path.
 */
export function parseChapterList(html: string, storyId: string): RoyalRoadChapter[] {
  const inline = parseInlineChapters(html, storyId);
  const chapters = inline.length > 0 ? inline : parseTableChapters(html, storyId);
  return applyVolumes(chapters, parseInlineVolumes(html));
}

function parseInlineChapters(html: string, storyId: string): RoyalRoadChapter[] {
  const raw = assignedJson(html, 'window.chapters');
  if (!Array.isArray(raw)) return [];

  const seen = new Set<number>();
  const ordered: { order: number; chapter: RoyalRoadChapter }[] = [];

  raw.forEach((entry, position) => {
    if (!entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    if (record.visible === 0 || record.visible === '0') return;

    const chapterId = positiveInt(record.id);
    if (chapterId === null || seen.has(chapterId)) return;

    const path = chapterPath(record.url, storyId, chapterId);
    const title = typeof record.title === 'string' ? cleanText(record.title) : '';
    if (!path || !title) return;

    seen.add(chapterId);
    ordered.push({
      order: finiteInt(record.order) ?? position,
      chapter: {
        chapterId,
        path,
        title,
        volumeId: positiveInt(record.volumeId),
        volumeTitle: null,
        volumeIndex: null,
        publishedAt: isoSeconds(record.date),
      },
    });
  });

  return ordered.sort((a, b) => a.order - b.order).map((entry) => entry.chapter);
}

function parseInlineVolumes(html: string): Map<number, string> {
  const raw = assignedJson(html, 'window.volumes');
  const volumes = new Map<number, string>();
  if (!Array.isArray(raw)) return volumes;

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const id = positiveInt(record.id);
    const title = typeof record.title === 'string' ? cleanText(record.title) : '';
    if (id !== null && title) volumes.set(id, title);
  }
  return volumes;
}

function parseTableChapters(html: string, storyId: string): RoyalRoadChapter[] {
  const scope = extractElementById(html, 'chapters', 'table');
  if (!scope) return parseChapterAnchors(html, storyId);

  const seen = new Set<number>();
  const chapters: RoyalRoadChapter[] = [];
  for (const match of allMatches(scope, /<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
    const row = match[0];
    const href =
      getAttribute(row, 'data-url') ?? firstMatch(row, /<a\b[^>]*\bhref\s*=\s*"([^"]+)"/i);
    const parsed = href ? chapterFromHref(href, storyId) : null;
    if (!parsed || seen.has(parsed.chapterId)) continue;

    const title = stripTags(
      firstMatch(row, /<a\b[^>]*\bhref\s*=\s*"[^"]*\/chapter\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ?? '',
    );
    if (!title) continue;

    const volumeAttr = getAttribute(row, 'data-volume-id');
    seen.add(parsed.chapterId);
    chapters.push({
      chapterId: parsed.chapterId,
      path: parsed.path,
      title,
      volumeId: volumeAttr && volumeAttr !== 'null' ? positiveInt(volumeAttr) : null,
      volumeTitle: null,
      volumeIndex: null,
      publishedAt: positiveInt(getAttribute(row, 'unixtime')),
    });
  }

  return chapters.length > 0 ? chapters : parseChapterAnchors(scope, storyId);
}

function parseChapterAnchors(html: string, storyId: string): RoyalRoadChapter[] {
  const seen = new Set<number>();
  const chapters: RoyalRoadChapter[] = [];
  for (const match of allMatches(
    html,
    /<a\b[^>]*\bhref\s*=\s*"([^"]*\/chapter\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const parsed = chapterFromHref(match[1], storyId);
    if (!parsed || seen.has(parsed.chapterId)) continue;
    const title = stripTags(match[2]);
    if (!title) continue;
    seen.add(parsed.chapterId);
    chapters.push({
      chapterId: parsed.chapterId,
      path: parsed.path,
      title,
      volumeId: null,
      volumeTitle: null,
      volumeIndex: null,
      publishedAt: null,
    });
  }
  return chapters;
}

function applyVolumes(
  chapters: RoyalRoadChapter[],
  volumes: Map<number, string>,
): RoyalRoadChapter[] {
  const positions = new Map<number, number>();
  for (const chapter of chapters) {
    if (chapter.volumeId === null) continue;
    const position = positions.get(chapter.volumeId) ?? 0;
    chapter.volumeTitle = volumes.get(chapter.volumeId) ?? null;
    chapter.volumeIndex = position;
    positions.set(chapter.volumeId, position + 1);
  }
  return chapters;
}

function chapterFromHref(
  href: string,
  storyId: string,
): { chapterId: number; path: string } | null {
  const match = CHAPTER_HREF.exec(href);
  if (!match || match[2] !== storyId) return null;
  const chapterId = positiveInt(match[3]);
  return chapterId === null ? null : { chapterId, path: match[1] };
}

function chapterPath(value: unknown, storyId: string, chapterId: number): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return `${fictionPath(storyId)}/chapter/${chapterId}`;
  }
  const match = CHAPTER_HREF.exec(value);
  if (!match || match[2] !== storyId || positiveInt(match[3]) !== chapterId) return null;
  return match[1];
}

function assignedJson(html: string, name: string): unknown {
  const marker = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*`, 'g');
  const match = marker.exec(html);
  if (!match) return null;

  let index = match.index + match[0].length;
  const start = index;
  if (html[index] !== '[' && html[index] !== '{') return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '[' || char === '{') {
      depth += 1;
    } else if (char === ']' || char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function positiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function finiteInt(value: unknown): number | null {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function isoSeconds(value: unknown): number | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? Math.floor(millis / 1000) : null;
}

/** Cloudflare serves an interstitial challenge page to non-browser clients. */
export function isCloudflareChallenge(html: string): boolean {
  return (
    /<title>\s*Just a moment/i.test(html) ||
    /cf-mitigated|challenges\.cloudflare\.com/i.test(html) ||
    /id="challenge-(running|form)"/i.test(html)
  );
}

/** One browser-backed read, with challenge detection on the returned HTML. */
export async function readRoyalRoadHtml(
  loadHtml: HtmlLoader,
  url: string,
  options?: { waitForSelector?: string },
): Promise<string> {
  const html = await loadHtml(url, options);
  if (isCloudflareChallenge(html)) {
    throw new SourceError('Royal Road is blocking automated access', { code: 'http' });
  }
  return html;
}

/** Listing reads; a 404 here means the edge dropped us, not a real miss. */
export async function readRoyalRoadListing(loadHtml: HtmlLoader, url: string): Promise<string> {
  try {
    return await readRoyalRoadHtml(loadHtml, url);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new SourceError('Royal Road is currently unavailable', {
        code: 'http',
        originalError: error,
      });
    }
    throw error;
  }
}
