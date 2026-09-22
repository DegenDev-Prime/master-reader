import type { Story, StoryPage } from '@/models/story';
import type {
  Category,
  GetStoryOptions,
  PageRequest,
  PagedResult,
  SearchFilters,
  Source,
  SourceInfo,
  StoryDetails,
} from '@/sources/types';

import type { ExtensionManifest } from './manifest';
import type { ExtensionRuntime } from './runtime';

function normalizeStory(manifest: ExtensionManifest, raw: Record<string, unknown>): Story {
  return {
    ...(raw as unknown as Story),
    sourceId: manifest.id,
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    flags: (raw.flags as Story['flags']) ?? {},
  };
}

function normalizePages(manifest: ExtensionManifest, storyId: string, raw: unknown): StoryPage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((page, index) => {
    const item = (page ?? {}) as Record<string, unknown>;
    return {
      sourceId: manifest.id,
      storyId: String(item.storyId ?? storyId),
      index: typeof item.index === 'number' ? item.index : index,
      title: (item.title as string | null) ?? null,
      content: (item.content as string | null) ?? null,
      wordCount: (item.wordCount as number | null) ?? null,
    };
  });
}

/**
 * Adapts a sandboxed extension to the built-in `Source` contract so extensions
 * flow through the same catalog, caching, library and reader code paths.
 */
export function createExtensionSource(
  manifest: ExtensionManifest,
  runtime: ExtensionRuntime,
): Source {
  const call = async <T>(method: string, args: unknown[]): Promise<T> => {
    await runtime.ready;
    return (await runtime.call(method, args)) as T;
  };

  const paged = async (method: string, args: unknown[]): Promise<PagedResult<Story>> => {
    const raw = await call<PagedResult<Story>>(method, args);
    return {
      items: (raw?.items ?? []).map((item) =>
        normalizeStory(manifest, item as unknown as Record<string, unknown>),
      ),
      page: raw?.page ?? 1,
      hasNext: Boolean(raw?.hasNext),
      total: raw?.total,
    };
  };

  const info: SourceInfo = {
    id: manifest.id,
    name: manifest.name,
    lang: manifest.lang,
    baseUrl: manifest.baseUrl,
    capabilities: manifest.capabilities,
  };

  return {
    info,
    getPopular: (request: PageRequest = {}) => paged('getPopular', [request]),
    getLatest: (request: PageRequest = {}) => paged('getLatest', [request]),
    search: (filters: SearchFilters, request: PageRequest = {}) =>
      paged('search', [filters, request]),
    getStory: async (id: string, options: GetStoryOptions = {}) => {
      const raw = await call<(StoryDetails & { pages?: unknown[] }) | null>('getStory', [
        id,
        options,
      ]);
      if (!raw) return null;
      const story = normalizeStory(manifest, raw as unknown as Record<string, unknown>);
      return {
        ...story,
        seriesId: (raw.seriesId as string | null) ?? null,
        seriesTitle: (raw.seriesTitle as string | null) ?? null,
        pages:
          options.includeContent === false ? undefined : normalizePages(manifest, id, raw.pages),
      };
    },
    getTags: () => call<string[]>('getTags', []),
    getCategories: () => call<Category[]>('getCategories', []),
    isLoggedIn: () => false,
  };
}
