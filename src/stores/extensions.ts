import { create } from 'zustand';

import { extensionsRepository } from '@/db/repositories';
import { fetchExtensionCode } from '@/extensions/http';
import { ExtensionError, validateExtensionUrl, type ExtensionRecord } from '@/extensions/manifest';
import { deleteRuntime, probeExtension } from '@/extensions/runtime';
import { rebuildExtensionSources } from '@/extensions/sources';
import { resetSourceRegistry } from '@/services/source-manager';
import { nowSeconds } from '@/utils/time';

type ExtensionsState = {
  records: ExtensionRecord[];
  isHydrated: boolean;
  isBusy: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  installFromCode: (code: string, sourceUrl?: string | null) => Promise<void>;
  installFromUrl: (url: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  /** Rebuilds the installed sources from the current sandboxes. */
  syncSources: () => Promise<void>;
};

export const useExtensionsStore = create<ExtensionsState>((set, get) => ({
  records: [],
  isHydrated: false,
  isBusy: false,

  async hydrate() {
    if (get().isHydrated) return;
    await get().refresh();
    set({ isHydrated: true });
  },

  async refresh() {
    set({ records: await extensionsRepository.list() });
  },

  async installFromCode(code, sourceUrl = null) {
    set({ isBusy: true });
    try {
      const manifest = await probeExtension(code);
      const existing = await extensionsRepository.get(manifest.id);
      const now = nowSeconds();

      await extensionsRepository.upsert({
        id: manifest.id,
        manifest,
        code,
        enabled: true,
        sourceUrl: sourceUrl ?? existing?.sourceUrl ?? null,
        installedAt: existing?.installedAt ?? now,
        updatedAt: now,
      });

      await get().refresh();
    } finally {
      set({ isBusy: false });
    }
  },

  async installFromUrl(url) {
    const validated = validateExtensionUrl(url);
    set({ isBusy: true });
    try {
      let code: string;
      try {
        code = await fetchExtensionCode(validated);
      } catch (error) {
        throw new ExtensionError(
          `Could not download the extension: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      await useExtensionsStore.getState().installFromCode(code, validated);
    } finally {
      set({ isBusy: false });
    }
  },

  async remove(id) {
    await extensionsRepository.remove(id);
    deleteRuntime(id);
    await get().refresh();
    await get().syncSources();
  },

  async setEnabled(id, enabled) {
    await extensionsRepository.setEnabled(id, enabled);
    if (!enabled) deleteRuntime(id);
    await get().refresh();
    await get().syncSources();
  },

  async syncSources() {
    await rebuildExtensionSources(get().records);
    resetSourceRegistry();
  },
}));
