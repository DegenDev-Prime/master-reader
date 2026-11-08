import type { Story } from '@/models/story';

import { browserEvaluate, browserHtmlLoader } from '../browser-loader';
import { normalizePage, toPagedResult } from '../provider-utils';
import { SourceError } from '../transport';
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
import { SCRIBBLEHUB_BASE_URL, SCRIBBLEHUB_SOURCE_ID, SCRIBBLEHUB_WEB_URL } from './constants';
import {
  listingToStory,
  parseChapterContent,
  parseChapterList,
  parseListing,
  parseSeries,
} from './parsers';
import {
  chapterListExpression,
  chapterUrl,
  hasNextListingPage,
  isCloudflareChallenge,
  latestPath,
  popularPath,
  searchPath,
  seriesIdFromInput,
  seriesUrl,
  SCRIBBLEHUB_CHAPTER_WAIT_SELECTOR,
  SCRIBBLEHUB_SERIES_WAIT_SELECTOR,
  SCRIBBLEHUB_USES_BROWSER,
} from './protocol';

export type ScribbleHubSourceOptions = {
  /** Overrides the network layer; defaults to the in-app thin browser. */
  loadHtml?: HtmlLoader;
  /** Runs an expression inside the loaded page; defaults to the browser. */
  evaluate?: (url: string, expression: string) => Promise<string>;
};

const GENRES = [
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Harem',
  'Horror',
  'Isekai',
  'LitRPG',
  'Mature',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-fi',
  'Slice of Life',
  'Supernatural',
  'Thriller',
  'Tragedy',
];

/**
 * Scribble Hub source. The site sits behind a Cloudflare bot challenge, so
 * every read goes through the in-app thin browser, which runs the challenge's
 * JavaScript. The chapter table is fetched with the page's own session
 * because it is only exposed through a same-origin AJAX call.
 */
export class ScribbleHubSource implements Source {
  readonly info: SourceInfo = {
    id: SCRIBBLEHUB_SOURCE_ID,
    name: 'Scribble Hub',
    lang: 'en',
    baseUrl: SCRIBBLEHUB_WEB_URL,
    capabilities: ['popular', 'latest', 'search', 'categories'],
  };

  readonly usesBrowser = SCRIBBLEHUB_USES_BROWSER;

  private readonly loadHtml: HtmlLoader;
  private readonly evaluate: (url: string, expression: string) => Promise<string>;

  constructor(options: ScribbleHubSourceOptions = {}) {
    this.loadHtml = options.loadHtml ?? browserHtmlLoader;
    this.evaluate = options.evaluate ?? browserEvaluate;
  }

  async getPopular(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const html = await this.read(this.url(popularPath(page)));
    const items = parseListing(html);
    return toPagedResult(items.map(listingToStory), page, hasNextListingPage(html, page));
  }

  async getLatest(request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const html = await this.read(this.url(latestPath(page)));
    const items = parseListing(html);
    return toPagedResult(items.map(listingToStory), page, hasNextListingPage(html, page));
  }

  async search(filters: SearchFilters, request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const query = filters.query?.trim() ?? '';
    if (!query) return { items: [], page, hasNext: false, total: 0 };
    const html = await this.read(this.url(searchPath(query, page)));
    const items = parseListing(html);
    return toPagedResult(items.map(listingToStory), page, hasNextListingPage(html, page));
  }

  /** Metadata only; chapters come from `getChapterList` and text per chapter. */
  async getStory(id: string, _options: GetStoryOptions = {}): Promise<StoryDetails | null> {
    const seriesId = seriesIdFromInput(id);
    const html = await this.read(seriesUrl(seriesId), {
      waitForSelector: SCRIBBLEHUB_SERIES_WAIT_SELECTOR,
    });
    return parseSeries(seriesId, html);
  }

  /**
   * The visible table only shows the newest chapters. The full list is served
   * by the page's own AJAX endpoint, which the page fetches for its "show all"
   * button; the expression below reuses that call.
   */
  async getChapterList(storyId: string): Promise<ChapterRef[]> {
    const seriesId = seriesIdFromInput(storyId);

    let html: string;
    try {
      html = await this.evaluate(seriesUrl(seriesId), chapterListExpression(seriesId));
    } catch (error) {
      throw new SourceError('Scribble Hub did not return its chapter list', {
        code: 'http',
        originalError: error,
      });
    }
    if (!html) {
      throw new SourceError('Scribble Hub did not return its chapter list', { code: 'http' });
    }

    const chapters = parseChapterList(html);
    if (chapters.length === 0) {
      throw new SourceError('Scribble Hub returned no chapters for this series', { code: 'http' });
    }

    return chapters.map((chapter) => ({
      id: chapter.id,
      index: chapter.index,
      title: chapter.title,
      url: chapterUrl(seriesId, chapter.id),
      publishedAt: chapter.publishedAt,
    }));
  }

  async getChapterContent(storyId: string, chapterId: string): Promise<string | null> {
    const html = await this.read(chapterUrl(storyId, chapterId), {
      waitForSelector: SCRIBBLEHUB_CHAPTER_WAIT_SELECTOR,
    });
    const parsed = parseChapterContent(html);
    return parsed.content || null;
  }

  async getTags(): Promise<string[]> {
    return [];
  }

  async getCategories(): Promise<Category[]> {
    return GENRES.map((name) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name }));
  }

  isLoggedIn(): boolean {
    return false;
  }

  private url(path: string): string {
    return `${SCRIBBLEHUB_BASE_URL}${path}`;
  }

  private async read(url: string, options?: { waitForSelector?: string }): Promise<string> {
    const html = await this.loadHtml(url, options);
    if (isCloudflareChallenge(html)) {
      throw new SourceError('Scribble Hub is blocking automated access', { code: 'http' });
    }
    return html;
  }
}

export function createScribbleHubSource(options?: ScribbleHubSourceOptions): ScribbleHubSource {
  return new ScribbleHubSource(options);
}

export {
  SCRIBBLEHUB_BASE_URL,
  SCRIBBLEHUB_PAGE_SIZE,
  SCRIBBLEHUB_SOURCE_ID,
  SCRIBBLEHUB_WEB_URL,
} from './constants';
