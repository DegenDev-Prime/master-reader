import { getExtensionSources } from '@/extensions/sources';
import { createLiteroticaSource, SourceRegistry, type Source } from '@/sources';
import { useSettingsStore } from '@/stores/settings';

import { responseCache } from './response-cache';

export const DEFAULT_SOURCE_ID = 'literotica';

function isOffline(): boolean {
  return useSettingsStore.getState().settings.offlineMode;
}

let registry: SourceRegistry | undefined;

export function getSourceRegistry(): SourceRegistry {
  registry ??= buildRegistry();
  return registry;
}

export function getSource(sourceId: string): Source {
  return getSourceRegistry().require(sourceId);
}

/** Drops the cached registry so newly installed/removed extensions take effect. */
export function resetSourceRegistry(): void {
  registry = undefined;
}

function buildRegistry(): SourceRegistry {
  const registry = new SourceRegistry();
  registry.register(createLiteroticaSource({ cache: responseCache, isOffline }));

  for (const source of getExtensionSources()) {
    registry.register(source);
  }

  return registry;
}
