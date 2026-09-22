import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import type { SearchFilters } from '@/sources';
import {
  browse,
  getStoryDetails,
  getStoryPages,
  search,
  type BrowseKind,
} from '@/services/catalog';
import { loadProgress } from '@/services/reading';
import { getSource } from '@/services/source-manager';

export const queryKeys = {
  browse: (sourceId: string, kind: BrowseKind, category?: string) =>
    ['browse', sourceId, kind, category ?? null] as const,
  search: (sourceId: string, filters: SearchFilters) => ['search', sourceId, filters] as const,
  story: (sourceId: string, id: string) => ['story', sourceId, id] as const,
  pages: (sourceId: string, id: string) => ['pages', sourceId, id] as const,
  progress: (sourceId: string, id: string) => ['progress', sourceId, id] as const,
  categories: (sourceId: string) => ['categories', sourceId] as const,
  tags: (sourceId: string) => ['tags', sourceId] as const,
};

export function useBrowse(sourceId: string, kind: BrowseKind, category?: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.browse(sourceId, kind, category),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => browse(sourceId, kind, pageParam, category),
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
  });
}

export function useSearch(sourceId: string, filters: SearchFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.search(sourceId, filters),
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => search(sourceId, filters, pageParam),
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
  });
}

export function useStoryDetails(sourceId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.story(sourceId, id),
    queryFn: () => getStoryDetails(sourceId, id, { includeContent: false }),
    enabled: Boolean(sourceId && id),
  });
}

export function useStoryPages(sourceId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.pages(sourceId, id),
    queryFn: () => getStoryPages(sourceId, id),
    enabled: Boolean(sourceId && id),
    staleTime: Infinity,
  });
}

export function useReadingProgress(sourceId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.progress(sourceId, id),
    queryFn: () => loadProgress(sourceId, id),
    enabled: Boolean(sourceId && id),
  });
}

export function useCategories(sourceId: string) {
  return useQuery({
    queryKey: queryKeys.categories(sourceId),
    queryFn: () => getSource(sourceId).getCategories(),
    staleTime: Infinity,
  });
}

export function useTags(sourceId: string) {
  return useQuery({
    queryKey: queryKeys.tags(sourceId),
    queryFn: () => getSource(sourceId).getTags(),
    staleTime: Infinity,
  });
}
