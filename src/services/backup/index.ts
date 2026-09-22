import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {
  downloadsRepository,
  historyRepository,
  libraryRepository,
  pagesRepository,
  progressRepository,
  settingsRepository,
  sourcesRepository,
  storiesRepository,
  type NewSourceRow,
} from '@/db/repositories';
import type { Story, StoryPage } from '@/models/story';
import type { BackupLevel } from '@/services/settings';
import { useSettingsStore } from '@/stores/settings';
import { nowSeconds } from '@/utils/time';

import {
  BACKUP_MAGIC,
  BACKUP_VERSION,
  BackupError,
  backupFilename,
  decodeBackup,
  encodeBackup,
  isBackupFilename,
  libraryToCsv,
  selectBackupsToPrune,
  type BackupData,
  type BackupEnvelope,
  type LibraryCsvRow,
} from './format';
import { emptyCounts, shouldImport, type RestoreCounts, type RestoreMode } from './merge';

export { BackupError } from './format';
export type { BackupEnvelope } from './format';
export type { RestoreMode, RestoreCounts } from './merge';

async function collectStories(keys: Iterable<string>): Promise<Story[]> {
  const idsBySource = new Map<string, Set<string>>();
  for (const key of keys) {
    const separator = key.indexOf(':');
    if (separator === -1) continue;
    const sourceId = key.slice(0, separator);
    const id = key.slice(separator + 1);
    const ids = idsBySource.get(sourceId) ?? new Set<string>();
    ids.add(id);
    idsBySource.set(sourceId, ids);
  }

  const stories: Story[] = [];
  for (const [sourceId, ids] of idsBySource) {
    stories.push(...(await storiesRepository.listByIds(sourceId, [...ids])));
  }
  return stories;
}

export async function createBackupData(
  levels: BackupLevel[] = ['meta', 'history'],
): Promise<BackupData> {
  const selected = new Set<BackupLevel>(levels);
  const wantMeta = selected.has('meta');
  const wantHistory = selected.has('history');
  const wantStories = selected.has('stories');
  const wantDownloads = selected.has('downloads');

  const [library, progress, history, settings, sources, downloads] = await Promise.all([
    wantMeta ? libraryRepository.listEntries() : Promise.resolve([]),
    wantMeta ? progressRepository.listAll() : Promise.resolve([]),
    wantHistory ? historyRepository.listAll() : Promise.resolve([]),
    wantMeta ? settingsRepository.getAll() : Promise.resolve({}),
    wantMeta ? sourcesRepository.list() : Promise.resolve([]),
    wantDownloads ? downloadsRepository.list() : Promise.resolve([]),
  ]);

  const keys = new Set<string>();
  if (wantMeta) {
    for (const entry of library) keys.add(`${entry.sourceId}:${entry.storyId}`);
    for (const item of progress) keys.add(`${item.sourceId}:${item.storyId}`);
  }
  if (wantHistory) {
    for (const item of history) keys.add(`${item.sourceId}:${item.storyId}`);
  }

  const pages: StoryPage[] = [];
  if (wantStories) {
    for (const entry of library) {
      keys.add(`${entry.sourceId}:${entry.storyId}`);
      pages.push(...(await pagesRepository.listForStory(entry.sourceId, entry.storyId)));
    }
  }
  if (wantDownloads) {
    for (const download of downloads) {
      keys.add(`${download.sourceId}:${download.storyId}`);
      pages.push(...(await pagesRepository.listForStory(download.sourceId, download.storyId)));
    }
  }

  return {
    levels,
    library,
    stories: await collectStories(keys),
    progress,
    history,
    pages,
    downloads,
    settings,
    sources: sources as unknown as Record<string, unknown>[],
  };
}

export async function createBackupEnvelope(levels?: BackupLevel[]): Promise<BackupEnvelope> {
  const scope = levels ?? useSettingsStore.getState().settings.backup.levels;
  return {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    createdAt: nowSeconds(),
    app: Constants.expoConfig?.version ?? '0.0.0',
    device: Device.modelName ?? null,
    data: await createBackupData(scope),
  };
}

async function writeEnvelopeToFile(file: File, envelope: BackupEnvelope): Promise<void> {
  if (file.exists) file.delete();
  file.create();
  file.write(encodeBackup(envelope));
}

export async function exportBackupFile(levels?: BackupLevel[]): Promise<string> {
  const file = new File(Paths.cache, backupFilename());
  await writeEnvelopeToFile(file, await createBackupEnvelope(levels));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/gzip',
      dialogTitle: 'Export Master Reader backup',
    });
  }
  return file.uri;
}

