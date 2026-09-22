import { eq } from 'drizzle-orm';

import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { sources } from '../schema';

export type SourceRow = typeof sources.$inferSelect;
export type NewSourceRow = typeof sources.$inferInsert;

export const sourcesRepository = {
  async list(): Promise<SourceRow[]> {
    return db.select().from(sources);
  },

  async listEnabled(): Promise<SourceRow[]> {
    return db.select().from(sources).where(eq(sources.enabled, true));
  },

  async get(id: string): Promise<SourceRow | undefined> {
    return db.select().from(sources).where(eq(sources.id, id)).get();
  },

  async upsert(record: NewSourceRow): Promise<void> {
    const updatedAt = nowSeconds();
    const values = { ...record, updatedAt };

    await db.insert(sources).values(values).onConflictDoUpdate({ target: sources.id, set: values });
  },
};
