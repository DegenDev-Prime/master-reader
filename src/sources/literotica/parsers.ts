import type { Story, StoryPage, StorySeries } from '@/models/story';
import { decodeHtmlEntities } from '@/utils/html';

import { ParseError } from '../transport';
import type { Category } from '../types';
import {
  constantsSchema,
  tagListSchema,
  v1ListResponseSchema,
  v1StorySchema,
  v2PagesResponseSchema,
  v3SearchResponseSchema,
  v3StoryResponseSchema,
  v3TagPortalResponseSchema,
  v3StorySchema,
  type Constants,
  type Tag,
  type V1Story,
  type V2Page,
  type V3Series,
  type V3SeriesItem,
  type V3Story,
} from './schemas';

// ---------------------------------------------------------------------------
// Scalar normalisation
// ---------------------------------------------------------------------------

export function parseId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['yes', 'true', '1', 'y'].includes(normalized)) return true;
    if (['no', 'false', '0', 'n'].includes(normalized)) return false;
  }
  return null;
}

export { decodeHtmlEntities } from '@/utils/html';

export function parsePublishedAt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e11 ? Math.round(value / 1000) : Math.round(value);
  }
  if (typeof value === 'string') {
    const slashDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashDate) {
      const month = Number(slashDate[1]);
      const day = Number(slashDate[2]);
      const year = Number(slashDate[3]);
      const ms = Date.UTC(year, month - 1, day);
      return Number.isFinite(ms) ? Math.round(ms / 1000) : null;
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return Math.round(parsed / 1000);
  }
  return null;
}

export function normalizeStoryUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value.includes('//')) {
    return /^https?:\/\//i.test(value) ? value : `https:${value}`;
  }
  return `https://www.literotica.com/s/${value.replace(/^\/+/, '')}`;
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

type NormalizedStory = Omit<Story, 'sourceId' | 'flags'> & Story['flags'];

function buildStory(sourceId: string, input: NormalizedStory): Story {
  const { isNew, isHot, isWritersPick, isContestWinner, commentsEnabled, ratingEnabled, ...rest } =
    input;

  return {
    ...rest,
    sourceId,
    flags: { isNew, isHot, isWritersPick, isContestWinner, commentsEnabled, ratingEnabled },
  };
}

function authorFields(author: V1Story['user']) {
  return {
    authorId: parseId(author?.id ?? author?.user_id ?? author?.userid),
    authorName: author?.username ?? author?.name ?? author?.display_name ?? null,
  };
}

/**
 * Derives a readable label from a category page slug. The v3 API replaced the
 * `category_info.name` field with a `pageUrl` slug (e.g. `gay-sex-stories`).
 */
export function humanizeCategorySlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

type CategoryInfo = { name?: string; pageUrl?: string } | null | undefined;

export function categoryNameFromInfo(info: CategoryInfo): string | null {
  if (!info) return null;
  if (info.name) return decodeHtmlEntities(info.name);
  if (info.pageUrl) return humanizeCategorySlug(info.pageUrl);
  return null;
}

function v3CategoryName(raw: V3Story): string | null {
  return categoryNameFromInfo(raw.category_info);
}

/** Maps the v3 embedded `series` payload to the domain model. */
export function parseV3Series(
  series: V3Series | V3SeriesItem[] | null | undefined,
): StorySeries | null {
  if (!series || Array.isArray(series)) return null;

  const items = series.items ?? [];
  const id = parseId(series.meta?.id);
  if (!id || items.length === 0) return null;

  return {
    id,
    title: series.meta?.title ?? '',
    items: items
      .map((item) => ({
        id: parseId(item.id) ?? '',
        title: item.title,
        url: normalizeStoryUrl(item.url),
        categoryId: parseId(item.category),
        categoryName: categoryNameFromInfo(item.category_info),
      }))
      .filter((item) => item.id.length > 0),
  };
}

/**
 * Splits a full-text story into roughly equal pages. The API returns the whole
 * story in `pageText`; `pages_count` reflects the site's own pagination.
 */
