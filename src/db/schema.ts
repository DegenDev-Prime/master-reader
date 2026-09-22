import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const unixNow = sql`(unixepoch())`;

/** Registered content sources. The app ships one built-in source; the table is future-proofing. */
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  lang: text('lang').notNull().default('en'),
  baseUrl: text('base_url').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  config: text('config', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at').notNull().default(unixNow),
  updatedAt: integer('updated_at').notNull().default(unixNow),
});

export const authors = sqliteTable(
  'authors',
  {
    sourceId: text('source_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    url: text('url'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    following: integer('following', { mode: 'boolean' }),
    fetchedAt: integer('fetched_at'),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.id] }), index('authors_name_idx').on(t.name)],
);

export const categories = sqliteTable(
  'categories',
  {
    sourceId: text('source_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.id] })],
);

export const tags = sqliteTable(
  'tags',
  {
    sourceId: text('source_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.id] }), index('tags_name_idx').on(t.name)],
);

/** Story metadata. This is the metadata cache tier and is safe to evict/refresh. */
export const stories = sqliteTable(
  'stories',
  {
    sourceId: text('source_id').notNull(),
    id: text('id').notNull(),
    title: text('title').notNull(),
    authorId: text('author_id'),
    authorName: text('author_name'),
    description: text('description'),
    categoryId: text('category_id'),
    categoryName: text('category_name'),
    lang: text('lang'),
    url: text('url'),
    coverUrl: text('cover_url'),
    rating: real('rating'),
    votes: integer('votes'),
    views: integer('views'),
    wordCount: integer('word_count'),
    isNew: integer('is_new', { mode: 'boolean' }),
    isHot: integer('is_hot', { mode: 'boolean' }),
    isWritersPick: integer('is_writers_pick', { mode: 'boolean' }),
    isContestWinner: integer('is_contest_winner', { mode: 'boolean' }),
    commentsEnabled: integer('comments_enabled', { mode: 'boolean' }),
    ratingEnabled: integer('rating_enabled', { mode: 'boolean' }),
    publishedAt: integer('published_at'),
    seriesId: text('series_id'),
    seriesTitle: text('series_title'),
    seriesPosition: integer('series_position'),
    fetchedAt: integer('fetched_at').notNull().default(unixNow),
    raw: text('raw', { mode: 'json' }),
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.id] }),
    index('stories_author_idx').on(t.sourceId, t.authorId),
    index('stories_category_idx').on(t.sourceId, t.categoryId),
    index('stories_published_idx').on(t.sourceId, t.publishedAt),
    index('stories_series_idx').on(t.sourceId, t.seriesId),
  ],
);

export const storyTags = sqliteTable(
  'story_tags',
  {
    sourceId: text('source_id').notNull(),
    storyId: text('story_id').notNull(),
    tagId: text('tag_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.storyId, t.tagId] })],
);

/** Story content, split into pages. The "cached chapter" tier. */
export const pages = sqliteTable(
  'pages',
  {
    sourceId: text('source_id').notNull(),
    storyId: text('story_id').notNull(),
    index: integer('index').notNull(),
    title: text('title'),
    content: text('content'),
    wordCount: integer('word_count'),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.storyId, t.index] })],
);

export const libraryCategories = sqliteTable('library_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull().default(unixNow),
});

export const libraryEntries = sqliteTable(
  'library_entries',
  {
    sourceId: text('source_id').notNull(),
    storyId: text('story_id').notNull(),
    addedAt: integer('added_at').notNull().default(unixNow),
    sortOrder: integer('sort_order'),
    lastReadAt: integer('last_read_at'),
    isUnread: integer('is_unread', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.storyId] })],
);

export const libraryCategoryEntries = sqliteTable(
  'library_category_entries',
  {
    categoryId: text('category_id').notNull(),
    sourceId: text('source_id').notNull(),
    storyId: text('story_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.sourceId, t.storyId] })],
);

export const readingProgress = sqliteTable(
  'reading_progress',
  {
    sourceId: text('source_id').notNull(),
    storyId: text('story_id').notNull(),
    pageIndex: integer('page_index').notNull().default(0),
    pageCount: integer('page_count'),
    scrollPct: real('scroll_pct').notNull().default(0),
    readPages: text('read_pages', { mode: 'json' }).$type<number[]>(),
    updatedAt: integer('updated_at').notNull().default(unixNow),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.storyId] })],
);

export const history = sqliteTable(
  'history',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id').notNull(),
    storyId: text('story_id').notNull(),
    pageIndex: integer('page_index').notNull().default(0),
    durationMs: integer('duration_ms'),
    readAt: integer('read_at').notNull().default(unixNow),
  },
  (t) => [index('history_read_at_idx').on(t.readAt)],
);

/** The pinned download tier. Never evicted by cache sweeps. */
export const downloads = sqliteTable(
  'downloads',
  {
    sourceId: text('source_id').notNull(),
    storyId: text('story_id').notNull(),
    status: text('status').notNull().default('queued'),
    totalPages: integer('total_pages'),
    downloadedPages: integer('downloaded_pages').notNull().default(0),
    sizeBytes: integer('size_bytes'),
    path: text('path'),
    error: text('error'),
    startedAt: integer('started_at'),
    completedAt: integer('completed_at'),
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.storyId] }),
    index('downloads_status_idx').on(t.status),
  ],
);

/** HTTP response cache with revalidation metadata. */
export const cachedResponses = sqliteTable(
  'cached_responses',
  {
    key: text('key').primaryKey(),
    sourceId: text('source_id'),
    status: integer('status'),
    etag: text('etag'),
    lastModified: text('last_modified'),
    body: text('body'),
    fetchedAt: integer('fetched_at').notNull().default(unixNow),
    expiresAt: integer('expires_at'),
  },
  (t) => [index('cached_responses_expires_idx').on(t.expiresAt)],
);

/** Cached page listings (popular/latest/search results). */
export const sourceListCache = sqliteTable(
  'source_list_cache',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id').notNull(),
    kind: text('kind').notNull(),
    page: integer('page').notNull().default(1),
    paramsHash: text('params_hash').notNull(),
    storyRefs: text('story_refs', { mode: 'json' }).$type<string[]>(),
    total: integer('total'),
    fetchedAt: integer('fetched_at').notNull().default(unixNow),
    expiresAt: integer('expires_at'),
  },
  (t) => [uniqueIndex('source_list_cache_unique_idx').on(t.sourceId, t.kind, t.page, t.paramsHash)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }),
  updatedAt: integer('updated_at').notNull().default(unixNow),
});

/** Installed runtime extensions (JS source packages). */
export const extensions = sqliteTable('extensions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  lang: text('lang').notNull().default('en'),
  baseUrl: text('base_url').notNull(),
  manifest: text('manifest', { mode: 'json' }).$type<Record<string, unknown>>(),
  code: text('code').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sourceUrl: text('source_url'),
  installedAt: integer('installed_at').notNull().default(unixNow),
  updatedAt: integer('updated_at').notNull().default(unixNow),
});
