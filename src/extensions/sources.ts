import type { Source } from '@/sources/types';

import type { ExtensionRecord } from './manifest';
import { getRuntime } from './runtime';
import { createExtensionSource } from './source';

/**
 * In-memory registry of extension-backed sources, populated by the extension
 * host once each sandbox is loaded. The source manager reads this when building
 * its registry; callers reset the source registry after rebuilding.
 */
const extensionSources = new Map<string, Source>();

export function setExtensionSources(sources: Source[]): void {
  extensionSources.clear();
  for (const source of sources) {
    extensionSources.set(source.info.id, source);
  }
}

export function getExtensionSources(): Source[] {
  return [...extensionSources.values()];
}

/** Builds sources for every enabled record whose sandbox is ready. */
export async function rebuildExtensionSources(records: ExtensionRecord[]): Promise<void> {
  const sources: Source[] = [];

  for (const record of records) {
    if (!record.enabled) continue;
    const runtime = getRuntime(record.id);
    if (!runtime) continue;

    try {
      const manifest = await runtime.ready;
      sources.push(createExtensionSource(manifest, runtime));
    } catch (error) {
      console.warn(`Extension "${record.id}" failed to load`, error);
    }
  }

  setExtensionSources(sources);
}
