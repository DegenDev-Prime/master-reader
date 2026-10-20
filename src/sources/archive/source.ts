import type { Story, StoryPage } from '@/models/story';

import { normalizePage, toPagedResult } from '../provider-utils';
import { NotFoundError } from '../transport';
import type {
  Category,
  ChapterRef,
  GetStoryOptions,
  PageRequest,
  PagedResult,
  SearchFilters,
  Source,
  SourceInfo,
  StoryDetails,
} from '../types';
import {
  ArchiveClient,
  type ArchiveCreator,
  type ArchiveFetch,
  type ArchivePost,
  type ArchiveVariant,
} from './client';

export type ArchiveSourceOptions = {
  variant: ArchiveVariant;
  fetchJson: ArchiveFetch;
  info: SourceInfo;
  /** Page size used for listings. */
  pageSize?: number;
  /** Services offered as categories, e.g. `patreon`. */
  services?: string[];
};

const DEFAULT_PAGE_SIZE = 50;

/**
 * A creator is identified by its platform and id, because the archive's routes
 * need both. The two are joined with a dash that cannot appear in either.
 */
export function archiveStoryId(service: string, creatorId: string): string {
  return `${service}:${creatorId}`;
}

export function parseArchiveStoryId(id: string): { service: string; creatorId: string } | null {
  const index = id.indexOf(':');
  if (index <= 0 || index === id.length - 1) return null;
  return { service: id.slice(0, index), creatorId: id.slice(index + 1) };
}

/** Strips the archive's markup down to the text a listing row shows. */
function subtitleOf(post: ArchivePost): string | null {
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
 * Builds the chapter body of a post: its own text, then the images it
 * carries. The reader renders HTML blocks, so images become plain `<img>`
 * tags pointing at the archive's thumbnail host.
 */
function postHtml(post: ArchivePost, client: ArchiveClient): string {
  const parts: string[] = [];
  const body = post.content?.trim();
  if (body) parts.push(body);

  const images = [post.file, ...post.attachments].filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );
  for (const image of images) {
    const url = client.thumbnailUrl(image.path);
    if (!url) continue;
    const alt = image.name ? ` alt="${image.name.replace(/"/g, '')}"` : '';
    parts.push(`<figure><img src="${url}"${alt}/></figure>`);
  }

  return parts.join('');
}

/**
 * A source over a creator archive. Creators are browsable as stories and their
 * posts read as chapters; a listing is the archive's own recent-post feed,
 * collapsed so each creator appears once.
 */
export class ArchiveSource implements Source {
  readonly info: SourceInfo;

  private readonly client: ArchiveClient;
  private readonly pageSize: number;
  private readonly services: string[];

  constructor(options: ArchiveSourceOptions) {
    this.info = options.info;
    this.client = new ArchiveClient(options.variant, options.fetchJson);
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    this.services = options.services ?? [];
  }

  async getPopular(request: PageRequest = {}): Promise<PagedResult<Story>> {
    return this.listing(request);
  }

  async getLatest(request: PageRequest = {}): Promise<PagedResult<Story>> {
    return this.listing(request);
  }

  async search(filters: SearchFilters, request: PageRequest = {}): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const query = filters.query?.trim() ?? '';
    if (!query) return { items: [], page, hasNext: false, total: 0 };

