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

import { mapWithConcurrency } from '@/utils/html-parse';

import {
  ARCHIVE_MAX_CREATOR_POSTS,
  ARCHIVE_PAGE_SIZE,
  archiveStoryId,
  avatarUrl as archiveAvatarUrl,
  creatorPostsPath,
  creatorProfilePath,
  parseCreator,
  parsePost,
  postPath,
  postsFromPayload,
  recentPostsQuery,
  thumbnailUrl as archiveThumbnailUrl,
  unwrapPostPayload,
  type ArchiveCreator,
  type ArchivePost,
  type ArchiveVariant,
} from './protocol';

export type ArchiveFetch = (
  path: string,
  query?: Record<string, string | number>,
) => Promise<unknown>;

/**
 * How long a creator's post list stays cached. The story screen and the
 * chapter list ask for the same list, so caching it turns a walk of every
 * page into one walk.
 */
const POST_CACHE_MS = 5 * 60_000;

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

  get thumbnailBase(): string | null {
    return this.variant.thumbnailBase;
  }

  /** Recent posts across the whole archive, newest first. */
  async recentPosts(
    offset: number,
    query?: string,
  ): Promise<{ posts: ArchivePost[]; count: number; total: number | null }> {
    const payload = await this.fetchJson('/posts', recentPostsQuery(offset, query));
    const raw = postsFromPayload(payload);
    const posts = raw.map(parsePost).filter((post): post is ArchivePost => post !== null);

    const record =
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
    const count = typeof record?.count === 'number' ? record.count : posts.length;
    const total = typeof record?.true_count === 'number' ? record.true_count : null;

    return { posts, count, total };
  }

  async creatorProfile(service: string, creatorId: string): Promise<ArchiveCreator | null> {
    const key = archiveStoryId(service, creatorId);
    const cached = this.profileCache.get(key);
    if (cached !== undefined) return cached;

    const profile = parseCreator(await this.fetchJson(creatorProfilePath(service, creatorId)));
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
      const key = archiveStoryId(ref.service, ref.creatorId);
      if (this.profileCache.has(key)) return false;
      return !resolved.has(key);
    });

    if (pending.length === 0) {
      for (const ref of refs) {
        const key = archiveStoryId(ref.service, ref.creatorId);
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
      const key = archiveStoryId(ref.service, ref.creatorId);
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
    const key = archiveStoryId(service, creatorId);
    const cached = this.postCache.get(key);
    if (cached && Date.now() - cached.at < POST_CACHE_MS) {
      return options.maxPosts ? cached.posts.slice(0, options.maxPosts) : cached.posts;
    }

    const maxPosts = options.maxPosts ?? ARCHIVE_MAX_CREATOR_POSTS;
    const posts: ArchivePost[] = [];
    const seen = new Set<string>();
    const path = creatorPostsPath(service, creatorId, this.variant.creatorPostsSuffix);

    for (let offset = 0; offset < maxPosts; offset += ARCHIVE_PAGE_SIZE) {
      const payload = await this.fetchJson(path, { o: offset });
      const page = postsFromPayload(payload)
        .map(parsePost)
        .filter((post): post is ArchivePost => post !== null);
      if (page.length === 0) break;

      for (const post of page) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        posts.push(post);
      }

      // A short page is the last one.
      if (page.length < ARCHIVE_PAGE_SIZE) break;
    }

    this.postCache.set(key, { posts, at: Date.now() });
    return posts;
  }

  async post(service: string, creatorId: string, postId: string): Promise<ArchivePost | null> {
    const payload = await this.fetchJson(postPath(service, creatorId, postId));
    return parsePost(unwrapPostPayload(payload, this.variant.wrapsPost));
  }

  /** Thumbnail URL for a stored file. */
  thumbnailUrl(path: string | null | undefined): string | null {
    return archiveThumbnailUrl(this.variant.thumbnailBase, path);
  }

  /** Avatar URL for a creator. */
  avatarUrl(service: string, creatorId: string): string {
    return archiveAvatarUrl(this.variant.siteBase, service, creatorId);
  }
}
