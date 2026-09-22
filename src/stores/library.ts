import { create } from 'zustand';

import type { LibraryStory } from '@/db/repositories';
import type { Story } from '@/models/story';
import * as libraryService from '@/services/library';

export const libraryKey = (sourceId: string, id: string) => `${sourceId}:${id}`;

type LibraryState = {
  stories: LibraryStory[];
  keys: Set<string>;
  isHydrated: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  add: (story: Story) => Promise<void>;
  remove: (sourceId: string, id: string) => Promise<void>;
  contains: (sourceId: string, id: string) => boolean;
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  stories: [],
  keys: new Set<string>(),
  isHydrated: false,
  isLoading: false,

  async hydrate() {
    if (get().isHydrated) return;
    await get().refresh();
    set({ isHydrated: true });
  },

  async refresh() {
    set({ isLoading: true });
    try {
      const stories = await libraryService.listLibrary();
      set({
        stories,
        keys: new Set(stories.map((item) => libraryKey(item.entry.sourceId, item.entry.storyId))),
      });
    } finally {
      set({ isLoading: false });
    }
  },

  async add(story) {
    await libraryService.addToLibrary(story);
    await get().refresh();
  },

  async remove(sourceId, id) {
    await libraryService.removeFromLibrary(sourceId, id);
    await get().refresh();
  },

  contains(sourceId, id) {
    return get().keys.has(libraryKey(sourceId, id));
  },
}));
