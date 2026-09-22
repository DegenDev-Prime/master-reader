/** Pure helpers for download sizing and progress. */

export function computeStorySizeBytes(pages: { content?: string | null }[]): number {
  return pages.reduce((total, page) => total + (page.content ? page.content.length : 0), 0);
}

export function downloadProgressPercent(
  downloaded: number,
  total: number | null | undefined,
): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((downloaded / total) * 100)));
}
