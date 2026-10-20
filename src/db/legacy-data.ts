import { and, asc, eq, sql } from 'drizzle-orm';

import { nowSeconds } from '@/utils/time';

import type { Database } from './client';
import {
  chapterIdsFromPages,
  chapterFromPage,
  uniqueChapterIds,
  type LegacyPage,
} from './mappers/legacy';
import {
  chapterDownloads,
  chapterReads,
  chapters,
  downloads,
  history,
  narrationBookmarks,
  narrationState,
  pages,
  readingProgress,
  settings,
} from './schema';

const DATA_VERSION_KEY = 'schema.dataVersion';
const DATA_VERSION = 2;
const CHUNK = 40;

function pageKey(sourceId: string, storyId: string, index: number): string {
  return `${sourceId}\u0000${storyId}\u0000${index}`;
}

export async function migrateLegacyData(client: Database): Promise<void> {
  const versionRow = await client
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, DATA_VERSION_KEY))
    .get();

  if (Number(versionRow?.value ?? 0) >= DATA_VERSION) return;

  await client.transaction(async (tx) => {
    const pageRows = await tx
      .select()
      .from(pages)
      .orderBy(asc(pages.sourceId), asc(pages.storyId), asc(pages.index));

    const legacyPages: LegacyPage[] = pageRows.map((row) => ({
      sourceId: row.sourceId,
      storyId: row.storyId,
      index: row.index,
      chapterId: row.chapterId,
      title: row.title,
      content: row.content,
      wordCount: row.wordCount,
    }));

    const chapterRows = legacyPages.map(chapterFromPage);
    for (let index = 0; index < chapterRows.length; index += CHUNK) {
      await tx
        .insert(chapters)
        .values(
          chapterRows.slice(index, index + CHUNK).map((chapter) => ({
            ...chapter,
            number: null,
            orphaned: false,
          })),
        )
        .onConflictDoNothing();
    }

    const chapterIdByPage = new Map<string, string>();
    for (const page of legacyPages) {
      chapterIdByPage.set(
        pageKey(page.sourceId, page.storyId, page.index),
        chapterFromPage(page).id,
      );
    }

    const progressRows = await tx.select().from(readingProgress);
    const currentChapterByStory = new Map<string, string>();

    for (const progress of progressRows) {
      const chapterId =
        chapterIdByPage.get(pageKey(progress.sourceId, progress.storyId, progress.pageIndex)) ??
        progress.chapterId ??
        null;

      if (chapterId) {
        currentChapterByStory.set(`${progress.sourceId}\u0000${progress.storyId}`, chapterId);
        if (chapterId !== progress.chapterId) {
          await tx
            .update(readingProgress)
            .set({ chapterId })
            .where(
              and(
                eq(readingProgress.sourceId, progress.sourceId),
                eq(readingProgress.storyId, progress.storyId),
              ),
            );
        }
      }

      const storyPages = legacyPages.filter(
        (page) => page.sourceId === progress.sourceId && page.storyId === progress.storyId,
      );
      const readIds = uniqueChapterIds(chapterIdsFromPages(storyPages, progress.readPages ?? []));
      for (let index = 0; index < readIds.length; index += CHUNK) {
        await tx
          .insert(chapterReads)
          .values(
            readIds.slice(index, index + CHUNK).map((chapterId) => ({
              sourceId: progress.sourceId,
              novelId: progress.storyId,
              chapterId,
              readAt: progress.updatedAt,
            })),
          )
          .onConflictDoNothing();
      }
    }

    const historyRows = await tx.select().from(history);
    const historyReads: {
      sourceId: string;
      novelId: string;
      chapterId: string;
      readAt: number;
    }[] = [];

    for (const entry of historyRows) {
      const chapterId =
        chapterIdByPage.get(pageKey(entry.sourceId, entry.storyId, entry.pageIndex)) ??
        entry.chapterId ??
        null;

      if (chapterId) {
        historyReads.push({
          sourceId: entry.sourceId,
          novelId: entry.storyId,
          chapterId,
          readAt: entry.readAt,
        });
      }

      if (chapterId && chapterId !== entry.chapterId) {
        await tx.update(history).set({ chapterId }).where(eq(history.id, entry.id));
      }
    }

    for (let index = 0; index < historyReads.length; index += CHUNK) {
      await tx
        .insert(chapterReads)
        .values(historyReads.slice(index, index + CHUNK))
        .onConflictDoNothing();
    }

    const narrationRows = await tx.select().from(narrationState);
    for (const state of narrationRows) {
      const chapterId = currentChapterByStory.get(`${state.sourceId}\u0000${state.storyId}`);
      if (chapterId && chapterId !== state.chapterId) {
        await tx
          .update(narrationState)
          .set({ chapterId })
          .where(
            and(
              eq(narrationState.sourceId, state.sourceId),
              eq(narrationState.storyId, state.storyId),
            ),
          );
      }
    }

    const bookmarkRows = await tx.select().from(narrationBookmarks);
    for (const bookmark of bookmarkRows) {
      const chapterId = currentChapterByStory.get(`${bookmark.sourceId}\u0000${bookmark.storyId}`);
      if (chapterId && chapterId !== bookmark.chapterId) {
        await tx
          .update(narrationBookmarks)
          .set({ chapterId })
          .where(eq(narrationBookmarks.id, bookmark.id));
      }
    }

    const contentRows = await tx
      .select({
        sourceId: chapters.sourceId,
        novelId: chapters.novelId,
        chapterId: chapters.id,
        bytes: sql<number>`length(${chapters.content})`,
      })
      .from(chapters)
      .where(sql`${chapters.content} is not null`);

    for (let index = 0; index < contentRows.length; index += CHUNK) {
      await tx
        .insert(chapterDownloads)
        .values(
          contentRows.slice(index, index + CHUNK).map((row) => ({
            sourceId: row.sourceId,
            novelId: row.novelId,
            chapterId: row.chapterId,
            status: 'completed',
            bytes: Number(row.bytes ?? 0),
            updatedAt: nowSeconds(),
          })),
        )
        .onConflictDoNothing();
    }

    const downloadRows = await tx.select().from(downloads);
    for (const download of downloadRows) {
      const aggregate = await tx
        .select({
          total: sql<number>`count(*)`,
          downloaded: sql<number>`coalesce(sum(case when ${chapters.content} is not null then 1 else 0 end), 0)`,
          bytes: sql<number>`coalesce(sum(case when ${chapters.content} is not null then length(${chapters.content}) else 0 end), 0)`,
        })
        .from(chapters)
        .where(
          and(eq(chapters.sourceId, download.sourceId), eq(chapters.novelId, download.storyId)),
        )
        .get();

      const total = Number(aggregate?.total ?? 0);
      const downloaded = Number(aggregate?.downloaded ?? 0);
      const completed = total > 0 && downloaded >= total;

      await tx
        .update(downloads)
        .set({
          totalPages: total,
          downloadedPages: downloaded,
          sizeBytes: Number(aggregate?.bytes ?? 0),
          status: completed ? 'completed' : download.status,
          completedAt: completed ? (download.completedAt ?? nowSeconds()) : download.completedAt,
        })
        .where(
          and(eq(downloads.sourceId, download.sourceId), eq(downloads.storyId, download.storyId)),
        );
    }

    await tx
      .insert(settings)
      .values({ key: DATA_VERSION_KEY, value: DATA_VERSION, updatedAt: nowSeconds() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: DATA_VERSION, updatedAt: nowSeconds() },
      });
  });
}
