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
 */
export const LITEROTICA_SERIES_PREFIX = 'series-';

export function seriesNovelId(seriesId: string | number): string {
  return `${LITEROTICA_SERIES_PREFIX}${seriesId}`;
}

export function isSeriesNovelId(id: string): boolean {
  return id.startsWith(LITEROTICA_SERIES_PREFIX);
}

export function seriesApiId(id: string): string {
  return id.slice(LITEROTICA_SERIES_PREFIX.length);
}
