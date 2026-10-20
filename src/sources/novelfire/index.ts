import type { Story, StoryPage } from '@/models/story';
import { mapWithConcurrency } from '@/utils/html-parse';

import { normalizePage, toPagedResult } from '../provider-utils';
import { HttpClient, NotFoundError, type FetchLike, type ResponseCacheStore } from '../transport';
import type {
  Category,
  ChapterRef,
  GetStoryOptions,
  PageRequest,
  PagedResult,
  SearchFilters,
  Source,
  SourceInfo,
  StoryDetails,
} from '../types';
import { NOVELFIRE_CATEGORIES } from './categories';
import { NovelFireClient, genrePath } from './client';
import {
  NOVELFIRE_BASE_URL,
  NOVELFIRE_MAX_CHAPTER_LIST_PAGES,
  NOVELFIRE_SOURCE_ID,
  NOVELFIRE_WEB_URL,
} from './constants';
import {
  parseBook,
  parseChapterContent,
  parseChapterList,
  parseLastPage,
  parseListing,
} from './parsers';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

export type NovelFireSourceOptions = {
  userAgent?: string;
  fetch?: FetchLike;
  http?: HttpClient;
  cache?: ResponseCacheStore;
  isOffline?: () => boolean;
  cacheTtlMs?: number;
  /** Caps how many chapter-list pages are walked for a novel. */
  maxChapterListPages?: number;
};

/**
 * Novel Fire source over server-rendered HTML. The novel's chapter list is
 * returned as content-less page stubs; chapter text is fetched lazily through
 * `getChapterContent`, so a 3000-chapter serial never loads all at once.
 */
export class NovelFireSource implements Source {
  readonly info: SourceInfo = {
    id: NOVELFIRE_SOURCE_ID,
    name: 'NovelFire',
    lang: 'en',
    baseUrl: NOVELFIRE_WEB_URL,
    capabilities: ['popular', 'latest', 'search', 'categories'],
  };

  private readonly client: NovelFireClient;
  private readonly maxChapterListPages: number;

  constructor(options: NovelFireSourceOptions = {}) {
    const http =
      options.http ??
      new HttpClient({
        baseUrl: NOVELFIRE_BASE_URL,
        userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
        defaultHeaders: { accept: 'text/html,application/xhtml+xml' },
        fetch: options.fetch,
        retries: 2,
        timeoutMs: 15_000,
        cache: options.cache,
        isOffline: options.isOffline,
        cacheTtlMs: options.cacheTtlMs,
      });

    this.client = new NovelFireClient(http);
    this.maxChapterListPages = Math.max(
      1,
      options.maxChapterListPages ?? NOVELFIRE_MAX_CHAPTER_LIST_PAGES,
    );
  }

  async getPopular(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const html = await this.client.getPopular(page, request.category);
    return this.toPaged(html, page);
  }

  async getLatest(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const html = await this.client.getLatest(page, request.category);
    return this.toPaged(html, page);
  }

  async search(filters: SearchFilters, request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);

    if (!filters.query && filters.categories?.length) {
      const html = await this.client.getPopular(page, filters.categories[0]);
      return this.toPaged(html, page);
    }

    if (!filters.query) {
      return { items: [], page, hasNext: false, total: 0 };
    }

    const html = await this.client.search(filters.query, page);
    return this.toPaged(html, page);
  }

  async getStory(id: string, options: GetStoryOptions = {}): Promise<StoryDetails | null> {
    const includeContent = options.includeContent ?? true;
    const book = parseBook(id, await this.client.getBook(id));
    if (!includeContent) return book;

    const chapters = await this.getChapterList(id);
    const pages: StoryPage[] = chapters.map((chapter) => ({
      sourceId: this.info.id,
      storyId: id,
      index: chapter.index,
      title: chapter.title,
      id: chapter.id,
      content: null,
      wordCount: null,
    }));

    return { ...book, pages };
  }

  async getChapterList(storyId: string): Promise<ChapterRef[]> {
    const first = await this.client.getChapterList(storyId, 1);
    const lastPage = Math.min(parseLastPage(first), this.maxChapterListPages);
    const pages = [first];

    if (lastPage > 1) {
      const rest = await mapWithConcurrency(
        Array.from({ length: lastPage - 1 }, (_, index) => index + 2),
        4,
        (page) => this.client.getChapterList(storyId, page),
      );
      pages.push(...rest);
    }

    const seen = new Set<string>();
    const chapters: ChapterRef[] = [];
    for (const html of pages) {
      for (const chapter of parseChapterList(html, storyId)) {
        const id = String(chapter.number);
        if (seen.has(id)) continue;
        seen.add(id);
        chapters.push({
          id,
          index: chapters.length,
          title: chapter.title,
          url: `${NOVELFIRE_BASE_URL}/book/${storyId}/chapter-${chapter.number}`,
          publishedAt: null,
        });
      }
    }
    chapters.sort((a, b) => Number(a.id) - Number(b.id));
    return chapters.map((chapter, index) => ({ ...chapter, index }));
  }

  async getChapterContent(storyId: string, chapterId: string): Promise<string | null> {
    const number = Number(chapterId);
    if (!Number.isFinite(number)) return null;

    try {
      let parsed = parseChapterContent(await this.client.getChapter(storyId, number));
      // Novel Fire intermittently serves a content-less shell when several
      // chapters are fetched together; one delayed retry recovers it.
      if (!parsed.content) {
        await delay(300);
        parsed = parseChapterContent(await this.client.getChapter(storyId, number));
      }
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
    return NOVELFIRE_CATEGORIES;
  }

  isLoggedIn(): boolean {
    return false;
  }

  private toPaged(html: string, page: number): PagedResult<Story> {
    const listing = parseListing(html, page);
    return toPagedResult(listing.stories, page, listing.hasNext);
  }
}

export function createNovelFireSource(options?: NovelFireSourceOptions): NovelFireSource {
  return new NovelFireSource(options);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Re-exported for tests/tools that build browse URLs directly. */
export { genrePath };
export {
  NOVELFIRE_BASE_URL,
  NOVELFIRE_MAX_CHAPTER_LIST_PAGES,
  NOVELFIRE_PAGE_SIZE,
  NOVELFIRE_SOURCE_ID,
  NOVELFIRE_WEB_URL,
} from './constants';
