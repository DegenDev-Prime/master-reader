import type { Story } from '@/models/story';

import { HttpClient, NotFoundError, type FetchLike, type ResponseCacheStore } from '../transport';
import type {
  AuthorPage,
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
import { LITEROTICA_CATEGORIES } from './categories';
import { LiteroticaClient, type LiteroticaCredentials } from './client';
import {
  parseSeriesChapterRefs,
  parseTagList,
  parseV3Author,
  parseV3AuthorWorks,
  parseV3ChapterText,
  parseV3List,
  parseV3SeriesStory,
  parseV3TagStories,
  parseV3Work,
  singleChapterRef,
  toNumber,
} from './parsers';
import { isSeriesNovelId, seriesApiId } from './protocol';

export const LITEROTICA_SOURCE_ID = 'literotica';
export const LITEROTICA_BASE_URL = 'https://literotica.com/api';
export const LITEROTICA_WEB_URL = 'https://www.literotica.com';
export const DEFAULT_PAGE_SIZE = 25;

const DEFAULT_USER_AGENT = 'Master Reader/0.1 (reader; +https://github.com/)';

/**
 * The v3 endpoints accept a `sort` value (not `sort_by`). Only relevance, date,
 * rating and comment volume are supported server-side; `words` has no
 * equivalent and falls back to the API default.
 */
const SORT_VALUES: Partial<Record<SearchSort, string>> = {
  relevance: 'relevancy',
  newest: 'date',
  rating: 'vote',
  popular: 'comments',
  comments: 'comments',
};

export type { LiteroticaCredentials } from './client';

export type LiteroticaSourceOptions = {
  credentials?: LiteroticaCredentials;
  userAgent?: string;
  fetch?: FetchLike;
  /** Inject a preconfigured client (used in tests). */
  http?: HttpClient;
  /** Enables GET response caching on the internal client. */
  cache?: ResponseCacheStore;
  isOffline?: () => boolean;
  cacheTtlMs?: number;
};

/**
 * Literotica source built on their unofficial JSON API.
 *
 * Only the anonymous v3 endpoints are used: the legacy v1/v2 endpoints require
 * a privileged app id that is intentionally not bundled. Credentials, when
 * supplied at runtime, are forwarded but never required.
 */
export class LiteroticaSource implements Source {
  readonly info: SourceInfo = {
    id: LITEROTICA_SOURCE_ID,
    name: 'Literotica',
    lang: 'en',
    baseUrl: LITEROTICA_WEB_URL,
    capabilities: ['popular', 'latest', 'search', 'tags', 'categories', 'authors'],
  };

  private readonly client: LiteroticaClient;
  private loggedIn = false;

  constructor(options: LiteroticaSourceOptions = {}) {
    const credentials = options.credentials ?? {};
    const http =
      options.http ??
      new HttpClient({
        baseUrl: LITEROTICA_BASE_URL,
        userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
        fetch: options.fetch,
        retries: 2,
        timeoutMs: 15_000,
        cache: options.cache,
        isOffline: options.isOffline,
        cacheTtlMs: options.cacheTtlMs,
      });

    this.client = new LiteroticaClient(http, credentials);
  }

  async getPopular(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const payload = await this.client.searchStories({
      page,
      sort: SORT_VALUES.popular,
      ...categoryParams(request.category),
    });
    return this.toPaged(parseV3List(this.info.id, payload), page, request.limit);
  }

  async getLatest(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const payload = await this.client.searchStories({
      page,
      sort: SORT_VALUES.newest,
      ...categoryParams(request.category),
    });
    return this.toPaged(parseV3List(this.info.id, payload), page, request.limit);
  }

  async search(filters: SearchFilters, request: PageRequest = {}): Promise<PagedResult<Story>> {
    if (filters.tags?.length && !filters.query) {
      return this.searchByTags(filters, request);
    }
    return this.searchV3(filters, request);
  }

  /**
   * Resolves either a series id (`series-<id>`) or a work id/slug. A work that
   * belongs to a series is returned under the series' canonical id, so opening
   * any part lands on the whole series. Content is never included here; the
   * chapter list comes from `getChapterList` and text is fetched per chapter.
   */
  async getStory(id: string, _options: GetStoryOptions = {}): Promise<StoryDetails | null> {
    if (isSeriesNovelId(id)) {
      const payload = await this.client.series(seriesApiId(id));
      const story = parseV3SeriesStory(this.info.id, payload);
      return { ...story, seriesId: story.seriesId ?? null, series: null };
    }

    const payload = await this.client.story(id);
    const { story, series } = parseV3Work(this.info.id, payload);
    return {
      ...story,
      seriesId: story.seriesId ?? null,
      seriesTitle: story.seriesTitle ?? null,
      series,
    };
  }

  /** Fetches the profile plus one page of the author's works. */
  async getAuthor(authorId: string, request: PageRequest = {}): Promise<AuthorPage | null> {
    const page = normalizePage(request.page);
    const [profile, works] = await Promise.all([
      this.client.author(authorId),
      this.client.authorStories(authorId, page),
    ]);
    const author = parseV3Author(this.info.id, authorId, profile);
    const result = parseV3AuthorWorks(this.info.id, works);

    return {
      author,
      stories: {
        items: uniqueById(result.stories),
        page: result.page,
        hasNext: result.hasNext,
        total: result.total ?? undefined,
      },
    };
  }

  /**
   * Literotica chapters are series works (submissions), not pages. The series
   * endpoint gives the ordered list; a standalone work is a one-chapter novel.
   */
  async getChapterList(storyId: string): Promise<ChapterRef[]> {
    if (isSeriesNovelId(storyId)) {
      const works = await this.client.seriesWorks(seriesApiId(storyId));
      return parseSeriesChapterRefs(works);
    }

    const { story, series } = parseV3Work(this.info.id, await this.client.story(storyId));
    if (series) {
      return parseSeriesChapterRefs(await this.client.seriesWorks(series.id));
    }
    return [singleChapterRef(story)];
  }

  async getChapterContent(_storyId: string, chapterId: string): Promise<string | null> {
    try {
      return parseV3ChapterText(await this.client.story(chapterId));
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  }

  async getTags(): Promise<string[]> {
    const payload = await this.client.topTags({
      limit: 100,
      periodCheck: false,
      period: 'all',
    });
    return parseTagList(payload).map((tag) => tag.name);
  }

  async getCategories(): Promise<Category[]> {
    return LITEROTICA_CATEGORIES;
  }

  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  private async searchV3(
    filters: SearchFilters,
    request: PageRequest,
  ): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const params: Parameters<LiteroticaClient['searchStories']>[0] = { page };

    if (filters.query) params.q = filters.query;
    if (filters.categories?.length) params.categories = toNumericIds(filters.categories);
    if (filters.languages?.length) params.languages = filters.languages;
    if (filters.tags?.length) params.tags = filters.tags;
    if (filters.sort) params.sort = SORT_VALUES[filters.sort];
    if (filters.period) params.period = filters.period;
    if (filters.minRating !== undefined) params.rating_min = filters.minRating;
    if (filters.minWords !== undefined) params.word_count_min = filters.minWords;
    if (filters.maxWords !== undefined) params.word_count_max = filters.maxWords;
    if (filters.popularOnly) params.popular = true;
    if (filters.editorsChoice) params.editors_choice = true;
    if (filters.contestWinner) params.contest_winner = true;

    const payload = await this.client.searchStories(params);
    return this.toPaged(parseV3List(this.info.id, payload), page, request.limit);
  }

  private async searchByTags(
    filters: SearchFilters,
    request: PageRequest,
  ): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const lookupPayload = await this.client.tagsByName(filters.tags ?? []);
    const ids = parseTagList(lookupPayload).map((tag) => tag.id);

    if (ids.length === 0) {
      return { items: [], page, hasNext: false, total: 0 };
    }

    const params: Record<string, unknown> = {
      tags: ids,
      page,
      sort: SORT_VALUES[filters.sort ?? 'newest'] ?? 'date',
    };
    if (filters.categories?.length) params.categories = toNumericIds(filters.categories);

    const payload = await this.client.tagStories(params);
    return this.toPaged(parseV3TagStories(this.info.id, payload), page, request.limit);
  }

  private toPaged(
    result: { stories: Story[]; total: number | null },
    page: number,
    limit?: number,
  ): PagedResult<Story> {
    const pageSize = limit ?? DEFAULT_PAGE_SIZE;
    const total = result.total ?? undefined;
    const hasNext =
      total !== undefined ? page * pageSize < total : result.stories.length >= pageSize;

    return { items: uniqueById(result.stories), page, hasNext, total };
  }
}

export function createLiteroticaSource(options?: LiteroticaSourceOptions): LiteroticaSource {
  return new LiteroticaSource(options);
}

/** A series' parts share one canonical id; keep the first card per page. */
function uniqueById(stories: Story[]): Story[] {
  const seen = new Set<string>();
  return stories.filter((story) => {
    if (seen.has(story.id)) return false;
    seen.add(story.id);
    return true;
  });
}

function normalizePage(page?: number): number {
  if (!page || !Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

function toNumericIds(ids: string[]): (string | number)[] {
  return ids.map((id) => toNumber(id) ?? id);
}

function categoryParams(category?: string): { categories?: (string | number)[] } {
  if (!category) return {};
  return { categories: [toNumber(category) ?? category] };
}
