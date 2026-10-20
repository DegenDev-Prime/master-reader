import type { Story } from '@/models/story';

import type { PagedResult } from './types';

/** Clamps an untrusted page request to a positive integer. */
export function normalizePage(page?: number): number {
  if (!page || !Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

export function toPagedResult(
  items: Story[],
  page: number,
  hasNext: boolean,
  total?: number,
): PagedResult<Story> {
  return { items, page, hasNext, total };
}

/** Resolves a possibly-relative URL against a provider's base URL. */
export function absoluteUrl(baseUrl: string, path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('//')) return `https:${path}`;
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Parses a numeric string tolerating thousands separators; null when invalid. */
export function toNumberOrNull(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
