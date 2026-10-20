/**
 * Shared client for the creator archives (Pawchive, Kemono).
 *
 * Both sites archive creator posts and expose a JSON API. A creator is the
 * reader's "story" and a post is its "chapter", so the client speaks in those
 * terms and hides the archive's own vocabulary.
 *
 * Both APIs refuse requests that look like a browser's default JSON fetch and
 * only answer when the request asks for `text/css`; the body is still JSON.
 * That quirk is handled here so the sources stay plain.
 */

import { decodeHtmlEntities } from '@/utils/html';
import { mapWithConcurrency } from '@/utils/html-parse';

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

export type ArchiveFetch = (
  path: string,
  query?: Record<string, string | number>,
) => Promise<unknown>;

/** Posts per page, as served by both archives. */
export const PAGE_SIZE = 50;

/**
 * Upper bound on the posts fetched for one creator. A creator with a very
 * long history would otherwise cost an unbounded number of requests, and the
 * reader only needs the most recent chapters to be navigable.
 */
export const MAX_CREATOR_POSTS = 2_000;

/**
 * How long a creator's post list stays cached. The story screen and the
 * chapter list ask for the same list, so caching it turns a walk of every
 * page into one walk.
 */
const POST_CACHE_MS = 5 * 60_000;

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

/** Pawchive answers with a bare array; Kemono wraps them in an object. */
function postsOf(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.posts)) return record.posts;
    if (Array.isArray(record.items)) return record.items;
  }
  return [];
}

export class ArchiveClient {
  /** Creator profiles already resolved, so a listing never refetches one. */
  private readonly profileCache = new Map<string, ArchiveCreator | null>();
  /** A creator's post list, kept briefly so a screen fetches it once. */
  private readonly postCache = new Map<string, { posts: ArchivePost[]; at: number }>();

  constructor(
    private readonly variant: ArchiveVariant,
    private readonly fetchJson: ArchiveFetch,
  ) {}

  get apiBase(): string {
    return this.variant.apiBase;
  }

  get siteBase(): string {
    return this.variant.siteBase;
  }

  /** Recent posts across the whole archive, newest first. */
  async recentPosts(
    offset: number,
    query?: string,
  ): Promise<{ posts: ArchivePost[]; count: number; total: number | null }> {
    const payload = await this.fetchJson('/posts', {
      o: offset,
      ...(query ? { q: query } : {}),
    });
    const raw = postsOf(payload);
    const posts = raw.map(parsePost).filter((post): post is ArchivePost => post !== null);

    const record =
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
    const count = typeof record?.count === 'number' ? record.count : posts.length;
    const total = typeof record?.true_count === 'number' ? record.true_count : null;

    return { posts, count, total };
  }

  async creatorProfile(service: string, creatorId: string): Promise<ArchiveCreator | null> {
    const key = `${service}:${creatorId}`;
    const cached = this.profileCache.get(key);
    if (cached !== undefined) return cached;

    const profile = parseCreator(await this.fetchJson(`/${service}/user/${creatorId}/profile`));
    this.profileCache.set(key, profile);
    return profile;
  }

  /**
   * Resolves several creator profiles at once. A listing only knows the
   * creator ids the feed mentioned, so the names have to be fetched before the
   * rows can be shown.
   */
  async resolveProfiles(
    refs: readonly { service: string; creatorId: string }[],
  ): Promise<Map<string, ArchiveCreator>> {
    const resolved = new Map<string, ArchiveCreator>();
    const pending = refs.filter((ref) => {
      const key = `${ref.service}:${ref.creatorId}`;
      if (this.profileCache.has(key)) return false;
      return !resolved.has(key);
    });

    if (pending.length === 0) {
      for (const ref of refs) {
        const key = `${ref.service}:${ref.creatorId}`;
        const cached = this.profileCache.get(key);
        if (cached) resolved.set(key, cached);
      }
      return resolved;
    }

    const profiles = await mapWithConcurrency(pending, 6, async (ref) => {
      try {
        return await this.creatorProfile(ref.service, ref.creatorId);
      } catch {
        return null;
      }
    });

    pending.forEach((ref, index) => {
      const key = `${ref.service}:${ref.creatorId}`;
      const profile = profiles[index];
      if (profile) resolved.set(key, profile);
    });

    return resolved;
  }

  /**
   * The posts of one creator, newest first.
   *
   * The archive serves a page of posts at a time and reports no total, so the
   * pages are walked until one comes back short. A creator with a long history
   * therefore costs several requests, but the chapter list is complete.
   */
  async creatorPosts(
    service: string,
    creatorId: string,
    options: { maxPosts?: number } = {},
  ): Promise<ArchivePost[]> {
    const key = `${service}:${creatorId}`;
    const cached = this.postCache.get(key);
    if (cached && Date.now() - cached.at < POST_CACHE_MS) {
      return options.maxPosts ? cached.posts.slice(0, options.maxPosts) : cached.posts;
    }

    const maxPosts = options.maxPosts ?? MAX_CREATOR_POSTS;
    const posts: ArchivePost[] = [];
    const seen = new Set<string>();

    for (let offset = 0; offset < maxPosts; offset += PAGE_SIZE) {
      const payload = await this.fetchJson(
        `/${service}/user/${creatorId}${this.variant.creatorPostsSuffix}`,
        { o: offset },
      );
      const page = postsOf(payload)
        .map(parsePost)
        .filter((post): post is ArchivePost => post !== null);
      if (page.length === 0) break;

      for (const post of page) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        posts.push(post);
      }

      // A short page is the last one.
      if (page.length < PAGE_SIZE) break;
    }

    this.postCache.set(key, { posts, at: Date.now() });
    return posts;
  }

  async post(service: string, creatorId: string, postId: string): Promise<ArchivePost | null> {
    const payload = await this.fetchJson(`/${service}/user/${creatorId}/post/${postId}`);
    const unwrapped = this.variant.wrapsPost
      ? typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>).post
        : null
      : payload;
    return parsePost(unwrapped);
  }

  /** Thumbnail URL for a stored file. */
  thumbnailUrl(path: string | null | undefined): string | null {
    if (!path || !this.variant.thumbnailBase) return null;
    return `${this.variant.thumbnailBase}/data${path}`;
  }

  /** Avatar URL for a creator. */
  avatarUrl(service: string, creatorId: string): string {
    return `${this.variant.siteBase}/icons/${service}/${creatorId}`;
  }
}
