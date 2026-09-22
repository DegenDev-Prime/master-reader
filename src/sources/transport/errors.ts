export type SourceErrorCode =
  | 'network'
  | 'timeout'
  | 'http'
  | 'rate_limit'
  | 'not_found'
  | 'parse'
  | 'not_authenticated'
  | 'offline'
  | 'unknown';

export type SourceErrorOptions = {
  code?: SourceErrorCode;
  originalError?: unknown;
};

/** Base error for anything that goes wrong while talking to a source. */
export class SourceError extends Error {
  readonly code: SourceErrorCode;
  readonly originalError?: unknown;

  constructor(message: string, options: SourceErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.code = options.code ?? 'unknown';
    this.originalError = options.originalError;
  }
}

export class HttpError extends SourceError {
  readonly status: number;
  readonly url: string;
  readonly body?: string;

  constructor(
    message: string,
    options: SourceErrorOptions & { status: number; url: string; body?: string },
  ) {
    super(message, { ...options, code: options.code ?? 'http' });
    this.status = options.status;
    this.url = options.url;
    this.body = options.body;
  }
}

export class NotFoundError extends HttpError {
  constructor(options: SourceErrorOptions & { url: string; body?: string }) {
    super('Resource not found', { ...options, status: 404, code: 'not_found' });
  }
}

export class RateLimitError extends HttpError {
  readonly retryAfterMs?: number;

  constructor(options: SourceErrorOptions & { url: string; body?: string; retryAfterMs?: number }) {
    super('Rate limited by source', { ...options, status: 429, code: 'rate_limit' });
    this.retryAfterMs = options.retryAfterMs;
  }
}

export class TimeoutError extends SourceError {
  constructor(url: string) {
    super(`Request timed out: ${url}`, { code: 'timeout' });
  }
}

export class ParseError extends SourceError {
  constructor(message: string, originalError?: unknown) {
    super(message, { code: 'parse', originalError });
  }
}

export class NotAuthenticatedError extends SourceError {
  constructor(message = 'Log in to use this feature', originalError?: unknown) {
    super(message, { code: 'not_authenticated', originalError });
  }
}

export class OfflineError extends SourceError {
  constructor(message = 'You are offline and this content is not cached', originalError?: unknown) {
    super(message, { code: 'offline', originalError });
  }
}
