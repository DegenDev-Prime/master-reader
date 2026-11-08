/**
 * NovelFire's model: a book slug is the library unit, every chapter is its own
 * numbered page, and chapter text may sit behind a mirror redirect.
 *
 * Protocol:
 * - book metadata:  GET /book/{slug}
 * - chapter list:   GET /book/{slug}/chapters?page=N   (100 per page)
 * - chapter text:   GET /book/{slug}/chapter-{n} -> follow the mirror script
 */
export const NOVELFIRE_MIRROR_URL = 'https://novelphoenix.com';

export function genrePath(genre: string): string {
  return `/genre-${genre}/sort-popular/status-all/all-novel`;
}

export function bookPath(slug: string): string {
  return `/book/${slug}`;
}

export function chaptersPath(slug: string, page: number): string {
  return `/book/${slug}/chapters?page=${page}`;
}

export function chapterPath(slug: string, chapter: number): string {
  return `/book/${slug}/chapter-${chapter}`;
}

export function mirrorChapterPath(slug: string, chapter: number): string {
  return `${NOVELFIRE_MIRROR_URL}/novel/${slug}/chapter-${chapter}`;
}

/** Chapter ids are the site's 1-based chapter numbers as strings. */
export function chapterIdFromNumber(number: number): string {
  return String(number);
}

export function chapterNumberFromId(id: string): number | null {
  const number = Number(id);
  return Number.isInteger(number) && number > 0 ? number : null;
}

const REDIRECT_PATTERNS = [
  /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
  /window\.location\.(?:replace|assign)\(\s*["']([^"']+)["']\s*\)/i,
  /location\.href\s*=\s*["']([^"']+)["']/i,
];

/** Extracts the absolute mirror URL from a chapter redirect page. */
export function chapterRedirectTarget(html: string): string | null {
  for (const pattern of REDIRECT_PATTERNS) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const target = match[1].replace(/\\\//g, '/').replace(/\\u002f/gi, '/');
    if (/^https?:\/\//i.test(target)) return target;
  }
  return null;
}

/**
 * A real chapter always carries `id="content"`. A redirect page does not, and
 * points at a mirror through script rather than HTTP.
 */
export function isChapterInterstitial(html: string): boolean {
  return !/id=["']content["']/i.test(html) && chapterRedirectTarget(html) != null;
}
