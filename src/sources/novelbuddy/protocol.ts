import { NOVELBUDDY_WEB_URL } from './constants';

/**
 * NovelBuddy's model: the opaque alphanumeric title id is the library unit and
 * chapter ids are opaque too. Slugs are display-only and never round-trip
 * through the app.
 *
 * Protocol:
 * - home blocks:    GET /titles/home -> { latest, popular, trending }
 * - search:         GET /titles/search?q=&page=&limit=&sort=&genres=
 * - title metadata: GET /titles/{titleId}
 * - chapter list:   GET /titles/{titleId}/chapters -> every chapter, newest first
 * - chapter text:   GET /titles/{titleId}/chapters/{chapterId} -> data.chapter.content
 *
 * Every payload is wrapped in `{ success, data }`. The home blocks are one
 * snapshot (numeric `page` is ignored and latest paginates by an opaque cursor),
 * so only search exposes numeric pages. Search needs the `q` parameter; a
 * `query` parameter is silently ignored. The API allows 300 requests per minute
 * and returns 404 for unknown ids; the shared HttpClient retries 429/5xx and
 * maps 404 to `NotFoundError`.
 */
export type NovelBuddyEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export const NOVELBUDDY_HOME_PATH = '/titles/home';
export const NOVELBUDDY_SEARCH_PATH = '/titles/search';
export const NOVELBUDDY_GENRES_PATH = '/genres';

export function titlePath(id: string): string {
  return `/titles/${id}`;
}

export function chaptersPath(id: string): string {
  return `${titlePath(id)}/chapters`;
}

export function chapterPath(id: string, chapterId: string): string {
  return `${chaptersPath(id)}/${chapterId}`;
}

export function authorPath(slug: string): string {
  return `/authors/${encodeURIComponent(slug)}`;
}

export function authorUrl(slug: string, page = 1): string {
  const url = `${NOVELBUDDY_WEB_URL}${authorPath(slug)}`;
  return page > 1 ? `${url}?page=${page}` : url;
}

/** Home blocks ignore `page`; only the first page exists for numeric paging. */
export function homePageAvailable(page: number): boolean {
  return page === 1;
}

export type NovelBuddySearchQuery = {
  q: string;
  page: number;
  limit: number;
  sort?: string;
  genres?: string;
};

export function searchQuery(
  query: string,
  page: number,
  limit: number,
  options: { sort?: string; genres?: string[] } = {},
): NovelBuddySearchQuery {
  return {
    q: query,
    page,
    limit,
    ...(options.sort ? { sort: options.sort } : {}),
    ...(options.genres?.length ? { genres: options.genres.join(',') } : {}),
  };
}

/** API URLs are site paths; covers are sometimes absolute. */
export function siteUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${NOVELBUDDY_WEB_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * The API returns chapters newest-first and may repeat one. Readers expect
 * ascending numbers, with unnumbered chapters last.
 */
export function orderChapters<T extends { id: string; number?: number | null }>(
  chapters: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const chapter of chapters) {
    if (!byId.has(chapter.id)) byId.set(chapter.id, chapter);
  }
  return [...byId.values()].sort(
    (a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER),
  );
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
