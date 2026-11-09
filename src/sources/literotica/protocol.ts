/**
 * Literotica's story model: a series is the library unit, and each series work
 * ("Part 1", "Part 2", ...) is a chapter. Standalone stories are their own
 * single-chapter novel. Submission ids stay untouched; series ids get a prefix
 * so the app can tell the two apart without probing the API.
 *
 * Protocol:
 * - series metadata: GET 3/series/{id}
 * - chapter list:    GET 3/series/{id}/works
 * - chapter text:    GET 3/stories/{submissionId} -> pageText
 * - author profile:  GET 3/users/{numericUserId}
 * - author works:    GET 3/users/{numericUserId}/stories?page={page}
 */
export const LITEROTICA_SERIES_PREFIX = 'series-';
export const LITEROTICA_WEB_ORIGIN = 'https://www.literotica.com';

export function seriesNovelId(seriesId: string | number): string {
  return `${LITEROTICA_SERIES_PREFIX}${seriesId}`;
}

export function isSeriesNovelId(id: string): boolean {
  return id.startsWith(LITEROTICA_SERIES_PREFIX);
}

export function seriesApiId(id: string): string {
  return id.slice(LITEROTICA_SERIES_PREFIX.length);
}

export function authorApiPath(authorId: string): string {
  return `3/users/${encodeURIComponent(authorId)}`;
}

export function authorWorksApiPath(authorId: string): string {
  return `${authorApiPath(authorId)}/stories`;
}

export function authorWebUrl(username: string): string {
  return `${LITEROTICA_WEB_ORIGIN}/authors/${encodeURIComponent(username)}`;
}
