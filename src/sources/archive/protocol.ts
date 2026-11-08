/**
 * Creator archives (Kemono and Pawchive) share one model: a creator is the
 * library unit and each post is a chapter. Routes need both the platform
 * (`service`) and the creator id, so the library id carries both.
 *
 * Protocol:
 * - recent posts:    GET /posts?o={offset}&q={query}          (50 per page)
 * - creator posts:   GET /{service}/user/{id}{suffix}?o=…     (50 per page, newest first)
 * - creator profile: GET /{service}/user/{id}/profile
 * - chapter text:    GET /{service}/user/{id}/post/{postId}
 *
 * Kemono differs from Pawchive only in its variant config: creator post lists
 * end in `/posts`, a single post is wrapped in `{ post }`, and it has no
 * separate thumbnail host.
 */

import { decodeHtmlEntities } from '@/utils/html';

import type { ChapterRef } from '../types';

export type ArchiveCreator = {
  id: string;
  name: string;
  publicId: string | null;
  service: string;
  /** unix seconds */
  indexed: number | null;
  /** unix seconds */
  updated: number | null;
  favorited: number | null;
};

export type ArchiveAttachment = {
  name: string;
  path: string;
  /** True when the archive only stored a downscaled copy. */
  previewOnly: boolean;
};

export type ArchivePost = {
  id: string;
  creatorId: string;
  service: string;
  title: string;
  /** Post body as HTML. */
  content: string | null;
  /** Short preview of the body, used in listings. */
  subtitle: string | null;
  /** unix seconds */
  published: number | null;
  file: ArchiveAttachment | null;
  attachments: ArchiveAttachment[];
};

/** How one archive differs from the other. */
export type ArchiveVariant = {
  /** API root, e.g. `https://pawchive.pw/api/v1`. */
  apiBase: string;
  /** Site root, used for creator images. */
  siteBase: string;
  /** Thumbnail host; `null` when the archive serves no images. */
  thumbnailBase: string | null;
  /** Kemono appends `/posts` to a creator's post list. */
  creatorPostsSuffix: string;
  /** Kemono wraps a single post in `{ post: … }`. */
  wrapsPost: boolean;
};

export type ArchiveCreatorRef = {
  service: string;
  creatorId: string;
  /** Newest post seen for this creator; used for the listing subtitle. */
  post: ArchivePost;
};

/** Posts per page, as served by both archives. */
export const ARCHIVE_PAGE_SIZE = 50;

/**
 * Upper bound on the posts fetched for one creator. A creator with a very
 * long history would otherwise cost an unbounded number of requests, and the
 * reader only needs the most recent chapters to be navigable.
 */
export const ARCHIVE_MAX_CREATOR_POSTS = 2_000;

export function archiveStoryId(service: string, creatorId: string): string {
  return `${service}:${creatorId}`;
}

export function parseArchiveStoryId(id: string): { service: string; creatorId: string } | null {
  const index = id.indexOf(':');
  if (index <= 0 || index === id.length - 1) return null;
  return { service: id.slice(0, index), creatorId: id.slice(index + 1) };
}

export function recentPostsQuery(offset: number, query?: string): Record<string, string | number> {
  return { o: offset, ...(query ? { q: query } : {}) };
}

export function creatorPostsPath(service: string, creatorId: string, suffix: string): string {
  return `/${service}/user/${creatorId}${suffix}`;
}

export function creatorProfilePath(service: string, creatorId: string): string {
  return `/${service}/user/${creatorId}/profile`;
}

export function postPath(service: string, creatorId: string, postId: string): string {
  return `/${service}/user/${creatorId}/post/${postId}`;
}

export function creatorUrl(siteBase: string, service: string, creatorId: string): string {
  return `${siteBase}/artists/${service}/${creatorId}`;
}

export function postUrl(
  siteBase: string,
  service: string,
  creatorId: string,
  postId: string,
): string {
  return `${siteBase}/${service}/${creatorId}/post/${postId}`;
}

export function avatarUrl(siteBase: string, service: string, creatorId: string): string {
  return `${siteBase}/icons/${service}/${creatorId}`;
}

export function thumbnailUrl(
  thumbnailBase: string | null,
  path: string | null | undefined,
): string | null {
  if (!path || !thumbnailBase) return null;
  return `${thumbnailBase}/data${path}`;
}

