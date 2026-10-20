import { describe, expect, it } from 'vitest';

import type { Story } from '@/models/story';

import { toStory, toStoryRow, type StoryRow } from './story';

const baseStory: Story = {
  sourceId: 'literotica',
  id: '123',
  title: 'A Tale',
  authorId: '9',
  authorName: 'Anne',
  flags: { isNew: true, commentsEnabled: false, ratingEnabled: true },
  publishedAt: 1000,
  tags: ['romance'],
};

describe('story mappers', () => {
  it('maps a domain story to a row, defaulting optional values to null', () => {
    const row = toStoryRow(baseStory);

    expect(row.sourceId).toBe('literotica');
    expect(row.id).toBe('123');
    expect(row.isNew).toBe(true);
    expect(row.commentsEnabled).toBe(false);
    expect(row.ratingEnabled).toBe(true);
    expect(row.isHot).toBeNull();
    expect(row.categoryId).toBeNull();
    expect(row.raw).toBeNull();
    expect(typeof row.fetchedAt).toBe('number');
  });

  it('maps a row back to a domain story', () => {
    const row: StoryRow = {
      sourceId: 'literotica',
      id: '123',
      title: 'A Tale',
      authorId: '9',
      authorName: 'Anne',
      description: null,
      categoryId: '1',
      categoryName: 'Romance',
      lang: 'en',
      url: null,
      coverUrl: null,
      rating: 4.5,
      votes: 10,
      views: 100,
      wordCount: null,
      status: null,
      genres: null,
      stats: null,
      chapterCount: null,
      chaptersSyncedAt: null,
      updatedAt: null,
      isNew: true,
      isHot: null,
      isWritersPick: null,
      isContestWinner: false,
      commentsEnabled: false,
      ratingEnabled: true,
      publishedAt: 1000,
      seriesId: null,
      seriesTitle: null,
      seriesPosition: null,
      fetchedAt: 2000,
      raw: null,
    };

    const story = toStory(row);

    expect(story.title).toBe('A Tale');
    expect(story.categoryName).toBe('Romance');
    expect(story.flags.isNew).toBe(true);
    expect(story.flags.isHot).toBeNull();
    expect(story.raw).toBeUndefined();
    expect(story.publishedAt).toBe(1000);
  });
});