export function splitIntoPages(text: string, pageCount: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const count = Math.max(1, Math.min(Math.trunc(pageCount), 100));
  if (count === 1) return [trimmed];

  const paragraphs = trimmed
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length <= count) return paragraphs.length > 0 ? paragraphs : [trimmed];

  const target = trimmed.length / count;
  const pages: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > target && pages.length < count - 1) {
      pages.push(current);
      current = '';
    }
    current += (current ? '\n\n' : '') + paragraph;
  }
  if (current) pages.push(current);

  return pages;
}

export function fromV1Story(sourceId: string, raw: V1Story): Story {
  return buildStory(sourceId, {
    id: parseId(raw.id) ?? '',
    title: decodeHtmlEntities(raw.name),
    description: raw.description ? decodeHtmlEntities(raw.description) : null,
    categoryId: parseId(raw.category?.id),
    categoryName: raw.category?.name ? decodeHtmlEntities(raw.category.name) : null,
    lang: parseId(raw.lang),
    url: normalizeStoryUrl(raw.url),
    rating: toNumber(raw.rate),
    views: toNumber(raw.view_count),
    publishedAt: parsePublishedAt(raw.timestamp_published),
    tags: [],
    raw,
    ...authorFields(raw.user),
    isNew: toBoolean(raw.is_new),
    isHot: toBoolean(raw.is_hot),
    isWritersPick: toBoolean(raw.writers_pick),
    isContestWinner: toBoolean(raw.contest_winner),
    commentsEnabled: toBoolean(raw.enable_comments),
    ratingEnabled: toBoolean(raw.allow_vote),
  });
}

export function fromV3Story(sourceId: string, raw: V3Story): Story {
  return buildStory(sourceId, {
    id: parseId(raw.id) ?? '',
    title: decodeHtmlEntities(raw.title),
    description: raw.description ? decodeHtmlEntities(raw.description) : null,
    categoryId: parseId(raw.category),
    categoryName: v3CategoryName(raw),
    lang: parseId(raw.language),
    url: normalizeStoryUrl(raw.url),
    rating: toNumber(raw.rate_all),
    views: toNumber(raw.view_count),
    publishedAt: parsePublishedAt(raw.date_approve),
    tags: [],
    raw,
    ...authorFields(raw.author),
    isNew: toBoolean(raw.is_new),
    isHot: toBoolean(raw.is_hot),
    isWritersPick: toBoolean(raw.writers_pick),
    isContestWinner: toBoolean(raw.contest_winner),
    commentsEnabled: toBoolean(raw.enable_comments),
    ratingEnabled: toBoolean(raw.allow_vote),
  });
}

function parseOrThrow<T>(
  result: { success: true; data: T } | { success: false; error: unknown },
  context: string,
): T {
  if (result.success) return result.data;
  const detail =
    result.error && typeof result.error === 'object' && 'issues' in result.error
      ? JSON.stringify((result.error as { issues: unknown }).issues)
      : String(result.error);
  throw new ParseError(`Malformed ${context} response: ${detail}`, result.error);
}

export function parseV1List(
  sourceId: string,
  payload: unknown,
): { stories: Story[]; total: number | null } {
  const data = parseOrThrow(v1ListResponseSchema.safeParse(payload), 'v1 list');
  const stories = (data.submissions ?? []).map((item) => fromV1Story(sourceId, item));
  return { stories, total: toNumber(data.total) };
}

export function parseV3List(
  sourceId: string,
  payload: unknown,
): { stories: Story[]; total: number | null } {
  const data = parseOrThrow(v3SearchResponseSchema.safeParse(payload), 'v3 search');
  const stories = (data.data ?? []).map((item) => fromV3Story(sourceId, item));
  return { stories, total: toNumber(data.meta?.total ?? data.meta?.submissions_count) };
}

export function parseV3TagStories(
  sourceId: string,
  payload: unknown,
): { stories: Story[]; total: number | null } {
  const data = parseOrThrow(v3TagPortalResponseSchema.safeParse(payload), 'tag portal');
  const stories = (data.submissions ?? []).map((item) => fromV3Story(sourceId, item));
  return {
    stories,
    total: toNumber(data.meta?.submissions_count ?? data.meta?.total),
  };
}

