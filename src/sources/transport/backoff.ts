export type BackoffOptions = {
  baseMs?: number;
  maxMs?: number;
  factor?: number;
  /** 0..1 fraction of the delay that may be shaved off randomly. */
  jitterRatio?: number;
  random?: () => number;
};

const DEFAULTS = {
  baseMs: 500,
  maxMs: 30_000,
  factor: 2,
  jitterRatio: 0.25,
} as const;

/**
 * Exponential backoff with bounded jitter. `attempt` is 1-based (the delay
 * before the first retry).
 */
export function computeBackoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs, maxMs, factor, jitterRatio } = { ...DEFAULTS, ...options };
  const random = options.random ?? Math.random;
  const safeAttempt = Math.max(1, Math.floor(attempt));

  const raw = baseMs * factor ** (safeAttempt - 1);
  const capped = Math.min(maxMs, raw);
  const jitter = capped * jitterRatio * random();

  return Math.max(0, Math.round(capped - jitter));
}

/**
 * Parses a Retry-After header (seconds or HTTP date) into milliseconds relative
 * to `nowMs`. Returns undefined when the header is absent or unparseable.
 */
export function parseRetryAfter(
  header: string | null | undefined,
  nowMs = Date.now(),
): number | undefined {
  if (!header) return undefined;

  const seconds = Number(header.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);

  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - nowMs);

  return undefined;
}
