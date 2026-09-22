import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';

import type {
  Download,
  HistoryEntry,
  LibraryEntry,
  ReadingProgress,
  Story,
  StoryPage,
} from '@/models/story';
import type { BackupLevel } from '@/services/settings';

export const BACKUP_MAGIC = 'masterreader-backup';
export const BACKUP_VERSION = 1;

export class BackupError extends Error {
  readonly reason: 'invalid' | 'unsupported_version' | 'encoding';

  constructor(message: string, reason: 'invalid' | 'unsupported_version' | 'encoding' = 'invalid') {
    super(message);
    this.name = 'BackupError';
    this.reason = reason;
  }
}

export type BackupData = {
  /** Scopes that were captured in this backup. */
  levels: BackupLevel[];
  library: LibraryEntry[];
  stories: Story[];
  progress: ReadingProgress[];
  history: HistoryEntry[];
  /** Page content, present for the `stories`/`downloads` scopes. */
  pages: StoryPage[];
  /** Download records, present for the `downloads` scope. */
  downloads: Download[];
  settings: Record<string, unknown>;
  sources: Record<string, unknown>[];
};

export type BackupEnvelope = {
  magic: string;
  version: number;
  /** unix seconds */
  createdAt: number;
  app: string;
  device?: string | null;
  data: BackupData;
};

const storySchema = z.looseObject({
  sourceId: z.string(),
  id: z.string(),
  title: z.string(),
  flags: z.record(z.string(), z.unknown()).optional(),
});

const backupEnvelopeSchema = z.looseObject({
  magic: z.string(),
  version: z.number(),
  createdAt: z.number(),
  app: z.string(),
  device: z.string().nullish(),
  data: z.looseObject({
    levels: z.array(z.string()).nullish(),
    library: z.array(z.looseObject({ sourceId: z.string(), storyId: z.string() })),
    stories: z.array(storySchema),
    progress: z.array(z.looseObject({ sourceId: z.string(), storyId: z.string() })),
    history: z.array(z.looseObject({ id: z.string(), sourceId: z.string(), storyId: z.string() })),
    pages: z
      .array(z.looseObject({ sourceId: z.string(), storyId: z.string(), index: z.number() }))
      .nullish(),
    downloads: z
      .array(z.looseObject({ sourceId: z.string(), storyId: z.string(), status: z.string() }))
      .nullish(),
    settings: z.record(z.string(), z.unknown()),
    sources: z.array(z.record(z.string(), z.unknown())).nullish(),
  }),
});

export function encodeBackup(envelope: BackupEnvelope): Uint8Array {
  const json = JSON.stringify(envelope);
  return gzipSync(strToU8(json));
}

export function decodeBackup(bytes: Uint8Array): BackupEnvelope {
  let json: string;
  try {
    json = strFromU8(gunzipSync(bytes));
  } catch {
    // Not gzipped — accept a plain JSON backup too.
    json = strFromU8(bytes);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupError('The file is not valid JSON.', 'encoding');
  }

  const result = backupEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    throw new BackupError('The file is not a Master Reader backup.');
  }
  if (result.data.magic !== BACKUP_MAGIC) {
    throw new BackupError('The file is not a Master Reader backup.');
  }
  if (result.data.version > BACKUP_VERSION) {
    throw new BackupError(
      `This backup was created by a newer version (v${result.data.version}).`,
      'unsupported_version',
    );
  }

  return {
    ...result.data,
    data: {
      levels: (result.data.data.levels ?? ['meta']) as BackupLevel[],
      library: result.data.data.library as LibraryEntry[],
      stories: result.data.data.stories as unknown as Story[],
      progress: result.data.data.progress as ReadingProgress[],
      history: result.data.data.history as HistoryEntry[],
      pages: (result.data.data.pages ?? []) as StoryPage[],
      downloads: (result.data.data.downloads ?? []) as Download[],
      settings: result.data.data.settings,
      sources: (result.data.data.sources ?? []) as Record<string, unknown>[],
    },
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function backupFilename(date = new Date()): string {
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `master-reader-backup-${stamp}.json.gz`;
}

export function isBackupFilename(name: string): boolean {
  return /^master-reader-backup-\d{8}-\d{6}\.json\.gz$/.test(name);
}

/** Returns the oldest backup filenames that should be removed to keep `keepCount`. */
export function selectBackupsToPrune(filenames: string[], keepCount: number): string[] {
  const backups = filenames.filter(isBackupFilename).sort();
  const excess = backups.length - Math.max(0, keepCount);
  return excess > 0 ? backups.slice(0, excess) : [];
}

export type LibraryCsvRow = {
  title: string;
  author: string;
  category: string;
  sourceId: string;
  storyId: string;
  url: string;
  addedAt: string;
  progressPercent: number | null;
};

const CSV_HEADER = [
  'title',
  'author',
  'category',
  'sourceId',
  'storyId',
  'url',
  'addedAt',
  'progressPercent',
];

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function libraryToCsv(rows: LibraryCsvRow[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.title,
        row.author,
        row.category,
        row.sourceId,
        row.storyId,
        row.url,
        row.addedAt,
        row.progressPercent,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}
