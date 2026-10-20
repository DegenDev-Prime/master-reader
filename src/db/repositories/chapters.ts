import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { Chapter } from '@/models/novel';
import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { chapterReads, chapters } from '../schema';

const WRITE_CHUNK = 40;
const READ_CHUNK = 200;

export type ChapterMetadata = {
  sourceId: string;
  novelId: string;
  id: string;
  position: number;
  title?: string | null;
  number?: number | null;
  volume?: string | null;
  volumeIndex?: number | null;
  releasedAt?: number | null;
  wordCount?: number | null;
};

export type ChapterListItem = Chapter & {
  hasContent: boolean;
  readAt: number | null;
};

export type ChapterCounts = {
  total: number;
  downloaded: number;
  orphaned: number;
  read: number;
};

type ChapterRow = typeof chapters.$inferSelect;

function toChapter(row: ChapterRow): Chapter {
  return {
    sourceId: row.sourceId,
    novelId: row.novelId,
    id: row.id,
    position: row.position,
    number: row.number,
    title: row.title ?? '',
    volume: row.volume,
    volumeIndex: row.volumeIndex,
    releasedAt: row.releasedAt,
    wordCount: row.wordCount,
    hasContent: row.content !== null,
    orphaned: row.orphaned,
  };
}

export const chapterRepository = {
  async upsertMetadata(list: ChapterMetadata[]): Promise<void> {
    if (list.length === 0) return;

    const values = list.map((item) => ({
      sourceId: item.sourceId,
      novelId: item.novelId,
      id: item.id,
      position: item.position,
      number: item.number ?? null,
      title: item.title ?? null,
      volume: item.volume ?? null,
      volumeIndex: item.volumeIndex ?? null,
      releasedAt: item.releasedAt ?? null,
      wordCount: item.wordCount ?? null,
      orphaned: false,
    }));

    for (let index = 0; index < values.length; index += WRITE_CHUNK) {
      await db
        .insert(chapters)
        .values(values.slice(index, index + WRITE_CHUNK))
        .onConflictDoUpdate({
          target: [chapters.sourceId, chapters.novelId, chapters.id],
          set: {
            position: sql`excluded.position`,
            number: sql`excluded.number`,
            title: sql`excluded.title`,
            volume: sql`excluded.volume`,
            volumeIndex: sql`excluded.volume_index`,
            releasedAt: sql`excluded.released_at`,
            wordCount: sql`excluded.word_count`,
            orphaned: sql`excluded.orphaned`,
            updatedAt: sql`(unixepoch())`,
          },
        });
    }
  },

  async setContent(
    sourceId: string,
    novelId: string,
    chapterId: string,
    value: {
      html: string;
      wordCount?: number | null;
      contentHash?: string | null;
    },
  ): Promise<void> {
    const result = await db
      .update(chapters)
      .set({
        content: value.html,
        wordCount: value.wordCount ?? null,
        contentHash: value.contentHash ?? null,
        updatedAt: nowSeconds(),
      })
      .where(
        and(
          eq(chapters.sourceId, sourceId),
          eq(chapters.novelId, novelId),
          eq(chapters.id, chapterId),
        ),
      );

    if (result.changes === 0) {
      throw new Error(`Chapter ${sourceId}/${novelId}/${chapterId} is not in the catalog.`);
    }
  },

  async getContent(sourceId: string, novelId: string, chapterId: string): Promise<string | null> {
    const row = await db
      .select({ content: chapters.content })
      .from(chapters)
      .where(
        and(
          eq(chapters.sourceId, sourceId),
          eq(chapters.novelId, novelId),
          eq(chapters.id, chapterId),
        ),
      )
      .get();
    return row?.content ?? null;
  },

  async get(sourceId: string, novelId: string, chapterId: string): Promise<Chapter | null> {
    const row = await db
      .select()
      .from(chapters)
      .where(
        and(
          eq(chapters.sourceId, sourceId),
          eq(chapters.novelId, novelId),
          eq(chapters.id, chapterId),
        ),
      )
      .get();
    return row ? toChapter(row) : null;
  },

  async getWithContent(
    sourceId: string,
    novelId: string,
    chapterId: string,
  ): Promise<(Chapter & { content: string | null }) | null> {
    const row = await db
      .select()
      .from(chapters)
      .where(
        and(
          eq(chapters.sourceId, sourceId),
          eq(chapters.novelId, novelId),
          eq(chapters.id, chapterId),
        ),
      )
      .get();
    return row ? { ...toChapter(row), content: row.content } : null;
  },

  async listMetadata(
    sourceId: string,
    novelId: string,
    options: { includeOrphaned?: boolean } = {},
  ): Promise<ChapterListItem[]> {
    const conditions = [eq(chapters.sourceId, sourceId), eq(chapters.novelId, novelId)];
    if (!options.includeOrphaned) {
      conditions.push(eq(chapters.orphaned, false));
    }

    const rows = await db
      .select({
        sourceId: chapters.sourceId,
        novelId: chapters.novelId,
        id: chapters.id,
        position: chapters.position,
        number: chapters.number,
        title: chapters.title,
        volume: chapters.volume,
        volumeIndex: chapters.volumeIndex,
        releasedAt: chapters.releasedAt,
        wordCount: chapters.wordCount,
        orphaned: chapters.orphaned,
        hasContent: sql<number>`(${chapters.content} is not null)`,
        readAt: chapterReads.readAt,
      })
      .from(chapters)
      .leftJoin(
        chapterReads,
        and(
          eq(chapterReads.sourceId, chapters.sourceId),
          eq(chapterReads.novelId, chapters.novelId),
          eq(chapterReads.chapterId, chapters.id),
        ),
      )
      .where(and(...conditions))
      .orderBy(asc(chapters.position), asc(chapters.id));

    return rows.map((row) => ({
      sourceId: row.sourceId,
      novelId: row.novelId,
      id: row.id,
      position: row.position,
      number: row.number,
      title: row.title ?? '',
      volume: row.volume,
      volumeIndex: row.volumeIndex,
      releasedAt: row.releasedAt,
      wordCount: row.wordCount,
      hasContent: Boolean(row.hasContent),
      orphaned: row.orphaned,
      readAt: row.readAt,
    }));
  },

  async counts(sourceId: string, novelId: string): Promise<ChapterCounts> {
    const row = await db
      .select({
        total: sql<number>`count(*)`,
        downloaded: sql<number>`coalesce(sum(case when ${chapters.content} is not null then 1 else 0 end), 0)`,
        orphaned: sql<number>`coalesce(sum(case when ${chapters.orphaned} = 1 then 1 else 0 end), 0)`,
      })
      .from(chapters)
      .where(and(eq(chapters.sourceId, sourceId), eq(chapters.novelId, novelId)))
      .get();

    const readRow = await db
      .select({ read: sql<number>`count(*)` })
      .from(chapterReads)
      .innerJoin(
        chapters,
        and(
          eq(chapters.sourceId, chapterReads.sourceId),
          eq(chapters.novelId, chapterReads.novelId),
          eq(chapters.id, chapterReads.chapterId),
        ),
      )
      .where(and(eq(chapterReads.sourceId, sourceId), eq(chapterReads.novelId, novelId)))
      .get();

    return {
      total: Number(row?.total ?? 0),
      downloaded: Number(row?.downloaded ?? 0),
      orphaned: Number(row?.orphaned ?? 0),
      read: Number(readRow?.read ?? 0),
    };
  },

  async markOrphaned(sourceId: string, novelId: string, keepIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(chapters)
        .set({ orphaned: true })
        .where(
          and(
            eq(chapters.sourceId, sourceId),
            eq(chapters.novelId, novelId),
            eq(chapters.orphaned, false),
          ),
        );

      for (let index = 0; index < keepIds.length; index += READ_CHUNK) {
        await tx
          .update(chapters)
          .set({ orphaned: false })
          .where(
            and(
              eq(chapters.sourceId, sourceId),
              eq(chapters.novelId, novelId),
              inArray(chapters.id, keepIds.slice(index, index + READ_CHUNK)),
            ),
          );
      }
    });
  },

  async removeContent(sourceId: string, novelId: string, chapterIds?: string[]): Promise<void> {
    const conditions = [eq(chapters.sourceId, sourceId), eq(chapters.novelId, novelId)];
    if (chapterIds && chapterIds.length > 0) {
      conditions.push(inArray(chapters.id, chapterIds));
    }

    await db
      .update(chapters)
      .set({ content: null, contentHash: null, updatedAt: nowSeconds() })
      .where(and(...conditions));
  },

  async removeForNovel(sourceId: string, novelId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(chapterReads)
        .where(and(eq(chapterReads.sourceId, sourceId), eq(chapterReads.novelId, novelId)));
      await tx
        .delete(chapters)
        .where(and(eq(chapters.sourceId, sourceId), eq(chapters.novelId, novelId)));
    });
  },
};

