/** Pure helpers for page positioning in the reader. */

export function clampPageIndex(index: number, pageCount: number): number {
  if (!Number.isFinite(index)) return 0;
  const lastIndex = Math.max(0, pageCount - 1);
  return Math.min(Math.max(0, Math.floor(index)), lastIndex);
}

export function nextPageIndex(index: number, pageCount: number): number {
  return clampPageIndex(index + 1, pageCount);
}

export function previousPageIndex(index: number): number {
  return Math.max(0, Math.floor(index) - 1);
}

export function progressPercent(index: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((index + 1) / pageCount) * 100)));
}