    const { posts } = await this.client.recentPosts((page - 1) * this.pageSize, query);
    const stories = await this.postsToStories(posts);
    return toPagedResult(stories, page, posts.length >= this.pageSize);
  }

  async getStory(id: string, options: GetStoryOptions = {}): Promise<StoryDetails | null> {
    const includeContent = options.includeContent ?? true;
    const parsed = parseArchiveStoryId(id);
    if (!parsed) return null;

    const posts = await this.client.creatorPosts(parsed.service, parsed.creatorId);
    if (posts.length === 0) {
      throw new NotFoundError({ url: `${this.client.apiBase}/${id}` });
    }

    const profile = await this.client
      .creatorProfile(parsed.service, parsed.creatorId)
      .catch(() => null);
    const creator = profile ?? {
      id: parsed.creatorId,
      name: parsed.creatorId,
      publicId: null,
      service: parsed.service,
      indexed: null,
      updated: posts[0].published,
      favorited: null,
    };

    const story = this.creatorToStory(creator, posts[0]);
    if (!includeContent) return story;

    // The pages follow the chapter list's order, which is reading order.
    const pages: StoryPage[] = [...posts].reverse().map((post, index) => ({
      sourceId: this.info.id,
      storyId: id,
      index,
      title: post.title,
      id: post.id,
      content: null,
      wordCount: null,
    }));

    return { ...story, pages };
  }

  async getChapterList(storyId: string): Promise<ChapterRef[]> {
    const parsed = parseArchiveStoryId(storyId);
    if (!parsed) return [];
    const posts = await this.client.creatorPosts(parsed.service, parsed.creatorId);
    if (posts.length === 0) return [];

    // The archive serves posts newest first; readers expect the oldest post
    // first, so the list is reversed into reading order. The archive's own
    // order is the tie-breaker, because a post may carry no date at all.
    const ordered = [...posts].reverse();
    return ordered.map((post, index) => ({
      id: post.id,
      index,
      // A post without a title is still a chapter; the reader numbers it.
      title: post.title,
      url: `${this.client.siteBase}/${post.service}/${parsed.creatorId}/post/${post.id}`,
      publishedAt: post.published,
    }));
  }

  async getChapterContent(storyId: string, chapterId: string): Promise<string | null> {
    const parsed = parseArchiveStoryId(storyId);
    if (!parsed) return null;
    const post = await this.client.post(parsed.service, parsed.creatorId, chapterId);
    if (!post) return null;
    const html = postHtml(post, this.client);
    return html || null;
  }

  async getTags(): Promise<string[]> {
    return this.services;
  }

  async getCategories(): Promise<Category[]> {
    return this.services.map((service) => ({ id: service, name: service }));
  }

  isLoggedIn(): boolean {
    return false;
  }

  private creatorToStory(creator: ArchiveCreator, latest: ArchivePost | undefined): Story {
    return {
      sourceId: this.info.id,
      id: archiveStoryId(creator.service, creator.id),
      title: creator.name,
      authorName: creator.name,
      description: latest ? subtitleOf(latest) : null,
      coverUrl: this.client.avatarUrl(creator.service, creator.id),
      rating: null,
      views: creator.favorited,
      url: `${this.client.siteBase}/artists/${creator.service}/${creator.id}`,
      flags: {},
      tags: [creator.service],
      fetchedAt: Math.floor(Date.now() / 1000),
      raw: null,
    };
  }

  private async listing(request: PageRequest): Promise<PagedResult<Story>> {
    const page = normalizePage(request.page);
    const { posts, total } = await this.client.recentPosts((page - 1) * this.pageSize);
    const stories = await this.postsToStories(posts);
    // A full page means the archive may have more; a short one is the end.
    return toPagedResult(stories, page, posts.length >= this.pageSize, total ?? undefined);
  }

  /**
   * The feed lists posts, but the library is organised by creator. Posts of
   * the same creator collapse into one story, and the creator's name is
   * fetched so the row shows a name rather than an id.
   */
  private async postsToStories(posts: ArchivePost[]): Promise<Story[]> {
    const unique: { service: string; creatorId: string; post: ArchivePost }[] = [];
    const seen = new Set<string>();

    for (const post of posts) {
      const key = archiveStoryId(post.service, post.creatorId);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ service: post.service, creatorId: post.creatorId, post });
    }

    const profiles = await this.client.resolveProfiles(unique);

    return unique.map(({ service, creatorId, post }) => {
      const profile = profiles.get(`${service}:${creatorId}`);
      const creator: ArchiveCreator = profile ?? {
        id: creatorId,
        name: creatorId,
        publicId: null,
        service,
        indexed: null,
        updated: post.published,
        favorited: null,
      };
      return this.creatorToStory(creator, post);
    });
  }
}
