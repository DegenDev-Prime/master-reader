import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';

import type { Database as AppDatabase } from './client';
import { migrateLegacyData } from './legacy-data';
import * as schema from './schema';

function createLegacyDatabase() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'src/db/migrations' });

  db.insert(schema.pages)
    .values([
      {
        sourceId: 'novelfire',
        storyId: 'shadow-slave',
        index: 0,
        chapterId: '1',
        title: 'Chapter 1',
        content: 'First chapter.',
        wordCount: 2,
      },
      {
        sourceId: 'novelfire',
        storyId: 'shadow-slave',
        index: 1,
        chapterId: '2',
        title: 'Chapter 2',
        content: 'Second chapter.',
        wordCount: 2,
      },
      {
        sourceId: 'literotica',
        storyId: '545135',
        index: 0,
        chapterId: null,
        title: 'Page 1',
        content: 'Eager page.',
        wordCount: 2,
      },
    ])
    .run();

  db.insert(schema.readingProgress)
    .values({
      sourceId: 'novelfire',
      storyId: 'shadow-slave',
      pageIndex: 1,
      scrollPct: 0.4,
      readPages: [0, 1],
      updatedAt: 1000,
    })
    .run();

  db.insert(schema.history)
    .values({
      id: 'h1',
      sourceId: 'novelfire',
      storyId: 'shadow-slave',
      pageIndex: 0,
      readAt: 900,
    })
    .run();

  db.insert(schema.downloads)
    .values({
      sourceId: 'novelfire',
      storyId: 'shadow-slave',
      status: 'downloading',
      totalPages: 2,
      downloadedPages: 1,
      sizeBytes: 10,
    })
    .run();

  db.insert(schema.narrationState)
    .values({
      sourceId: 'novelfire',
      storyId: 'shadow-slave',
      chunkIndex: 3,
      charOffset: 12,
    })
    .run();

  db.insert(schema.narrationBookmarks)
    .values({
      id: 'b1',
      sourceId: 'novelfire',
      storyId: 'shadow-slave',
      chunkIndex: 3,
      label: 'Bookmark',
    })
    .run();

  const runWithoutTransaction = new Proxy(db, {
    get(target, property, receiver) {
      if (property === 'transaction') {
        return async (work: (tx: typeof db) => Promise<void>) => work(target);
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as unknown as AppDatabase;

  return { sqlite, db, runWithoutTransaction };
}

describe('migrateLegacyData', () => {
  it('copies pages, read state, progress and downloads into the v2 tables', async () => {
    const { sqlite, db, runWithoutTransaction } = createLegacyDatabase();

    await migrateLegacyData(runWithoutTransaction);

    const chapterRows = db.select().from(schema.chapters).all();
    expect(chapterRows).toHaveLength(3);
    expect(chapterRows.map((row) => row.id).sort()).toEqual(['1', '2', 'p0']);
    expect(chapterRows.find((row) => row.id === '1')?.content).toBe('First chapter.');

    const readRows = db.select().from(schema.chapterReads).all();
    expect(readRows.map((row) => row.chapterId).sort()).toEqual(['1', '2']);

    const progress = db.select().from(schema.readingProgress).get();
    expect(progress?.chapterId).toBe('2');

    const historyEntry = db.select().from(schema.history).get();
    expect(historyEntry?.chapterId).toBe('1');

    const download = db.select().from(schema.downloads).get();
    expect(download?.totalPages).toBe(2);
    expect(download?.downloadedPages).toBe(2);
    expect(download?.status).toBe('completed');
    expect(download?.sizeBytes).toBeGreaterThan(0);

    const chapterDownloads = db.select().from(schema.chapterDownloads).all();
    expect(chapterDownloads).toHaveLength(3);
    expect(chapterDownloads.every((row) => row.status === 'completed')).toBe(true);

    const narration = db.select().from(schema.narrationState).get();
    expect(narration?.chapterId).toBe('2');
    expect(narration?.chunkIndex).toBe(3);

    const bookmark = db.select().from(schema.narrationBookmarks).get();
    expect(bookmark?.chapterId).toBe('2');

    const version = db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, 'schema.dataVersion'))
      .get();
    expect(version?.value).toBe(2);

    sqlite.close();
  });

  it('is idempotent across repeated runs', async () => {
    const { sqlite, db, runWithoutTransaction } = createLegacyDatabase();

    await migrateLegacyData(runWithoutTransaction);
    const firstChapters = db.select().from(schema.chapters).all().length;
    const firstReads = db.select().from(schema.chapterReads).all().length;
    const firstDownloads = db.select().from(schema.chapterDownloads).all().length;

    await migrateLegacyData(runWithoutTransaction);

    expect(db.select().from(schema.chapters).all()).toHaveLength(firstChapters);
    expect(db.select().from(schema.chapterReads).all()).toHaveLength(firstReads);
    expect(db.select().from(schema.chapterDownloads).all()).toHaveLength(firstDownloads);

    sqlite.close();
  });
});
