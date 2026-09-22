import { nowSeconds } from '@/utils/time';

export type CookieRecord = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  /** unix seconds; undefined means a session cookie. */
  expires?: number;
};

/**
 * Minimal cookie store for source sessions. Cookies are keyed by name so a
 * single-domain source behaves predictably; domain, when present, is used to
 * filter which cookies are sent for a host.
 */
export class CookieJar {
  private readonly cookies = new Map<string, CookieRecord>();

  get size(): number {
    return this.cookies.size;
  }

  clear(): void {
    this.cookies.clear();
  }

  setFromResponse(url: string, setCookieHeaders: string | string[] | undefined): void {
    if (!setCookieHeaders) return;
    const headers = Array.isArray(setCookieHeaders)
      ? setCookieHeaders
      : splitCombined(setCookieHeaders);
    const host = hostOf(url);

    for (const header of headers) {
      const cookie = parseSetCookie(header, host);
      if (cookie) this.cookies.set(cookie.name, cookie);
    }
  }

  set(cookie: CookieRecord): void {
    this.cookies.set(cookie.name, cookie);
  }

  getCookieHeader(url: string): string | undefined {
    const host = hostOf(url);
    const now = nowSeconds();
    const parts: string[] = [];

    for (const cookie of this.cookies.values()) {
      if (cookie.expires !== undefined && cookie.expires <= now) {
        this.cookies.delete(cookie.name);
        continue;
      }
      if (!cookie.domain || matchesDomain(host, cookie.domain)) {
        parts.push(`${cookie.name}=${cookie.value}`);
      }
    }

    return parts.length > 0 ? parts.join('; ') : undefined;
  }

  toJSON(): CookieRecord[] {
    return [...this.cookies.values()];
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function matchesDomain(host: string, domain: string): boolean {
  const normalized = domain.startsWith('.') ? domain.slice(1) : domain;
  return host === normalized || host.endsWith(`.${normalized}`);
}

function parseSetCookie(header: string, defaultDomain: string): CookieRecord | null {
  const [pair, ...attributes] = header.split(';');
  const separator = pair.indexOf('=');
  if (separator === -1) return null;

  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1).trim();
  if (!name) return null;

  const cookie: CookieRecord = { name, value };

  for (const attribute of attributes) {
    const [rawKey, rawValue] = attribute.split('=');
    const key = rawKey.trim().toLowerCase();
    const attrValue = rawValue?.trim();

    if (key === 'domain' && attrValue) {
      cookie.domain = attrValue;
    } else if (key === 'path' && attrValue) {
      cookie.path = attrValue;
    } else if (key === 'max-age' && attrValue) {
      const seconds = Number(attrValue);
      if (Number.isFinite(seconds)) cookie.expires = nowSeconds() + seconds;
    } else if (key === 'expires' && attrValue) {
      const parsed = Date.parse(attrValue);
      if (!Number.isNaN(parsed)) cookie.expires = Math.floor(parsed / 1000);
    }
  }

  if (!cookie.domain) cookie.domain = defaultDomain;
  return cookie;
}

/** Best-effort split for runtimes that expose Set-Cookie as a single string. */
function splitCombined(value: string): string[] {
  return value.split(/,(?=[^;,]+=)/g);
}
