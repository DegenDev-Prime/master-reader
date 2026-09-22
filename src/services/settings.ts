import type { ThemePreference } from '@/theme/palettes';

export type ReaderFontFamily = 'system' | 'serif' | 'opendyslexic';
export type ReaderThemeName = 'light' | 'sepia' | 'dark' | 'black';
export type ReaderPagination = 'horizontal' | 'vertical';

/**
 * Backup scopes. `meta` is a fast metadata snapshot; `stories` and `downloads`
 * add page content (heavier); `history` captures reading history only.
 */
export type BackupLevel = 'meta' | 'stories' | 'history' | 'downloads';

export type ReaderSettings = {
  fontFamily: ReaderFontFamily;
  fontSize: number;
  lineHeight: number;
  marginHorizontal: number;
  textAlign: 'left' | 'justify';
  theme: ReaderThemeName;
  pagination: ReaderPagination;
};

export type BackupSettings = {
  /** SAF directory URI chosen by the user, or null when unset. */
  folderUri: string | null;
  autoBackup: boolean;
  intervalHours: number;
  keepCount: number;
  /** Which data scopes to include when creating a backup. */
  levels: BackupLevel[];
  /** unix seconds */
  lastBackupAt: number | null;
};

export type AppSettings = {
  theme: ThemePreference;
  ageConfirmed: boolean;
  offlineMode: boolean;
  cacheLists: boolean;
  checkForLibraryUpdates: boolean;
  checkForAppUpdates: boolean;
  defaultLanguage: string;
  forceNormalList: boolean;
  alternatePagination: boolean;
  onlyShowStoriesInFeed: boolean;
  navigateWithVolumeRocker: boolean;
  enableImmersiveReading: boolean;
  reader: ReaderSettings;
  backup: BackupSettings;
};

export const defaultReaderSettings: ReaderSettings = {
  fontFamily: 'system',
  fontSize: 18,
  lineHeight: 1.6,
  marginHorizontal: 20,
  textAlign: 'left',
  theme: 'light',
  pagination: 'horizontal',
};

export const defaultBackupSettings: BackupSettings = {
  folderUri: null,
  autoBackup: false,
  intervalHours: 24,
  keepCount: 5,
  levels: ['meta', 'history'],
  lastBackupAt: null,
};

export const defaultSettings: AppSettings = {
  theme: 'system',
  ageConfirmed: false,
  offlineMode: false,
  cacheLists: true,
  checkForLibraryUpdates: true,
  checkForAppUpdates: true,
  defaultLanguage: 'en',
  forceNormalList: false,
  alternatePagination: false,
  onlyShowStoriesInFeed: false,
  navigateWithVolumeRocker: false,
  enableImmersiveReading: true,
  reader: defaultReaderSettings,
  backup: defaultBackupSettings,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merges persisted key/value settings over the defaults, one level deep for the
 * nested `reader` and `backup` groups. Unknown keys are ignored and missing keys
 * fall back to defaults, so new settings are always defined after an upgrade.
 */
export function mergeSettings(stored: Record<string, unknown> | null | undefined): AppSettings {
  const result: AppSettings = {
    ...defaultSettings,
    reader: { ...defaultReaderSettings },
    backup: { ...defaultBackupSettings },
  };

  if (!stored) return result;

  const assign = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    result[key] = value;
  };

  for (const key of Object.keys(defaultSettings) as (keyof AppSettings)[]) {
    if (!(key in stored)) continue;
    const value = stored[key];
    if (value === undefined) continue;

    if (key === 'reader' && isRecord(value)) {
      result.reader = { ...result.reader, ...(value as Partial<ReaderSettings>) };
    } else if (key === 'backup' && isRecord(value)) {
      result.backup = { ...result.backup, ...(value as Partial<BackupSettings>) };
    } else {
      assign(key, value as AppSettings[typeof key]);
    }
  }

  return result;
}
