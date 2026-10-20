import type { HttpClient } from '../transport';

import { NOVELBUDDY_BASE_URL } from './constants';

export { NOVELBUDDY_BASE_URL };

/** The API wraps every payload in `{ success, data }`. */
export type NovelBuddyEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type NovelBuddyListItem = {
  id: string;
  url: string;
  name: string;
  alt_name?: string | null;
  slug?: string | null;
  cover?: string | null;
  status?: string | null;
  rating?: number | null;
  summary?: string | null;
  updated_at?: string | null;
  stats?: {
    views?: number | null;
    bookmarks_count?: number | null;
    chapters_count?: number | null;
    ratings_count?: number | null;
  } | null;
  genres?: { name: string; slug?: string | null }[] | null;
  latest_chapters?:
    | {
        id: string;
        name: string;
        url: string;
        number?: number | null;
        updated_at?: string | null;
      }[]
    | null;
};

export type NovelBuddyChapter = {
  id: string;
  name: string;
  url: string;
  slug?: string | null;
  number?: number | null;
  views?: number | null;
  comments_count?: number | null;
  updated_at?: string | null;
};

export type NovelBuddyPagination = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
};

export type NovelBuddyTitle = {
  id: string;
  url: string;
  name: string;
  alt_name?: string | null;
  slug?: string | null;
  cover?: string | null;
  summary?: string | null;
  status?: string | null;
  rating?: number | null;
  content_rating?: string | null;
  updated_at?: string | null;
  cv?: number | null;
  genres?: { name: string; slug?: string | null }[] | null;
  tags?: { name: string; slug?: string | null }[] | null;
  authors?: { name: string; slug?: string | null }[] | null;
  stats?: {
    views?: number | null;
    bookmarks_count?: number | null;
    comments_count?: number | null;
    chapters_count?: number | null;
    ratings_count?: number | null;
  } | null;
  latest_chapters?:
    | {
        id: string;
        name: string;
        url: string;
        number?: number | null;
        updated_at?: string | null;
      }[]
    | null;
};

export type NovelBuddyChapterDetail = {
  id: string;
  name: string;
  url: string;
  number?: number | null;
  content?: string | null;
  summary?: string | null;
  word_count?: number | null;
};

/** Thin client over the public NovelBuddy read API. */
export class NovelBuddyClient {
  constructor(private readonly http: HttpClient) {}

  async home(): Promise<{
    latest: { items: NovelBuddyListItem[]; pagination: NovelBuddyPagination };
    popular: NovelBuddyListItem[];
    trending: NovelBuddyListItem[];
  }> {
    const response = await this.http.get<
      NovelBuddyEnvelope<{
        latest: { items: NovelBuddyListItem[]; pagination: NovelBuddyPagination };
        popular: NovelBuddyListItem[];
        trending: NovelBuddyListItem[];
      }>
    >('/titles/home');
    return response.data;
  }

  async search(
    query: string,
    page: number,
    limit: number,
    options: { sort?: string; genres?: string[] } = {},
  ): Promise<{ items: NovelBuddyListItem[]; pagination: NovelBuddyPagination }> {
    const response = await this.http.get<
      NovelBuddyEnvelope<{
        items: NovelBuddyListItem[];
        pagination: NovelBuddyPagination;
      }>
    >('/titles/search', {
      query: {
        query,
        page,
        limit,
        ...(options.sort ? { sort: options.sort } : {}),
        ...(options.genres?.length ? { genres: options.genres.join(',') } : {}),
      },
    });
    return response.data;
  }

  async title(id: string): Promise<NovelBuddyTitle> {
    const response = await this.http.get<NovelBuddyEnvelope<{ title: NovelBuddyTitle }>>(
      `/titles/${id}`,
    );
    return response.data.title;
  }

  async chapters(id: string): Promise<NovelBuddyChapter[]> {
    const response = await this.http.get<NovelBuddyEnvelope<{ chapters: NovelBuddyChapter[] }>>(
      `/titles/${id}/chapters`,
    );
    return response.data.chapters;
  }

  async chapter(id: string, chapterId: string): Promise<NovelBuddyChapterDetail> {
    const response = await this.http.get<NovelBuddyEnvelope<{ chapter: NovelBuddyChapterDetail }>>(
      `/titles/${id}/chapters/${chapterId}`,
    );
    return response.data.chapter;
  }

  async genres(): Promise<{ id: string; name: string; slug: string }[]> {
    const response =
      await this.http.get<
        NovelBuddyEnvelope<{ items: { id: string; name: string; slug: string }[] }>
      >('/genres');
    return response.data.items;
  }
}
