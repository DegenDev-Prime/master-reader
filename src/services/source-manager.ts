import {
  createKemonoSource,
  createLiteroticaSource,
  createPawchiveSource,
  createNovelBuddySource,
  createNovelFireSource,
  createRoyalRoadSource,
  createScribbleHubSource,
  SourceRegistry,
  type Source,
  type SourceInfo,
} from '@/sources';
import { useSettingsStore } from '@/stores/settings';

import { responseCache } from './response-cache';

export const DEFAULT_SOURCE_ID = 'literotica';

const BUILT_IN_SOURCE_IDS = new Set([
  'kemono',
  'literotica',
  'novelbuddy',
  'novelfire',
  'pawchive',
  'royalroad',
  'scribblehub',
]);

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

/** All registered providers, in list order. */
export function listSources(): Source[] {
  return getSourceRegistry().list();
}

export function listSourceInfos(): SourceInfo[] {
  return listSources().map((source) => source.info);
}

/** The providers the app ships with. */
export function listBuiltInSourceInfos(): SourceInfo[] {
  return listSourceInfos().filter((info) => BUILT_IN_SOURCE_IDS.has(info.id));
}

export function getSourceInfo(sourceId: string): SourceInfo | undefined {
  return getSourceRegistry().get(sourceId)?.info;
}

/** Drops the cached registry so newly installed/removed extensions take effect. */
export function resetSourceRegistry(): void {
  registry = undefined;
}

function buildRegistry(): SourceRegistry {
  const registry = new SourceRegistry();
  const options = { cache: responseCache, isOffline };

  registry.register(createKemonoSource(options));
  registry.register(createLiteroticaSource(options));
  registry.register(createPawchiveSource(options));
  registry.register(createNovelBuddySource(options));
  registry.register(createNovelFireSource(options));
  registry.register(createRoyalRoadSource());
  registry.register(createScribbleHubSource());

  return registry;
}
