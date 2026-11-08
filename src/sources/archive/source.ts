import type { Story } from '@/models/story';

import { normalizePage, toPagedResult } from '../provider-utils';
import { NotFoundError } from '../transport';
import type {
  Category,
  ChapterRef,
  PageRequest,
  PagedResult,
  SearchFilters,
  Source,
  SourceInfo,
  StoryDetails,
} from '../types';
import { ArchiveClient, type ArchiveFetch } from './client';
import {
  ARCHIVE_PAGE_SIZE,
  archiveStoryId,
  chaptersOf,
  collapseCreators,
  creatorUrl,
  parseArchiveStoryId,
  postHtml,
  postSubtitle,
  type ArchiveCreator,
  type ArchivePost,
  type ArchiveVariant,
} from './protocol';

export type ArchiveSourceOptions = {
  variant: ArchiveVariant;
  fetchJson: ArchiveFetch;
  info: SourceInfo;
  /** Page size used for listings. */
  pageSize?: number;
  /** Services offered as categories, e.g. `patreon`. */
  services?: string[];
};

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
    this.pageSize = options.pageSize ?? ARCHIVE_PAGE_SIZE;
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

  async getStory(id: string): Promise<StoryDetails | null> {
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

    return this.creatorToStory(creator, posts[0]);
  }

  async getChapterList(storyId: string): Promise<ChapterRef[]> {
    const parsed = parseArchiveStoryId(storyId);
    if (!parsed) return [];
    const posts = await this.client.creatorPosts(parsed.service, parsed.creatorId);
    return chaptersOf(posts, this.client.siteBase, parsed.creatorId);
  }

  async getChapterContent(storyId: string, chapterId: string): Promise<string | null> {
    const parsed = parseArchiveStoryId(storyId);
    if (!parsed) return null;
    const post = await this.client.post(parsed.service, parsed.creatorId, chapterId);
    if (!post) return null;
    const html = postHtml(post, this.client.thumbnailBase);
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
      description: latest ? postSubtitle(latest) : null,
      coverUrl: this.client.avatarUrl(creator.service, creator.id),
      rating: null,
      views: creator.favorited,
      url: creatorUrl(this.client.siteBase, creator.service, creator.id),
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
    const creators = collapseCreators(posts);
    const profiles = await this.client.resolveProfiles(creators);

    return creators.map(({ service, creatorId, post }) => {
      const profile = profiles.get(archiveStoryId(service, creatorId));
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