export const chapterReadsRepository = {
  async markRead(
    sourceId: string,
    novelId: string,
    chapterId: string,
    readAt = nowSeconds(),
  ): Promise<void> {
    await db
      .insert(chapterReads)
      .values({ sourceId, novelId, chapterId, readAt })
      .onConflictDoUpdate({
        target: [chapterReads.sourceId, chapterReads.novelId, chapterReads.chapterId],
        set: { readAt },
      });
  },

  async markManyRead(
    entries: { sourceId: string; novelId: string; chapterId: string }[],
    readAt = nowSeconds(),
  ): Promise<void> {
    for (let index = 0; index < entries.length; index += READ_CHUNK) {
      await db
        .insert(chapterReads)
        .values(entries.slice(index, index + READ_CHUNK).map((entry) => ({ ...entry, readAt })))
        .onConflictDoUpdate({
          target: [chapterReads.sourceId, chapterReads.novelId, chapterReads.chapterId],
          set: { readAt: sql`excluded.read_at` },
        });
    }
  },

  async markReadThrough(
    sourceId: string,
    novelId: string,
    position: number,
    readAt = nowSeconds(),
  ): Promise<number> {
    const rows = await db
      .select({ id: chapters.id })
      .from(chapters)
      .where(
        and(
          eq(chapters.sourceId, sourceId),
          eq(chapters.novelId, novelId),
          eq(chapters.orphaned, false),
          sql`${chapters.position} <= ${position}`,
        ),
      )
      .orderBy(asc(chapters.position));

    if (rows.length === 0) return 0;

    for (let index = 0; index < rows.length; index += READ_CHUNK) {
      await db
        .insert(chapterReads)
        .values(
          rows
            .slice(index, index + READ_CHUNK)
            .map((row) => ({ sourceId, novelId, chapterId: row.id, readAt })),
        )
        .onConflictDoNothing();
    }

    return rows.length;
  },

  async markUnread(sourceId: string, novelId: string, chapterId: string): Promise<void> {
    await db
      .delete(chapterReads)
      .where(
        and(
          eq(chapterReads.sourceId, sourceId),
          eq(chapterReads.novelId, novelId),
          eq(chapterReads.chapterId, chapterId),
        ),
      );
  },

  async markManyUnread(sourceId: string, novelId: string, chapterIds: string[]): Promise<void> {
    for (let index = 0; index < chapterIds.length; index += READ_CHUNK) {
      await db
        .delete(chapterReads)
        .where(
          and(
            eq(chapterReads.sourceId, sourceId),
            eq(chapterReads.novelId, novelId),
            inArray(chapterReads.chapterId, chapterIds.slice(index, index + READ_CHUNK)),
          ),
        );
    }
  },

  async markAllUnread(sourceId: string, novelId: string): Promise<void> {
    await db
      .delete(chapterReads)
      .where(and(eq(chapterReads.sourceId, sourceId), eq(chapterReads.novelId, novelId)));
  },

  async listReadIds(sourceId: string, novelId: string): Promise<string[]> {
    const rows = await db
      .select({ chapterId: chapterReads.chapterId })
      .from(chapterReads)
      .where(and(eq(chapterReads.sourceId, sourceId), eq(chapterReads.novelId, novelId)));
    return rows.map((row) => row.chapterId);
  },

  async countUnread(sourceId: string, novelId: string): Promise<number> {
    const row = await db
      .select({ count: sql<number>`count(*)` })
      .from(chapters)
      .leftJoin(
        chapterReads,
        and(
          eq(chapterReads.sourceId, chapters.sourceId),
          eq(chapterReads.novelId, chapters.novelId),
          eq(chapterReads.chapterId, chapters.id),
        ),
      )
      .where(
        and(
          eq(chapters.sourceId, sourceId),
          eq(chapters.novelId, novelId),
          eq(chapters.orphaned, false),
          sql`${chapterReads.chapterId} is null`,
        ),
      )
      .get();
    return Number(row?.count ?? 0);
  },

  async removeForNovel(sourceId: string, novelId: string): Promise<void> {
    await db
      .delete(chapterReads)
      .where(and(eq(chapterReads.sourceId, sourceId), eq(chapterReads.novelId, novelId)));
  },
};
