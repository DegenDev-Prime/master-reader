import { create } from 'zustand';

import { settingsRepository } from '@/db/repositories';
import { defaultSettings, mergeSettings, type AppSettings } from '@/services/settings';

type SettingsState = {
  settings: AppSettings;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  reload: () => Promise<void>;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  setMany: (values: Partial<AppSettings>) => Promise<void>;
  reset: () => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isHydrated: false,

  async hydrate() {
    if (get().isHydrated) return;
    const stored = await settingsRepository.getAll();
    set({ settings: mergeSettings(stored), isHydrated: true });
  },

  async reload() {
    const stored = await settingsRepository.getAll();
    set({ settings: mergeSettings(stored), isHydrated: true });
  },

  async setSetting(key, value) {
    set((state) => ({ settings: { ...state.settings, [key]: value } }));
    await settingsRepository.set(key, value);
  },

  async setMany(values) {
    set((state) => ({ settings: { ...state.settings, ...values } }));
    await settingsRepository.setMany(values as Record<string, unknown>);
  },

  async reset() {
    set({ settings: defaultSettings });
    await settingsRepository.setMany(defaultSettings as unknown as Record<string, unknown>);
  },
}));
