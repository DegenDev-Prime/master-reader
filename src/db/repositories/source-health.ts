import { eq, sql } from 'drizzle-orm';

import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { sourceHealth } from '../schema';

export type SourceHealthRow = typeof sourceHealth.$inferSelect;

export type SourceHealthKey = {
  sourceId: string;
  operation: string;
};

export const sourceHealthRepository = {
  async list(): Promise<SourceHealthRow[]> {
    return db.select().from(sourceHealth);
  },

  async get(sourceId: string, operation: string): Promise<SourceHealthRow | undefined> {
    return db
      .select()
      .from(sourceHealth)
      .where(eq(sourceHealth.sourceId, sourceId))
      .all()
      .find((row) => row.operation === operation);
  },

  async recordSuccess(key: SourceHealthKey, latencyMs: number): Promise<void> {
    const previous = await this.get(key.sourceId, key.operation);
    const ewma =
      previous?.ewmaLatencyMs != null
        ? previous.ewmaLatencyMs * 0.7 + Math.max(0, latencyMs) * 0.3
        : Math.max(0, latencyMs);
    const now = nowSeconds();
    const values = {
      ...key,
      lastOkAt: now,
      lastErrorAt: previous?.lastErrorAt ?? null,
      lastErrorKind: null,
      failCount: 0,
      ewmaLatencyMs: ewma,
    };

    await db
      .insert(sourceHealth)
      .values(values)
      .onConflictDoUpdate({
        target: [sourceHealth.sourceId, sourceHealth.operation],
        set: values,
      });
  },

  async recordFailure(key: SourceHealthKey, errorKind: string): Promise<void> {
    const now = nowSeconds();
    await db
      .insert(sourceHealth)
      .values({
        ...key,
        lastOkAt: null,
        lastErrorAt: now,
        lastErrorKind: errorKind,
        failCount: 1,
      })
      .onConflictDoUpdate({
        target: [sourceHealth.sourceId, sourceHealth.operation],
        set: {
          lastErrorAt: now,
          lastErrorKind: errorKind,
          failCount: sql`${sourceHealth.failCount} + 1`,
        },
      });
  },
};
