export type SourceOperation = 'listing' | 'search' | 'novel' | 'chapter-list' | 'chapter-content';

export type SourceErrorInit = {
  sourceId: string;
  operation: SourceOperation;
  url?: string;
  retryAfterMs?: number;
  cause?: unknown;
  message?: string;
};

export class SourceError extends Error {
  readonly sourceId: string;
  readonly operation: SourceOperation;
  readonly url?: string;
  readonly retryAfterMs?: number;
  override readonly cause?: unknown;

  constructor(name: string, init: SourceErrorInit) {
    super(init.message ?? name);
    this.name = name;
    this.sourceId = init.sourceId;
    this.operation = init.operation;
    this.url = init.url;
    this.retryAfterMs = init.retryAfterMs;
    this.cause = init.cause;
  }
}

export class SourceOfflineError extends SourceError {
  constructor(init: SourceErrorInit) {
    super('SourceOfflineError', {
      ...init,
      message: init.message ?? 'The source is unreachable while offline.',
    });
  }
}

export class SourceNotFoundError extends SourceError {
  constructor(init: SourceErrorInit) {
    super('SourceNotFoundError', {
      ...init,
      message: init.message ?? 'The requested novel or chapter no longer exists.',
    });
  }
}

export class SourceRateLimitedError extends SourceError {
  constructor(init: SourceErrorInit) {
    super('SourceRateLimitedError', {
      ...init,
      message: init.message ?? 'The source is rate limiting requests.',
    });
  }
}

export class SourceNeedsBrowserError extends SourceError {
  readonly reason: 'cloudflare' | 'js' | 'auth';

  constructor(init: SourceErrorInit & { reason: 'cloudflare' | 'js' | 'auth' }) {
    super('SourceNeedsBrowserError', {
      ...init,
      message: init.message ?? 'The source needs a browser session before it can be read.',
    });
    this.reason = init.reason;
  }
}

export class SourceParseError extends SourceError {
  readonly fixtureHash?: string;

  constructor(init: SourceErrorInit & { fixtureHash?: string }) {
    super('SourceParseError', {
      ...init,
      message: init.message ?? 'The source returned a page this app could not parse.',
    });
    this.fixtureHash = init.fixtureHash;
  }
}

export class SourceCancelledError extends SourceError {
  constructor(init: SourceErrorInit) {
    super('SourceCancelledError', { ...init, message: 'Request cancelled.' });
  }
}

export class SourceUnsupportedError extends SourceError {
  constructor(init: SourceErrorInit) {
    super('SourceUnsupportedError', {
      ...init,
      message: 'This source does not support that operation.',
    });
  }
}

export function isSourceError(value: unknown): value is SourceError {
  return value instanceof SourceError;
}

export function isCancellation(value: unknown): boolean {
  return (
    value instanceof SourceCancelledError || (value instanceof Error && value.name === 'AbortError')
  );
}
