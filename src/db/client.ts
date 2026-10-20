import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite';

import migrations from './migrations/migrations';
import { migrateLegacyData } from './legacy-data';
import * as schema from './schema';

export const DATABASE_NAME = 'masterreader.db';

/** Synchronous handle to the underlying SQLite database. */
export const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: false });

/** Drizzle client with the full schema attached for relational helpers. */
export const db = drizzle(expoDb, { schema });

export type Database = typeof db;

let readyPromise: Promise<void> | null = null;

/**
 * Opens the database if needed and applies any pending migrations exactly once.
 * Safe to call from multiple places; resolves to the same promise.
 *
 * `synchronous = NORMAL` is durable under WAL and cuts commit latency; the
 * page cache and mmap keep library queries off the disk on low-RAM devices.
 */
export function initDatabase(): Promise<void> {
  readyPromise ??= (async () => {
    await expoDb.execAsync('PRAGMA journal_mode = WAL;');
    await expoDb.execAsync('PRAGMA foreign_keys = ON;');
    await expoDb.execAsync('PRAGMA synchronous = NORMAL;');
    await expoDb.execAsync('PRAGMA temp_store = MEMORY;');
    await expoDb.execAsync('PRAGMA cache_size = -4000;');
    await expoDb.execAsync('PRAGMA mmap_size = 268435456;');
    await migrate(db, migrations);
    await migrateLegacyData(db);
  })();

  return readyPromise;
}