/** Parses `3/stories/{id}` into a story, its pages and optional series. */
export function parseV3Story(
  sourceId: string,
  payload: unknown,
): { story: Story; pages: StoryPage[]; series: StorySeries | null } {
  const data = parseOrThrow(v3StoryResponseSchema.safeParse(payload), 'v3 story');
  const base = fromV3Story(sourceId, data.submission);
  const series = parseV3Series(data.submission.series);
  const position = series?.items.findIndex((item) => item.id === base.id) ?? -1;

  const story: Story = series
    ? {
        ...base,
        seriesId: series.id,
        seriesTitle: series.title,
        seriesPosition: position >= 0 ? position : null,
      }
    : base;

  const pageCount = toNumber(data.meta?.pages_count) ?? 1;

  const pages = splitIntoPages(data.pageText ?? '', pageCount).map((content, index) => ({
    sourceId,
    storyId: story.id,
    index,
    title: null,
    content,
  }));

  return { story, pages, series };
}

function tagsFromPage(page: V2Page): string[] {
  if (!page.tags) return [];
  return page.tags
    .slice()
    .sort((a, b) => (toNumber(b.submission_count) ?? 0) - (toNumber(a.submission_count) ?? 0))
    .map((tag) => tag.name);
}

export function parseStoryDetails(
  sourceId: string,
  payload: unknown,
): {
  story: Story;
  pages: StoryPage[];
  seriesId: string | null;
} | null {
  const data = parseOrThrow(v2PagesResponseSchema.safeParse(payload), 'story pages');
  const rawPages = data.pages ?? [];
  if (rawPages.length === 0) return null;

  const first = rawPages[0];
  const id = parseId(first.submission_id) ?? '';
  const pages: StoryPage[] = rawPages.map((page, index) => ({
    sourceId,
    storyId: id,
    index,
    title: decodeHtmlEntities(page.name),
    content: page.content ?? null,
  }));

  const story = buildStory(sourceId, {
    id,
    title: decodeHtmlEntities(first.name),
    description: null,
    categoryId: null,
    categoryName: null,
    lang: parseId(first.lang),
    url: normalizeStoryUrl(first.url),
    rating: null,
    views: null,
    publishedAt: null,
    tags: tagsFromPage(first),
    raw: payload,
    authorId: null,
    authorName: null,
    isNew: null,
    isHot: null,
    isWritersPick: null,
    isContestWinner: null,
    commentsEnabled: null,
    ratingEnabled: toBoolean(first.allow_vote),
  });

  return { story, pages, seriesId: parseId(first.series_id) };
}

export function parseTagList(payload: unknown): { id: string; name: string }[] {
  const data = parseOrThrow(tagListSchema.safeParse(payload), 'tag list');
  const tags: { id: string; name: string }[] = [];
  for (const tag of data) {
    const id = parseId(tag.id);
    const name = tag.name ?? tag.tag ?? tag.tag_name;
    if (id && name) tags.push({ id, name });
  }
  return tags;
}

export function parseConstants(payload: unknown): {
  categories: Category[];
  languages: Record<string, string>;
} {
  const data: Constants = parseOrThrow(constantsSchema.safeParse(payload), 'constants');

  const categories: Category[] = [];
  for (const entry of Object.values(data.categories ?? {})) {
    const id = parseId(entry.id);
    if (id && entry.name) categories.push({ id, name: decodeHtmlEntities(entry.name) });
  }
  categories.sort((a, b) => a.name.localeCompare(b.name));

  const languages: Record<string, string> = {};
  for (const entry of Object.values(data.languages ?? {})) {
    const id = parseId(entry.id);
    if (id) languages[id] = entry.shortname ?? entry.longname ?? id;
  }

  return { categories, languages };
}

export function validateV1Story(raw: unknown): V1Story {
  return parseOrThrow(v1StorySchema.safeParse(raw), 'v1 story');
}

export function validateV3Story(raw: unknown): V3Story {
  return parseOrThrow(v3StorySchema.safeParse(raw), 'v3 story');
}

export type { Tag };
