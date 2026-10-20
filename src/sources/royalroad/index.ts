import type { Story, StoryPage } from '@/models/story';

import { browserHtmlLoader } from '../browser-loader';
import { normalizePage, toPagedResult } from '../provider-utils';
import { NotFoundError, SourceError } from '../transport';
import type {
  Category,
  ChapterRef,
  GetStoryOptions,
  HtmlLoader,
  PageRequest,
  PagedResult,
  SearchFilters,
  Source,
  SourceInfo,
  StoryDetails,
} from '../types';
import { ROYALROAD_CATEGORIES } from './categories';
import {
  ROYALROAD_BASE_URL,
  ROYALROAD_PATHS,
  ROYALROAD_SOURCE_ID,
  ROYALROAD_WEB_URL,
} from './constants';
import {
  isCloudflareChallenge,
  parseChapterContent,
  parseChapterList,
  parseFiction,
  parseListing,
} from './parsers';

export type RoyalRoadSourceOptions = {
  /** Overrides the network layer; defaults to the in-app thin browser. */
  loadHtml?: HtmlLoader;
};

/**
 * Royal Road source. Royal Road is behind a Cloudflare bot challenge for plain
 * HTTP clients, so every read goes through the in-app thin browser, which runs
 * the challenge's JavaScript. Chapters are content-less stubs until read.
 */
export class RoyalRoadSource implements Source {
  readonly info: SourceInfo = {
    id: ROYALROAD_SOURCE_ID,
    name: 'Royal Road',
    lang: 'en',
    baseUrl: ROYALROAD_WEB_URL,
    capabilities: ['popular', 'latest', 'search', 'categories'],
  };

  readonly usesBrowser = true;

  private readonly loadHtml: HtmlLoader;

  constructor(options: RoyalRoadSourceOptions = {}) {
    this.loadHtml = options.loadHtml ?? browserHtmlLoader;
  }

  async getPopular(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const html = await this.readListing(this.url(ROYALROAD_PATHS.popular, { page }));
    const listing = parseListing(html, page);
    return toPagedResult(listing.stories, page, listing.hasNext);
  }

  async getLatest(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const html = await this.readListing(this.url(ROYALROAD_PATHS.latest, { page }));
    const listing = parseListing(html, page);
    return toPagedResult(listing.stories, page, listing.hasNext);
  }

  async search(filters: SearchFilters, request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    if (!filters.query) {
      return { items: [], page, hasNext: false, total: 0 };
    }
    const html = await this.readListing(
      this.url(ROYALROAD_PATHS.search, { title: filters.query, page }),
    );
    const listing = parseListing(html, page);
    return toPagedResult(listing.stories, page, listing.hasNext);
  }

  async getStory(id: string, options: GetStoryOptions = {}): Promise<StoryDetails | null> {
    const includeContent = options.includeContent ?? true;
    const html = await this.read(this.url(`/fiction/${id}`), { waitForSelector: 'h1' });
    const story = parseFiction(id, html);
    if (!includeContent) return story;

    const chapters = this.toChapters(id, html);
    const pages: StoryPage[] = chapters.map((chapter) => ({
      sourceId: this.info.id,
      storyId: id,
      index: chapter.index,
      title: chapter.title,
      id: chapter.id,
      content: null,
      wordCount: null,
    }));

    return { ...story, pages };
  }

  async getChapterContent(_storyId: string, chapterId: string): Promise<string | null> {
    const html = await this.read(this.absolute(chapterId), { waitForSelector: 'h1' });
    const parsed = parseChapterContent(html);
    return parsed.content || null;
  }

  /** All chapters live on the fiction page, embedded in the chapters table. */
  async getChapterList(storyId: string): Promise<ChapterRef[]> {
    const html = await this.read(this.url(`/fiction/${storyId}`), { waitForSelector: 'h1' });
    return this.toChapters(storyId, html);
  }

  async getTags(): Promise<string[]> {
    return [];
  }

  async getCategories(): Promise<Category[]> {
    return ROYALROAD_CATEGORIES;
  }

  isLoggedIn(): boolean {
    return false;
  }

  private toChapters(id: string, html: string): ChapterRef[] {
    return parseChapterList(html, id).map((chapter, index) => ({
      id: chapter.path,
      index,
      title: chapter.title,
      url: `${ROYALROAD_BASE_URL}${chapter.path}`,
      publishedAt: null,
    }));
  }

  private url(path: string, query?: Record<string, string | number>): string {
    const base = `${ROYALROAD_BASE_URL}${path}`;
    if (!query) return base;
    const qs = Object.entries(query)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    return `${base}?${qs}`;
  }

  private absolute(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return `${ROYALROAD_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  private async read(url: string, options?: { waitForSelector?: string }): Promise<string> {
    const html = await this.loadHtml(url, options);
    if (isCloudflareChallenge(html)) {
      throw new SourceError('Royal Road is blocking automated access', { code: 'http' });
    }
    return html;
  }

  /** Listing reads; a 404 here means the edge dropped us, not a real miss. */
  private async readListing(url: string): Promise<string> {
    try {
      return await this.read(url);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new SourceError('Royal Road is currently unavailable', {
          code: 'http',
          originalError: error,
        });
      }
      throw error;
    }
  }
}

export function createRoyalRoadSource(options?: RoyalRoadSourceOptions): RoyalRoadSource {
  return new RoyalRoadSource(options);
}

export {
  ROYALROAD_BASE_URL,
  ROYALROAD_PAGE_SIZE,
  ROYALROAD_SOURCE_ID,
  ROYALROAD_WEB_URL,
} from './constants';
