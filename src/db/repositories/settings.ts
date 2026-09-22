import { eq, inArray, sql } from 'drizzle-orm';

import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { settings } from '../schema';

export const settingsRepository = {
  async getAll(): Promise<Record<string, unknown>> {
    const rows = await db.select().from(settings);
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  },

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const row = await db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value as T | undefined;
  },

  async set(key: string, value: unknown): Promise<void> {
    const updatedAt = nowSeconds();
    await db
      .insert(settings)
      .values({ key, value, updatedAt })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt } });
  },

  async setMany(entries: Record<string, unknown>): Promise<void> {
    const rows = Object.entries(entries).map(([key, value]) => ({
      key,
      value,
      updatedAt: nowSeconds(),
    }));
    if (rows.length === 0) return;

    await db
      .insert(settings)
      .values(rows)
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: sql`excluded.value`, updatedAt: sql`excluded.updated_at` },
      });
  },

  async remove(key: string): Promise<void> {
    await db.delete(settings).where(eq(settings.key, key));
  },

  async removeMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await db.delete(settings).where(inArray(settings.key, keys));
  },
};
