import type { HttpClient } from '../transport';

import { NOVELFIRE_BASE_URL } from './constants';

export { NOVELFIRE_BASE_URL };

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

export function chapterPath(slug: string, chapter: number): string {
  return `/book/${slug}/chapter-${chapter}`;
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

  private text(path: string, page: number): Promise<string> {
    return this.http.get<string>(path, { responseType: 'text', query: { page } });
  }
}
