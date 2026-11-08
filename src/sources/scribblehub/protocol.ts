/**
 * Scribble Hub's model: a numeric series id is the library unit. The site
 * resolves `/series/{id}/` to the slug URL, so ids from listings, saved
 * library entries and old read URLs all stay numeric.
 *
 * Protocol:
 * - popular:          GET /series-finder/?sf=1&sort=ratings&order=desc&pg=N
 * - latest:           GET /latest-series/?pg=N
 * - search:           GET /series-finder/?sf=1&sh={query}&pg=N
 * - series metadata:  GET /series/{id}/
 * - chapter list:     GET /series/{id}/ then POST /wp-admin/admin-ajax.php with
 *                     action=wi_getreleases_pagination, pagenum=-1, mypostid={id}
 * - chapter text:     GET /read/{id}/chapter/{chapterId}/
 *
 * The visible chapter table is partial; the AJAX response is the full,
 * newest-first list. It must be fetched inside the series page's own session.
 */
import { SCRIBBLEHUB_BASE_URL } from './constants';

export const SCRIBBLEHUB_AJAX_PATH = '/wp-admin/admin-ajax.php';
export const SCRIBBLEHUB_USES_BROWSER = true;
export const SCRIBBLEHUB_SERIES_WAIT_SELECTOR = '.fic_title';
export const SCRIBBLEHUB_CHAPTER_WAIT_SELECTOR = '.chp_raw';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Accepts a bare id, a slug-prefixed id, or a series/read URL. */
export function seriesIdFromInput(value: string): string {
  const input = value.trim();
  const match = /(?:^|\/)(?:series|read)\/(\d+)/i.exec(input) ?? /^(\d+)/.exec(input);
  return match?.[1] ?? input;
}

export function seriesPath(id: string): string {
  return `/series/${encodeURIComponent(seriesIdFromInput(id))}/`;
}

export function seriesUrl(id: string): string {
  return `${SCRIBBLEHUB_BASE_URL}${seriesPath(id)}`;
}

export function popularPath(page: number): string {
  return `/series-finder/?sf=1&sort=ratings&order=desc&pg=${page}`;
}

export function latestPath(page: number): string {
  return `/latest-series/?pg=${page}`;
}

export function searchPath(query: string, page: number): string {
  return `/series-finder/?sf=1&sh=${encodeURIComponent(query)}&pg=${page}`;
}

/** The listings paginate with `pg`; page links keep filters in the query. */
export function hasNextListingPage(html: string, page: number): boolean {
  return new RegExp(`[?&](?:amp;)?pg=${page + 1}(?:[&#"']|$)`, 'i').test(html);
}

export function chapterIdFromHref(href: string): string | null {
  const match = /\/chapter\/(\d+)(?:[/?#]|$)/i.exec(href);
  return match?.[1] ?? null;
}

export function chapterIdFromInput(value: string): string {
  return chapterIdFromHref(value) ?? value.trim();
}

export function chapterPath(storyId: string, chapterId: string): string {
  return `/read/${encodeURIComponent(seriesIdFromInput(storyId))}/chapter/${encodeURIComponent(
    chapterIdFromInput(chapterId),
  )}/`;
}

export function chapterUrl(storyId: string, chapterId: string): string {
  return `${SCRIBBLEHUB_BASE_URL}${chapterPath(storyId, chapterId)}`;
}

/** The site prints dates without a zone, so they are read as UTC. */
export function parseChapterPublishedAt(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i.exec(
    value.trim(),
  );
  if (!match) return null;

  const month = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase());
  if (month < 0) return null;

  let hour = match[4] ? Number(match[4]) % 12 : 0;
  if (/pm/i.test(match[6] ?? '')) hour += 12;

  const ms = Date.UTC(Number(match[3]), month, Number(match[2]), hour, Number(match[5] ?? 0));
  return Number.isFinite(ms) ? Math.round(ms / 1000) : null;
}

export function chapterListExpression(storyId: string): string {
  const url = `${SCRIBBLEHUB_BASE_URL}${SCRIBBLEHUB_AJAX_PATH}`;
  return `(function(){
      var body = new URLSearchParams();
      body.set('action', 'wi_getreleases_pagination');
      body.set('pagenum', '-1');
      var field = document.getElementById('mypostid');
      body.set('mypostid', field && field.value ? field.value : ${JSON.stringify(
        seriesIdFromInput(storyId),
      )});
      return fetch(${JSON.stringify(url)}, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: body.toString()
      }).then(function(response){ return response.text(); });
    })()`;
}

/** Cloudflare serves an interstitial challenge page to non-browser clients. */
export function isCloudflareChallenge(html: string): boolean {
  return (
    /<title>\s*Just a moment/i.test(html) ||
    /cf-mitigated|challenges\.cloudflare\.com/i.test(html) ||
    /id="challenge-(running|form)"/i.test(html)
  );
}
