import type { Story, StoryPage, StorySeries } from '@/models/story';

export type SourceCapability = 'popular' | 'latest' | 'search' | 'tags' | 'categories' | 'auth';

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

export type StoryDetails = Story & {
  seriesId?: string | null;
  seriesTitle?: string | null;
  series?: StorySeries | null;
  pages?: StoryPage[];
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
}

export interface AuthenticatedSource extends Source {
  login(credentials: LoginCredentials): Promise<void>;
  logout(): Promise<void>;
}
