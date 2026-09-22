import type { Story } from '@/models/story';

import { HttpClient, type FetchLike, type ResponseCacheStore } from '../transport';
import type {
  Category,
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
import { parseTagList, parseV3List, parseV3Story, parseV3TagStories, toNumber } from './parsers';

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
    capabilities: ['popular', 'latest', 'search', 'tags', 'categories'],
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

  async getStory(id: string, options: GetStoryOptions = {}): Promise<StoryDetails | null> {
    const includeContent = options.includeContent ?? true;
    const payload = await this.client.story(id);
    const parsed = parseV3Story(this.info.id, payload);

    return {
      ...parsed.story,
      seriesId: parsed.series?.id ?? null,
      seriesTitle: parsed.series?.title ?? null,
      series: parsed.series,
      pages: includeContent ? parsed.pages : undefined,
    };
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

    return { items: result.stories, page, hasNext, total };
  }
}

export function createLiteroticaSource(options?: LiteroticaSourceOptions): LiteroticaSource {
  return new LiteroticaSource(options);
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
