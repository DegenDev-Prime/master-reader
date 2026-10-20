import type { Story, StoryPage, StorySeries } from '@/models/story';

export type SourceCapability = 'popular' | 'latest' | 'search' | 'tags' | 'categories' | 'auth';

/** Listing mode offered by `Source.getPopular` / `Source.getLatest`. */
export type BrowseKind = 'popular' | 'latest';

export type SourceInfo = {
  id: string;
  name: string;
  lang: string;
  baseUrl: string;
  capabilities: SourceCapability[];
};

export type PageRequest = {
  page?: number;
  limit?: number;
  /** Restricts a browse listing to a single category id (when supported). */
  category?: string;
};

export type PagedResult<T> = {
  items: T[];
  page: number;
  hasNext: boolean;
  total?: number;
};

export type SearchSort = 'relevance' | 'newest' | 'popular' | 'rating' | 'words' | 'comments';
export type SearchPeriod = 'day' | 'week' | 'month' | 'year' | 'all';

export type SearchFilters = {
  query?: string;
  tags?: string[];
  categories?: string[];
  languages?: string[];
  sort?: SearchSort;
  period?: SearchPeriod;
  minRating?: number;
  minWords?: number;
  maxWords?: number;
  popularOnly?: boolean;
  editorsChoice?: boolean;
  contestWinner?: boolean;
  newOnly?: boolean;
  random?: boolean;
};

export type GetStoryOptions = {
  /** When false, skips fetching page content (metadata only). Defaults to true. */
  includeContent?: boolean;
};

/**
 * Loads a page's HTML. Built-in providers use this seam so the same scraping
 * code works over a plain HTTP client or the in-app thin browser.
 */
export type HtmlLoader = (url: string, options?: { waitForSelector?: string }) => Promise<string>;

export type StoryDetails = Story & {
  seriesId?: string | null;
  seriesTitle?: string | null;
  series?: StorySeries | null;
  pages?: StoryPage[];
};

/** A single chapter of a novel, independent of its content. */
export type ChapterRef = {
  /** Provider chapter id or path, passed back to `getChapterContent`. */
  id: string;
  /** Zero-based order within the novel. */
  index: number;
  title: string;
  url?: string | null;
  /** Volume the chapter belongs to, when the provider groups chapters. */
  volume?: string | null;
  /** Position of the chapter within its volume. */
  volumeIndex?: number | null;
  /** Word count, when the provider reports one. */
  wordCount?: number | null;
  /** unix seconds */
  publishedAt?: number | null;
};

export type Category = {
  id: string;
  name: string;
};

export type LoginCredentials = {
  username: string;
  password: string;
};

/**
 * The contract every content source implements. Sources produce domain `Story`
 * objects; persistence and UI are source-agnostic.
 */
export interface Source {
  readonly info: SourceInfo;
  getPopular(request?: PageRequest): Promise<PagedResult<Story>>;
  getLatest(request?: PageRequest): Promise<PagedResult<Story>>;
  search(filters: SearchFilters, request?: PageRequest): Promise<PagedResult<Story>>;
  getStory(id: string, options?: GetStoryOptions): Promise<StoryDetails | null>;
  getTags(): Promise<string[]>;
  getCategories(): Promise<Category[]>;
  isLoggedIn(): boolean;
  /**
   * When true the provider prefers the in-app thin browser for network reads,
   * so bot-challenged sites (Cloudflare) can be resolved by executing their JS.
   */
  readonly usesBrowser?: boolean;
  /**
   * Lazily fetches one chapter's content. Providers with large chapter lists
   * return chapter stubs from `getStory` (content omitted) and implement this.
   */
  getChapterContent?(storyId: string, chapterId: string): Promise<string | null>;
  /** Optional explicit chapter list; defaults to the stubs from `getStory`. */
  getChapterList?(storyId: string): Promise<ChapterRef[]>;
}

export interface AuthenticatedSource extends Source {
  login(credentials: LoginCredentials): Promise<void>;
  logout(): Promise<void>;
}
