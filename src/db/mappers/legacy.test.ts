import { describe, expect, it } from 'vitest';

import {
  chapterFromPage,
  chapterIdForPage,
  chapterIdsFromPages,
  uniqueChapterIds,
  type LegacyPage,
} from './legacy';

const page: LegacyPage = {
  sourceId: 'novelfire',
  storyId: 'shadow-slave',
  index: 4,
  chapterId: '25',
  title: 'Chapter 25',
  content: 'Text',
  wordCount: 1200,
};

describe('legacy page mapping', () => {
  it('keeps a provider chapter id', () => {
    expect(chapterIdForPage(page)).toBe('25');
  });

  it('derives NovelFire chapter ids from page order when downloads lack ids', () => {
    expect(chapterIdForPage({ ...page, chapterId: null })).toBe('5');
    expect(chapterIdForPage({ ...page, sourceId: 'novelfire', index: 0, chapterId: null })).toBe(
      '1',
    );
  });

  it('falls back to a page-stable id for eager pages', () => {
    expect(chapterIdForPage({ ...page, sourceId: 'literotica', chapterId: null })).toBe('p4');
    expect(chapterIdForPage({ ...page, sourceId: 'literotica', chapterId: '' })).toBe('p4');
  });

  it('maps a page to a chapter row without inventing metadata', () => {
    const chapter = chapterFromPage(page);
    expect(chapter).toEqual({
      sourceId: 'novelfire',
      novelId: 'shadow-slave',
      id: '25',
      position: 4,
      title: 'Chapter 25',
      wordCount: 1200,
      content: 'Text',
    });
  });

  it('maps legacy read-page indexes in page order and ignores gaps', () => {
    const pages = [
      page,
      { ...page, index: 5, chapterId: '26' },
      { ...page, index: 9, chapterId: null },
    ];
    expect(chapterIdsFromPages(pages, [9, 4, 5])).toEqual(['25', '26', '10']);
    expect(chapterIdsFromPages(pages, [7])).toEqual([]);
  });

  it('dedupes chapter ids', () => {
    expect(uniqueChapterIds(['a', 'b', 'a'])).toEqual(['a', 'b']);
  });
});
