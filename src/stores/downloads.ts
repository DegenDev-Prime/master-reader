import { create } from 'zustand';

import type { Download, Story } from '@/models/story';
import * as downloadsService from '@/services/downloads';
import type { DownloadItem } from '@/services/downloads';

type DownloadsState = {
  items: DownloadItem[];
  isProcessing: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  enqueue: (story: Story) => Promise<void>;
  enqueueMany: (stories: Story[]) => Promise<void>;
  remove: (sourceId: string, id: string) => Promise<void>;
  retry: (sourceId: string, id: string) => Promise<void>;
  process: () => Promise<void>;
  statusOf: (sourceId: string, id: string) => Download | null;
};

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  items: [],
  isProcessing: false,
  isLoading: false,

  async refresh() {
    set({ isLoading: true });
    try {
      set({ items: await downloadsService.listDownloadItems() });
    } finally {
      set({ isLoading: false });
    }
  },

  async enqueue(story) {
    await downloadsService.enqueueDownload(story);
    await get().refresh();
    void get().process();
  },

  async enqueueMany(stories) {
    for (const story of stories) {
      await downloadsService.enqueueDownload(story);
    }
    await get().refresh();
    void get().process();
  },

  async remove(sourceId, id) {
    await downloadsService.removeDownload(sourceId, id);
    await get().refresh();
  },

  async retry(sourceId, id) {
    await downloadsService.retryDownload(sourceId, id);
    await get().refresh();
    void get().process();
  },

  async process() {
    if (get().isProcessing) return;
    set({ isProcessing: true });
    try {
      for (;;) {
        const next = await downloadsService.getNextQueued();
        if (!next) break;
        await downloadsService.runDownload(next.sourceId, next.storyId);
        await get().refresh();
      }
    } finally {
      set({ isProcessing: false });
      await get().refresh();
    }
  },

  statusOf(sourceId, id) {
    return (
      get().items.find(
        (item) => item.download.sourceId === sourceId && item.download.storyId === id,
      )?.download ?? null
    );
  },
}));
