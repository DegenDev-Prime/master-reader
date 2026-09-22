import { computeBackoffDelay, parseRetryAfter, type BackoffOptions } from './backoff';
import {
  cacheDirective,
  DEFAULT_CACHE_TTL_MS,
  isFresh,
  type CachedResponse,
  type ResponseCacheStore,
} from './cache';
import { CookieJar } from './cookies';
import {
  HttpError,
  NotFoundError,
  OfflineError,
  ParseError,
  RateLimitError,
  SourceError,
  TimeoutError,
} from './errors';
import { RequestQueue } from './queue';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue | QueryValue[]>;
  /** JSON body (objects) or a raw string / FormData. */
  body?: unknown;
  form?: Record<string, string>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  responseType?: 'json' | 'text';
  signal?: AbortSignal;
  /** Bypass the response cache for this request. */
  skipCache?: boolean;
};

export type HttpClientOptions = {
  baseUrl?: string;
  userAgent: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  fetch?: FetchLike;
  queue?: RequestQueue;
  cookieJar?: CookieJar;
  backoff?: BackoffOptions;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** When provided, GET responses are cached and revalidated. */
  cache?: ResponseCacheStore;
  /** Returns true when the app should serve from cache and avoid the network. */
  isOffline?: () => boolean;
  cacheTtlMs?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * JSON-over-HTTP client with a request queue, cookie jar, timeouts,
 * retry-with-backoff and an optional response cache. Errors are normalised into
 * `SourceError` subclasses so callers can react to rate limits, not-found,
 * offline and auth failures.
 */
export class HttpClient {
  readonly cookieJar: CookieJar;

  private readonly baseUrl?: string;
  private readonly userAgent: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fetchImpl: FetchLike;
  private readonly queue: RequestQueue;
  private readonly backoff: BackoffOptions;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly cache?: ResponseCacheStore;
  private readonly isOffline?: () => boolean;
  private readonly cacheTtlMs: number;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.userAgent = options.userAgent;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retries = options.retries ?? 2;
    this.fetchImpl = options.fetch ?? ((url, init) => fetch(url, init));
    this.queue = options.queue ?? new RequestQueue();
    this.cookieJar = options.cookieJar ?? new CookieJar();
    this.backoff = options.backoff ?? {};
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
    this.cache = options.cache;
    this.isOffline = options.isOffline;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST' });
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const retries = options.retries ?? this.retries;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const responseType = options.responseType ?? 'json';
    const url = this.buildUrl(path, options.query);

    const cacheKey = method === 'GET' && this.cache && !options.skipCache ? url : null;
    const cached: CachedResponse | null = cacheKey ? await this.cache!.get(cacheKey) : null;

    if (cacheKey) {
      if (this.isOffline?.()) {
        if (cached) return this.parseText<T>(cached.body, responseType, url);
        throw new OfflineError();
      }
      if (cached && isFresh(cached, this.now())) {
        return this.parseText<T>(cached.body, responseType, url);
      }
    }

    const conditionalHeaders: Record<string, string> = {};
    if (cached?.etag) conditionalHeaders['if-none-match'] = cached.etag;
    if (cached?.lastModified) conditionalHeaders['if-modified-since'] = cached.lastModified;

    let attempt = 0;
    for (;;) {
      attempt += 1;

      let response: Response;
      try {
        response = await this.fetchOnce(
          url,
          method,
          { ...options, headers: { ...options.headers, ...conditionalHeaders } },
          timeoutMs,
        );
      } catch (error) {
        if (attempt <= retries) {
          await this.sleep(this.nextDelay(attempt));
          continue;
        }
        if (error instanceof SourceError) throw error;
        // Serve a stale copy rather than fail outright when the network is down.
        if (cached) {
          return this.parseText<T>(cached.body, responseType, url);
        }
        throw new SourceError(error instanceof Error ? error.message : 'Network request failed', {
          code: 'network',
          originalError: error,
        });
      }

      this.cookieJar.setFromResponse(url, getSetCookie(response));

      if (response.status === 304 && cached && cacheKey) {
        const { expiresAt } = cacheDirective(response.headers, this.now(), this.cacheTtlMs);
        await this.cache!.set(cacheKey, { ...cached, expiresAt });
        return this.parseText<T>(cached.body, responseType, url);
      }

      if (response.ok) {
        const text = await response.text();

        if (cacheKey) {
          const directive = cacheDirective(response.headers, this.now(), this.cacheTtlMs);
          if (directive.store) {
            await this.cache!.set(cacheKey, {
              status: response.status,
              body: text,
              etag: response.headers.get('etag'),
              lastModified: response.headers.get('last-modified'),
              expiresAt: directive.expiresAt,
            });
          }
        }

        return this.parseText<T>(text, responseType, url);
      }

      const body = await safeText(response);

      if (response.status === 404) {
        throw new NotFoundError({ url, body });
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt <= retries) {
        const retryAfterMs =
          response.status === 429
            ? parseRetryAfter(response.headers.get('retry-after'), this.now())
            : undefined;
        await this.sleep(retryAfterMs ?? this.nextDelay(attempt));
        continue;
      }

      if (response.status === 429) {
        const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'), this.now());
        throw new RateLimitError({ url, body, retryAfterMs });
      }

      throw new HttpError(`HTTP ${response.status} for ${url}`, {
        status: response.status,
        url,
        body,
      });
    }
  }

  private async fetchOnce(
    url: string,
    method: string,
    options: RequestOptions,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const body = this.buildBody(options);
      const headers = this.buildHeaders(url, options, body);

      return await this.queue.schedule(() =>
        this.fetchImpl(url, {
          method,
          headers,
          body,
          signal: options.signal ?? controller.signal,
        }),
      );
    } catch (error) {
      if (timedOut) throw new TimeoutError(url);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildHeaders(
    url: string,
    options: RequestOptions,
    body: BodyInit | undefined,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'user-agent': this.userAgent,
      accept: 'application/json, text/plain, */*',
      ...this.defaultHeaders,
      ...options.headers,
    };

    const cookie = this.cookieJar.getCookieHeader(url);
    if (cookie) headers.cookie = cookie;

    if (body !== undefined && !(typeof FormData !== 'undefined' && body instanceof FormData)) {
      headers['content-type'] = options.form
        ? 'application/x-www-form-urlencoded'
        : 'application/json';
    }

    return headers;
  }

  private buildBody(options: RequestOptions): BodyInit | undefined {
    if (options.form) {
      return encodeForm(options.form);
    }
    if (options.body === undefined || options.body === null) {
      return undefined;
    }
    if (typeof options.body === 'string') return options.body;
    if (typeof FormData !== 'undefined' && options.body instanceof FormData) return options.body;
    return JSON.stringify(options.body);
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const base = /^https?:\/\//i.test(path) ? path : joinUrl(this.baseUrl, path);
    const queryString = query ? encodeQuery(query) : '';
    if (!queryString) return base;
    return base.includes('?') ? `${base}&${queryString}` : `${base}?${queryString}`;
  }

  private parseText<T>(text: string, responseType: 'json' | 'text', url: string): T {
    if (responseType === 'text') {
      return text as unknown as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new ParseError(`Failed to parse JSON response from ${url}`, error);
    }
  }

  private nextDelay(attempt: number): number {
    return computeBackoffDelay(attempt, this.backoff);
  }
}

function joinUrl(base: string | undefined, path: string): string {
  if (!base) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function encodeQuery(query: NonNullable<RequestOptions['query']>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    }
  }
  return parts.join('&');
}

function encodeForm(form: Record<string, string>): string {
  return Object.entries(form)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function getSetCookie(response: Response): string[] | undefined {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : undefined;
}

async function safeText(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}
