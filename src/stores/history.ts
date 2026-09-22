import { create } from 'zustand';

import type { HistoryItem } from '@/services/history';
import * as historyService from '@/services/history';
import { recordHistory } from '@/services/reading';

type HistoryState = {
  items: HistoryItem[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  record: (sourceId: string, storyId: string, pageIndex: number) => Promise<void>;
  clear: () => Promise<void>;
};

export const useHistoryStore = create<HistoryState>((set, get) => ({
  items: [],
  isLoading: false,

  async refresh() {
    set({ isLoading: true });
    try {
      set({ items: await historyService.listRecentHistory() });
    } finally {
      set({ isLoading: false });
    }
  },

  async record(sourceId, storyId, pageIndex) {
    await recordHistory(sourceId, storyId, pageIndex);
    await get().refresh();
  },

  async clear() {
    await historyService.clearHistory();
    set({ items: [] });
  },
}));
