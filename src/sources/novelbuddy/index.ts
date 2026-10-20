import type { Story, StoryPage } from '@/models/story';

import { normalizePage, toPagedResult } from '../provider-utils';
import { HttpClient, NotFoundError, type FetchLike, type ResponseCacheStore } from '../transport';
import type {
  Category,
  ChapterRef,
  GetStoryOptions,
  PageRequest,
  PagedResult,
  SearchFilters,
  SearchSort,
  Source,
  SourceInfo,
  StoryDetails,
} from '../types';
import { NovelBuddyClient, type NovelBuddyListItem } from './client';
import {
  NOVELBUDDY_BASE_URL,
  NOVELBUDDY_PAGE_SIZE,
  NOVELBUDDY_SOURCE_ID,
  NOVELBUDDY_WEB_URL,
} from './constants';
import { parseChapterContent, parseChapters, parseListItem, parseTitle } from './parsers';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const SORT_VALUES: Partial<Record<SearchSort, string>> = {
  relevance: 'popular',
  popular: 'popular',
  rating: 'rating',
  newest: 'newest',
};

export type NovelBuddySourceOptions = {
  userAgent?: string;
  fetch?: FetchLike;
  http?: HttpClient;
  cache?: ResponseCacheStore;
  isOffline?: () => boolean;
  cacheTtlMs?: number;
};

/**
 * NovelBuddy source. The public read API serves JSON, so listings, chapter
 * lists and chapter bodies all come back structured — no HTML scraping and no
 * bot challenge. Chapters are loaded lazily, one at a time.
 */
export class NovelBuddySource implements Source {
  readonly info: SourceInfo = {
    id: NOVELBUDDY_SOURCE_ID,
    name: 'NovelBuddy',
    lang: 'en',
    baseUrl: NOVELBUDDY_WEB_URL,
    capabilities: ['popular', 'latest', 'search', 'categories'],
  };

  private readonly client: NovelBuddyClient;

  constructor(options: NovelBuddySourceOptions = {}) {
    const http =
      options.http ??
      new HttpClient({
        baseUrl: NOVELBUDDY_BASE_URL,
        userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
        defaultHeaders: { accept: 'application/json' },
        fetch: options.fetch,
        retries: 2,
        timeoutMs: 20_000,
        cache: options.cache,
        isOffline: options.isOffline,
        cacheTtlMs: options.cacheTtlMs,
      });

    this.client = new NovelBuddyClient(http);
  }

  async getPopular(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const home = await this.client.home();
    const items = home.popular ?? [];
    return toPagedResult(items.map(parseListItem), page, items.length >= NOVELBUDDY_PAGE_SIZE);
  }

  async getLatest(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const home = await this.client.home();
    const latest = home.latest;
    const items = latest.items ?? [];
    const pagination = latest.pagination;
    const hasNext = pagination ? pagination.has_next : false;
    const currentPage = pagination ? pagination.page : page;
    return toPagedResult(items.map(parseListItem), currentPage, hasNext);
  }

  async search(filters: SearchFilters, request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const query = filters.query?.trim() ?? '';
    if (!query) return { items: [], page, hasNext: false, total: 0 };

    const result = await this.client.search(query, page, NOVELBUDDY_PAGE_SIZE, {
      sort: filters.sort ? SORT_VALUES[filters.sort] : undefined,
      genres: filters.categories,
    });
    return toPagedResult(
      result.items.map(parseListItem),
      result.pagination.page,
      result.pagination.has_next,
      result.pagination.total,
    );
  }

  async getStory(id: string, options: GetStoryOptions = {}): Promise<StoryDetails | null> {
    const includeContent = options.includeContent ?? true;
    const title = await this.client.title(id);
    const story = parseTitle(title);
    if (!includeContent) return story;

    const chapters = await this.getChapterList(id);
    const pages: StoryPage[] = chapters.map((chapter, index) => ({
      sourceId: this.info.id,
      storyId: id,
      index,
      title: chapter.title,
      id: chapter.id,
      content: null,
      wordCount: null,
    }));

    return { ...story, pages };
  }

  async getChapterList(storyId: string): Promise<ChapterRef[]> {
    const chapters = await this.client.chapters(storyId);
    return parseChapters(chapters).map((chapter, index) => ({
      id: chapter.id,
      index,
      title: chapter.title,
      url: chapter.url,
      publishedAt: null,
    }));
  }

  async getChapterContent(storyId: string, chapterId: string): Promise<string | null> {
    try {
      const detail = await this.client.chapter(storyId, chapterId);
      const parsed = parseChapterContent(detail);
      return parsed.content || null;
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  }

  async getTags(): Promise<string[]> {
    return [];
  }

  async getCategories(): Promise<Category[]> {
    const genres = await this.client.genres();
    return genres.map((genre) => ({ id: genre.slug || genre.name, name: genre.name }));
  }

  isLoggedIn(): boolean {
    return false;
  }
}

export function createNovelBuddySource(options?: NovelBuddySourceOptions): NovelBuddySource {
  return new NovelBuddySource(options);
}

export type { NovelBuddyListItem };
export {
  NOVELBUDDY_BASE_URL,
  NOVELBUDDY_PAGE_SIZE,
  NOVELBUDDY_SOURCE_ID,
  NOVELBUDDY_WEB_URL,
} from './constants';
