import type { Story, StoryPage } from '@/models/story';

import { browserHtmlLoader } from '../browser-loader';
import { normalizePage, toPagedResult } from '../provider-utils';
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
  chapterUrl,
  fictionUrl,
  listingUrl,
  normalizeFictionId,
  parseChapterList,
  readRoyalRoadHtml,
  readRoyalRoadListing,
  ROYALROAD_PAGE_SELECTOR,
  ROYALROAD_SOURCE_ID,
  ROYALROAD_USES_BROWSER,
  ROYALROAD_WEB_URL,
  searchUrl,
  toChapterRefs,
} from './protocol';
import { parseChapterContent, parseFiction, parseListing } from './parsers';

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

  readonly usesBrowser = ROYALROAD_USES_BROWSER;

  private readonly loadHtml: HtmlLoader;

  constructor(options: RoyalRoadSourceOptions = {}) {
    this.loadHtml = options.loadHtml ?? browserHtmlLoader;
  }

  async getPopular(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const html = await readRoyalRoadListing(this.loadHtml, listingUrl('popular', page));
    const listing = parseListing(html, page);
    return toPagedResult(listing.stories, page, listing.hasNext);
  }

  async getLatest(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const html = await readRoyalRoadListing(this.loadHtml, listingUrl('latest', page));
    const listing = parseListing(html, page);
    return toPagedResult(listing.stories, page, listing.hasNext);
  }

  async search(filters: SearchFilters, request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    if (!filters.query) {
      return { items: [], page, hasNext: false, total: 0 };
    }
    const html = await readRoyalRoadListing(this.loadHtml, searchUrl(filters.query, page));
    const listing = parseListing(html, page);
    return toPagedResult(listing.stories, page, listing.hasNext);
  }

  async getStory(id: string, options: GetStoryOptions = {}): Promise<StoryDetails | null> {
    const storyId = normalizeFictionId(id) ?? id;
    const includeContent = options.includeContent ?? true;
    const html = await readRoyalRoadHtml(this.loadHtml, fictionUrl(storyId), {
      waitForSelector: ROYALROAD_PAGE_SELECTOR,
    });
    const story = parseFiction(storyId, html);
    if (!includeContent) return story;

    const chapters = this.toChapters(storyId, html);
    const pages: StoryPage[] = chapters.map((chapter) => ({
      sourceId: this.info.id,
      storyId,
      index: chapter.index,
      title: chapter.title,
      id: chapter.id,
      content: null,
      wordCount: chapter.wordCount ?? null,
      volume: chapter.volume ?? null,
      volumeIndex: chapter.volumeIndex ?? null,
      publishedAt: chapter.publishedAt ?? null,
    }));

    return { ...story, pages };
  }

  async getChapterContent(storyId: string, chapterId: string): Promise<string | null> {
    const html = await readRoyalRoadHtml(this.loadHtml, chapterUrl(storyId, chapterId), {
      waitForSelector: ROYALROAD_PAGE_SELECTOR,
    });
    const parsed = parseChapterContent(html);
    return parsed.content || null;
  }

  /** All chapters live on the fiction page, embedded with their volume metadata. */
  async getChapterList(storyId: string): Promise<ChapterRef[]> {
    const normalized = normalizeFictionId(storyId) ?? storyId;
    const html = await readRoyalRoadHtml(this.loadHtml, fictionUrl(normalized), {
      waitForSelector: ROYALROAD_PAGE_SELECTOR,
    });
    return this.toChapters(normalized, html);
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

  private toChapters(storyId: string, html: string): ChapterRef[] {
    return toChapterRefs(parseChapterList(html, storyId), storyId);
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
