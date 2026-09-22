import { asc, eq } from 'drizzle-orm';

import type { ExtensionManifest, ExtensionRecord } from '@/extensions/manifest';
import { nowSeconds } from '@/utils/time';

import { db } from '../client';
import { extensions } from '../schema';

export type ExtensionRow = typeof extensions.$inferSelect;

function toRecord(row: ExtensionRow): ExtensionRecord {
  const manifest = (row.manifest as unknown as ExtensionManifest | null) ?? {
    id: row.id,
    name: row.name,
    version: row.version,
    lang: row.lang,
    baseUrl: row.baseUrl,
    capabilities: [],
  };

  return {
    id: row.id,
    manifest,
    code: row.code,
    enabled: row.enabled,
    sourceUrl: row.sourceUrl,
    installedAt: row.installedAt,
    updatedAt: row.updatedAt,
  };
}

export const extensionsRepository = {
  async list(): Promise<ExtensionRecord[]> {
    const rows = await db.select().from(extensions).orderBy(asc(extensions.name));
    return rows.map(toRecord);
  },

  async get(id: string): Promise<ExtensionRecord | null> {
    const row = await db.select().from(extensions).where(eq(extensions.id, id)).get();
    return row ? toRecord(row) : null;
  },

  async upsert(record: ExtensionRecord): Promise<void> {
    const updatedAt = nowSeconds();
    const values = {
      id: record.id,
      name: record.manifest.name,
      version: record.manifest.version,
      lang: record.manifest.lang,
      baseUrl: record.manifest.baseUrl,
      manifest: record.manifest as unknown as Record<string, unknown>,
      code: record.code,
      enabled: record.enabled,
      sourceUrl: record.sourceUrl,
      updatedAt,
    };

    await db
      .insert(extensions)
      .values({ ...values, installedAt: record.installedAt })
      .onConflictDoUpdate({ target: extensions.id, set: values });
  },

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await db
      .update(extensions)
      .set({ enabled, updatedAt: nowSeconds() })
      .where(eq(extensions.id, id));
  },

  async remove(id: string): Promise<void> {
    await db.delete(extensions).where(eq(extensions.id, id));
  },
};
