/**
 * Source titles usually repeat the chapter number ("Chapter 6 - 6: Title").
 * The reader already prints the number, so strip the redundant prefix while
 * keeping the title intact when it consists only of the number.
 */
export function chapterDisplayTitle(title: string | null | undefined): string {
  const raw = title?.trim() ?? '';
  if (!raw) return '';

  const withoutChapter = raw.replace(/^chapter\s*(?:\d+|[ivxlcdm]+)\s*[-–—:.)]\s*/i, '');
  const withoutNumber = withoutChapter.replace(/^\d+\s*[-–—:.)]\s*/, '');
  const cleaned = withoutNumber.trim();
  return cleaned || raw;
}