export async function exportLibraryCsv(): Promise<string> {
  const [library, progress] = await Promise.all([
    libraryRepository.listEntries(),
    progressRepository.listAll(),
  ]);

  const stories = await collectStories(library.map((e) => `${e.sourceId}:${e.storyId}`));
  const storyMap = new Map(stories.map((story) => [`${story.sourceId}:${story.id}`, story]));
  const progressMap = new Map(progress.map((item) => [`${item.sourceId}:${item.storyId}`, item]));

  const rows: LibraryCsvRow[] = library.map((entry) => {
    const story = storyMap.get(`${entry.sourceId}:${entry.storyId}`);
    const saved = progressMap.get(`${entry.sourceId}:${entry.storyId}`);
    return {
      title: story?.title ?? '',
      author: story?.authorName ?? '',
      category: story?.categoryName ?? '',
      sourceId: entry.sourceId,
      storyId: entry.storyId,
      url: story?.url ?? '',
      addedAt: new Date(entry.addedAt * 1000).toISOString(),
      progressPercent:
        saved?.pageCount && saved.pageCount > 0
          ? Math.round(((saved.pageIndex + 1) / saved.pageCount) * 100)
          : null,
    };
  });

  const file = new File(Paths.cache, 'master-reader-library.csv');
  if (file.exists) file.delete();
  file.create();
  file.write(libraryToCsv(rows));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export library CSV' });
  }
  return file.uri;
}

/** Opens the system folder picker and returns the chosen SAF directory URI. */
export async function pickBackupFolder(): Promise<string | null> {
  const directory = await Directory.pickDirectoryAsync();
  return directory.uri ?? null;
}

export async function listBackupsInFolder(folderUri: string): Promise<string[]> {
  const directory = new Directory(folderUri);
  if (!directory.exists) return [];
  return directory
    .list()
    .map((item) => item.name)
    .filter(isBackupFilename)
    .sort()
    .reverse();
}

async function writeBackupToFolder(folderUri: string, envelope: BackupEnvelope): Promise<string> {
  const directory = new Directory(folderUri);
  const name = backupFilename();
  const file = directory.createFile(name, 'application/gzip');
  file.write(encodeBackup(envelope));
  return name;
}

async function pruneFolderBackups(folderUri: string, keepCount: number): Promise<void> {
  const directory = new Directory(folderUri);
  if (!directory.exists) return;

  const names = directory.list().map((item) => item.name);
  for (const name of selectBackupsToPrune(names, keepCount)) {
    const file = new File(directory, name);
    if (file.exists) file.delete();
  }
}

/** Writes a backup into the configured folder, prunes old ones and records the time. */
export async function backupNow(): Promise<string> {
  const { backup } = useSettingsStore.getState().settings;
  if (!backup.folderUri) {
    throw new BackupError('Choose a backup folder first.');
  }

  const name = await writeBackupToFolder(backup.folderUri, await createBackupEnvelope());
  await pruneFolderBackups(backup.folderUri, backup.keepCount);
  await useSettingsStore.getState().setSetting('backup', { ...backup, lastBackupAt: nowSeconds() });
  return name;
}

/** Runs an automatic backup when auto-backup is enabled and the interval has elapsed. */
export async function runAutoBackupIfDue(): Promise<string | null> {
  const { backup } = useSettingsStore.getState().settings;
  if (!backup.autoBackup || !backup.folderUri) return null;

  const dueAt = (backup.lastBackupAt ?? 0) + backup.intervalHours * 3600;
  if (nowSeconds() < dueAt) return null;

  return backupNow();
}

export async function pickBackupFile(): Promise<string | null> {
  const result = await File.pickFileAsync({
    mimeTypes: ['application/gzip', 'application/octet-stream', '*/*'],
  });
  if (result.canceled) return null;
  return result.result.uri;
}

export async function restoreBackup(
  envelope: BackupEnvelope,
  mode: RestoreMode,
): Promise<RestoreCounts> {
  const counts = emptyCounts();

  // Stories first so library and history entries resolve to real metadata.
  await storiesRepository.upsertMany(envelope.data.stories);
  if (envelope.data.pages.length > 0) await pagesRepository.upsertMany(envelope.data.pages);
  for (const download of envelope.data.downloads) await downloadsRepository.upsert(download);

  if (mode === 'replace') {
    await libraryRepository.clear();
    await progressRepository.clear();
    await historyRepository.clear();
  }

  for (const entry of envelope.data.library) {
    if (shouldImport(await libraryRepository.contains(entry.sourceId, entry.storyId), mode)) {
      await libraryRepository.upsert(entry);
      counts.imported += 1;
    } else {
      counts.skipped += 1;
    }
  }

  for (const progress of envelope.data.progress) {
    const existing = await progressRepository.get(progress.sourceId, progress.storyId);
    if (shouldImport(Boolean(existing), mode)) {
      await progressRepository.upsert(progress);
      counts.imported += 1;
    } else {
      counts.skipped += 1;
    }
  }

  for (const item of envelope.data.history) {
    await historyRepository.upsert(item);
    counts.imported += 1;
  }

  for (const source of envelope.data.sources) {
    await sourcesRepository.upsert(source as unknown as NewSourceRow);
  }

  await settingsRepository.setMany(envelope.data.settings);
  await useSettingsStore.getState().reload();

  return counts;
}

export async function importBackupFromFile(uri: string, mode: RestoreMode): Promise<RestoreCounts> {
  const bytes = await new File(uri).bytes();
  return restoreBackup(decodeBackup(bytes), mode);
}
