export type LegacyPage = {
  sourceId: string;
  storyId: string;
  index: number;
  chapterId: string | null;
  title: string | null;
  content: string | null;
  wordCount: number | null;
};

export type LegacyChapter = {
  sourceId: string;
  novelId: string;
  id: string;
  position: number;
  title: string | null;
  wordCount: number | null;
  content: string | null;
};

export function chapterIdForPage(page: LegacyPage): string {
  if (page.chapterId && page.chapterId.length > 0) return page.chapterId;
  if (page.sourceId === 'novelfire' && page.index >= 0) return String(page.index + 1);
  return `p${page.index}`;
}

export function chapterFromPage(page: LegacyPage): LegacyChapter {
  return {
    sourceId: page.sourceId,
    novelId: page.storyId,
    id: chapterIdForPage(page),
    position: page.index,
    title: page.title,
    wordCount: page.wordCount,
    content: page.content,
  };
}

export function chapterIdsFromPages(pages: LegacyPage[], indexes: number[]): string[] {
  const wanted = new Set(indexes);
  return pages.filter((page) => wanted.has(page.index)).map((page) => chapterIdForPage(page));
}

export function uniqueChapterIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