/** Pawchive answers with a bare array; Kemono wraps them in an object. */
export function postsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.posts)) return record.posts;
    if (Array.isArray(record.items)) return record.items;
  }
  return [];
}

export function unwrapPostPayload(payload: unknown, wrapsPost: boolean): unknown {
  if (!wrapsPost) return payload;
  if (typeof payload !== 'object' || payload === null) return null;
  return (payload as Record<string, unknown>).post;
}

function toSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function toAttachment(value: unknown): ArchiveAttachment | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const path = typeof record.path === 'string' ? record.path : null;
  if (!path) return null;
  return {
    name: typeof record.name === 'string' ? record.name : '',
    path,
    previewOnly: record.preview_only === true,
  };
}

export function parseCreator(value: unknown): ArchiveCreator | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  if (!id) return null;
  return {
    id,
    name: typeof record.name === 'string' && record.name.trim() ? record.name : id,
    publicId: typeof record.public_id === 'string' ? record.public_id : null,
    service: typeof record.service === 'string' ? record.service : 'unknown',
    indexed: toSeconds(record.indexed),
    updated: toSeconds(record.updated),
    favorited: typeof record.favorited === 'number' ? record.favorited : null,
  };
}

export function parsePost(value: unknown): ArchivePost | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  if (!id) return null;

  const attachments = Array.isArray(record.attachments)
    ? record.attachments
        .map(toAttachment)
        .filter((item): item is ArchiveAttachment => item !== null)
    : [];

  return {
    id,
    creatorId: typeof record.user === 'string' ? record.user : '',
    service: typeof record.service === 'string' ? record.service : 'unknown',
    // Titles carry entities for non-latin scripts; the reader shows plain text.
    title: typeof record.title === 'string' ? decodeHtmlEntities(record.title).trim() : '',
    content: typeof record.content === 'string' ? record.content : null,
    subtitle: typeof record.substring === 'string' ? record.substring : null,
    published: toSeconds(record.published),
    file: toAttachment(record.file),
    attachments,
  };
}

/**
 * The feed lists posts, but the library is organised by creator. Posts of the
 * same creator collapse into one story, in the feed's order.
 */
export function collapseCreators(posts: readonly ArchivePost[]): ArchiveCreatorRef[] {
  const seen = new Set<string>();
  const creators: ArchiveCreatorRef[] = [];

  for (const post of posts) {
    const key = archiveStoryId(post.service, post.creatorId);
    if (seen.has(key)) continue;
    seen.add(key);
    creators.push({ service: post.service, creatorId: post.creatorId, post });
  }

  return creators;
}

/**
 * The archive serves posts newest first; readers expect the oldest post first.
 * The archive's own order is the tie-breaker, because a post may carry no date
 * at all, so the list is reversed rather than re-sorted.
 */
export function postsInReadingOrder(posts: readonly ArchivePost[]): ArchivePost[] {
  return [...posts].reverse();
}

export function chaptersOf(
  posts: readonly ArchivePost[],
  siteBase: string,
  creatorId: string,
): ChapterRef[] {
  return postsInReadingOrder(posts).map((post, index) => ({
    id: post.id,
    index,
    // A post without a title is still a chapter; the reader numbers it.
    title: post.title,
    url: postUrl(siteBase, post.service, creatorId, post.id),
    publishedAt: post.published,
  }));
}

/** Strips the archive's markup down to the text a listing row shows. */
export function postSubtitle(post: ArchivePost): string | null {
  const source = post.subtitle ?? post.content;
  if (!source) return null;
  const text = source
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0 ? text : null;
}

/**
 * Builds the chapter body of a post: its own text, then the images it carries.
 * The reader renders HTML blocks, so images become plain `<img>` tags pointing
 * at the archive's thumbnail host.
 */
export function postHtml(
  post: Pick<ArchivePost, 'content' | 'file' | 'attachments'>,
  thumbnailBase: string | null,
): string {
  const parts: string[] = [];
  const body = post.content?.trim();
  if (body) parts.push(body);

  const images = [post.file, ...post.attachments].filter(
    (item): item is ArchiveAttachment => item !== null,
  );
  for (const image of images) {
    const url = thumbnailUrl(thumbnailBase, image.path);
    if (!url) continue;
    const alt = image.name ? ` alt="${image.name.replace(/"/g, '')}"` : '';
    parts.push(`<figure><img src="${url}"${alt}/></figure>`);
  }

  return parts.join('');
}
