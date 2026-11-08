import type { HttpClient } from '../transport';

import { NOVELFIRE_BASE_URL } from './constants';
import {
  bookPath,
  chapterPath,
  chapterRedirectTarget,
  chaptersPath,
  genrePath,
  isChapterInterstitial,
  mirrorChapterPath,
} from './protocol';

export { NOVELFIRE_BASE_URL };
export { chapterRedirectTarget, isChapterInterstitial, NOVELFIRE_MIRROR_URL } from './protocol';

const POPULAR_PATH = '/genre-all/sort-popular/status-all/all-novel';
const LATEST_PATH = '/genre-all/sort-new/status-all/all-novel';

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
    return this.http.get<string>(chaptersPath(slug, page), { responseType: 'text' });
  }

  getChapter(
    slug: string,
    chapter: number,
    options: { skipCache?: boolean } = {},
  ): Promise<string> {
    return this.http.get<string>(chapterPath(slug, chapter), {
      responseType: 'text',
      skipCache: options.skipCache,
    });
  }

  /**
   * Chapter content. The chapter page answers with a script that redirects to
   * a mirror domain; a fetch follows HTTP redirects only, so the interstitial
   * is detected here and its target (or the known mirror) is fetched directly.
   */
  async getChapterContent(
    slug: string,
    chapter: number,
    options: { skipCache?: boolean } = {},
  ): Promise<string> {
    const html = await this.getChapter(slug, chapter, options);
    if (!isChapterInterstitial(html)) return html;
    const target = chapterRedirectTarget(html) ?? mirrorChapterPath(slug, chapter);
    return this.http.get<string>(target, {
      responseType: 'text',
      skipCache: options.skipCache,
    });
  }

  private text(path: string, page: number): Promise<string> {
    return this.http.get<string>(path, { responseType: 'text', query: { page } });
  }
}
