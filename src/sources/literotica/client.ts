import { HttpClient, type QueryValue } from '../transport';

export type LiteroticaCredentials = {
  apikey?: string | null;
  appid?: string | null;
};

/** Parameters accepted by `3/search/stories` (`params` JSON body). */
export type LiteroticaSearchParams = {
  page: number;
  q?: string;
  categories?: (string | number)[];
  languages?: string[];
  tags?: string[];
  sort?: string;
  period?: string;
  rating_min?: number;
  word_count_min?: number;
  word_count_max?: number;
  popular?: boolean;
  editors_choice?: boolean;
  contest_winner?: boolean;
};

const PATHS = {
  search: '3/search/stories',
  story: '3/stories',
  tagsByName: '3/tagsportal/by-name',
  tagStories: '3/tagsportal/stories',
  tagsTop: '3/tagsportal/top',
} as const;

/**
 * Thin, typed wrapper around Literotica's unofficial JSON API.
 *
 * Only the v3 endpoints are used: they work anonymously, whereas the legacy
 * v1/v2 endpoints now require a privileged app id. This layer knows nothing
 * about domain models — it returns validated-by-parser raw payloads, keeping
 * scraping/fetching concerns out of the source and UI.
 */
export class LiteroticaClient {
  constructor(
    private readonly http: HttpClient,
    private readonly credentials: LiteroticaCredentials = {},
  ) {}

  searchStories(params: LiteroticaSearchParams): Promise<unknown> {
    return this.get(PATHS.search, { params: JSON.stringify(params) });
  }

  story(id: string): Promise<unknown> {
    return this.get(`${PATHS.story}/${encodeURIComponent(id)}`);
  }

  topTags(params: { limit: number; period: string; periodCheck: boolean }): Promise<unknown> {
    return this.get(PATHS.tagsTop, params);
  }

  tagsByName(tags: string[]): Promise<unknown> {
    return this.get(PATHS.tagsByName, { params: JSON.stringify({ tags }) });
  }

  tagStories(params: Record<string, unknown>): Promise<unknown> {
    return this.get(PATHS.tagStories, { params: JSON.stringify(params) });
  }

  private get(
    path: string,
    query: Record<string, QueryValue | QueryValue[]> = {},
  ): Promise<unknown> {
    return this.http.get<unknown>(path, {
      query: { ...query, ...this.credentialQuery() },
    });
  }

  private credentialQuery(): Record<string, QueryValue> {
    const query: Record<string, QueryValue> = {};
    if (this.credentials.apikey) query.apikey = this.credentials.apikey;
    if (this.credentials.appid) query.appid = this.credentials.appid;
    return query;
  }
}
