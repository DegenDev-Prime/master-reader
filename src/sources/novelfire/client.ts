import type { HttpClient } from '../transport';

import { NOVELFIRE_BASE_URL } from './constants';

export { NOVELFIRE_BASE_URL };

/**
 * The interstitial only plays a redirect script: a real chapter page carries
 * its own `<div id="content">`. Checking the marker pair avoids refetching a
 * chapter that legitimately mentions the mirror domain.
 */
export function isChapterInterstitial(html: string): boolean {
  return !html.includes('id="content"') && html.includes('novelphoenix.com');
}

const POPULAR_PATH = '/genre-all/sort-popular/status-all/all-novel';
const LATEST_PATH = '/genre-all/sort-new/status-all/all-novel';

export function genrePath(genre: string): string {
  return `/genre-${genre}/sort-popular/status-all/all-novel`;
}

export function bookPath(slug: string): string {
  return `/book/${slug}`;
}

export function chaptersPath(slug: string, page: number): string {
  return `/book/${slug}/chapters?page=${page}`;
}

/** Chapter pages redirect here through a script no fetch client can follow. */
export const NOVELFIRE_MIRROR_URL = 'https://novelphoenix.com';

export function chapterPath(slug: string, chapter: number): string {
  return `/book/${slug}/chapter-${chapter}`;
}

export function mirrorChapterPath(slug: string, chapter: number): string {
  return `${NOVELFIRE_MIRROR_URL}/novel/${slug}/chapter-${chapter}`;
}

export class NovelFireClient {
  constructor(private readonly http: HttpClient) {}

  getPopular(page: number, genre?: string): Promise<string> {
    return this.text(genre ? genrePath(genre) : POPULAR_PATH, page);
  }

  getLatest(page: number, genre?: string): Promise<string> {
    return this.text(genre ? genrePath(genre) : LATEST_PATH, page);
  }

  search(keyword: string, page: number): Promise<string> {
    return this.http.get<string>('/search', {
      responseType: 'text',
      query: { keyword, page },
    });
  }

  getBook(slug: string): Promise<string> {
    return this.http.get<string>(bookPath(slug), { responseType: 'text' });
  }

  getChapterList(slug: string, page: number): Promise<string> {
    return this.http.get<string>(`${bookPath(slug)}/chapters`, {
      responseType: 'text',
      query: { page },
    });
  }

  getChapter(slug: string, chapter: number): Promise<string> {
    return this.http.get<string>(chapterPath(slug, chapter), { responseType: 'text' });
  }

  /**
   * Chapter content. The chapter page answers with a script that redirects to
   * a mirror domain; a fetch follows HTTP redirects only, so the interstitial
   * is detected here and the mirror is fetched directly.
   */
  async getChapterContent(slug: string, chapter: number): Promise<string> {
    const html = await this.getChapter(slug, chapter);
    if (isChapterInterstitial(html)) {
      return this.http.get<string>(mirrorChapterPath(slug, chapter), { responseType: 'text' });
    }
    return html;
  }

  private text(path: string, page: number): Promise<string> {
    return this.http.get<string>(path, { responseType: 'text', query: { page } });
  }
}
