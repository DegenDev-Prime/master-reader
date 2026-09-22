import type { Story } from '@/models/story';
import { nowSeconds } from '@/utils/time';

import { stories } from '../schema';

export type StoryRow = typeof stories.$inferSelect;
export type NewStoryRow = typeof stories.$inferInsert;

/**
 * Pure row <-> domain mappers. Kept free of the database client so they can be
 * unit-tested without the native SQLite module.
 */

export function toStoryRow(story: Story): NewStoryRow {
  return {
    sourceId: story.sourceId,
    id: story.id,
    title: story.title,
    authorId: story.authorId ?? null,
    authorName: story.authorName ?? null,
    description: story.description ?? null,
    categoryId: story.categoryId ?? null,
    categoryName: story.categoryName ?? null,
    lang: story.lang ?? null,
    url: story.url ?? null,
    coverUrl: story.coverUrl ?? null,
    rating: story.rating ?? null,
    votes: story.votes ?? null,
    views: story.views ?? null,
    wordCount: story.wordCount ?? null,
    isNew: story.flags.isNew ?? null,
    isHot: story.flags.isHot ?? null,
    isWritersPick: story.flags.isWritersPick ?? null,
    isContestWinner: story.flags.isContestWinner ?? null,
    commentsEnabled: story.flags.commentsEnabled ?? null,
    ratingEnabled: story.flags.ratingEnabled ?? null,
    publishedAt: story.publishedAt ?? null,
    seriesId: story.seriesId ?? null,
    seriesTitle: story.seriesTitle ?? null,
    seriesPosition: story.seriesPosition ?? null,
    fetchedAt: story.fetchedAt ?? nowSeconds(),
    raw: (story.raw ?? null) as Record<string, unknown> | null,
  };
}

export function toStory(row: StoryRow): Story {
  return {
    sourceId: row.sourceId,
    id: row.id,
    title: row.title,
    authorId: row.authorId,
    authorName: row.authorName,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    lang: row.lang,
    url: row.url,
    coverUrl: row.coverUrl,
    rating: row.rating,
    votes: row.votes,
    views: row.views,
    wordCount: row.wordCount,
    flags: {
      isNew: row.isNew,
      isHot: row.isHot,
      isWritersPick: row.isWritersPick,
      isContestWinner: row.isContestWinner,
      commentsEnabled: row.commentsEnabled,
      ratingEnabled: row.ratingEnabled,
    },
    publishedAt: row.publishedAt,
    fetchedAt: row.fetchedAt,
    seriesId: row.seriesId,
    seriesTitle: row.seriesTitle,
    seriesPosition: row.seriesPosition,
    raw: row.raw ?? undefined,
  };
}
