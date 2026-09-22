import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite';

import migrations from './migrations/migrations';
import * as schema from './schema';

export const DATABASE_NAME = 'masterreader.db';

/** Synchronous handle to the underlying SQLite database. */
export const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

/** Drizzle client with the full schema attached for relational helpers. */
export const db = drizzle(expoDb, { schema });

export type Database = typeof db;

let readyPromise: Promise<void> | null = null;

/**
 * Opens the database if needed and applies any pending migrations exactly once.
 * Safe to call from multiple places; resolves to the same promise.
 */
export function initDatabase(): Promise<void> {
  readyPromise ??= (async () => {
    await expoDb.execAsync('PRAGMA journal_mode = WAL;');
    await expoDb.execAsync('PRAGMA foreign_keys = ON;');
    await migrate(db, migrations);
  })();

  return readyPromise;
}
