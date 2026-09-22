import { describe, expect, it } from 'vitest';

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
  type BackupEnvelope,
} from './format';

const envelope: BackupEnvelope = {
  magic: BACKUP_MAGIC,
  version: BACKUP_VERSION,
  createdAt: 1000,
  app: '0.1.0',
  device: 'test-device',
  data: {
    levels: ['meta'],
    library: [{ sourceId: 'literotica', storyId: '1', addedAt: 1, isUnread: true }],
    stories: [{ sourceId: 'literotica', id: '1', title: 'A Tale', flags: {} }],
    progress: [],
    history: [],
    pages: [],
    downloads: [],
    settings: { theme: 'dark' },
    sources: [],
  },
};

const toBytes = (text: string) => new TextEncoder().encode(text);

describe('backup encoding', () => {
  it('round-trips through gzip', () => {
    const decoded = decodeBackup(encodeBackup(envelope));
    expect(decoded.magic).toBe(BACKUP_MAGIC);
    expect(decoded.version).toBe(BACKUP_VERSION);
    expect(decoded.data.library).toHaveLength(1);
    expect(decoded.data.stories[0].title).toBe('A Tale');
    expect(decoded.data.settings).toEqual({ theme: 'dark' });
  });

  it('accepts a plain (uncompressed) JSON backup', () => {
    const decoded = decodeBackup(toBytes(JSON.stringify(envelope)));
    expect(decoded.data.library).toHaveLength(1);
  });

  it('defaults missing scopes for older backups', () => {
    const legacy = JSON.stringify({
      ...envelope,
      data: {
        library: envelope.data.library,
        stories: envelope.data.stories,
        progress: [],
        history: [],
        settings: {},
        sources: [],
      },
    });
    const decoded = decodeBackup(toBytes(legacy));
    expect(decoded.data.levels).toEqual(['meta']);
    expect(decoded.data.pages).toEqual([]);
    expect(decoded.data.downloads).toEqual([]);
  });

  it('rejects files that are not JSON', () => {
    expect(() => decodeBackup(toBytes('definitely not json'))).toThrow(BackupError);
  });

  it('rejects a file with the wrong magic marker', () => {
    const foreign = JSON.stringify({ ...envelope, magic: 'something-else' });
    expect(() => decodeBackup(toBytes(foreign))).toThrow(BackupError);
  });

  it('rejects a backup from a newer version', () => {
    const newer = JSON.stringify({ ...envelope, version: BACKUP_VERSION + 1 });
    try {
      decodeBackup(toBytes(newer));
      throw new Error('expected decodeBackup to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BackupError);
      expect((error as BackupError).reason).toBe('unsupported_version');
    }
  });
});

describe('backup filenames', () => {
  it('stamps the date and time', () => {
    expect(backupFilename(new Date(2026, 0, 2, 3, 4, 5))).toBe(
      'master-reader-backup-20260102-030405.json.gz',
    );
  });

  it('recognises only its own files', () => {
    expect(isBackupFilename('master-reader-backup-20260102-030405.json.gz')).toBe(true);
    expect(isBackupFilename('random.json')).toBe(false);
    expect(isBackupFilename('master-reader-backup.json')).toBe(false);
  });
});

describe('selectBackupsToPrune', () => {
  const files = [
    'master-reader-backup-20260101-000000.json.gz',
    'master-reader-backup-20260102-000000.json.gz',
    'master-reader-backup-20260103-000000.json.gz',
    'master-reader-backup-20260104-000000.json.gz',
    'notes.txt',
  ];

  it('returns the oldest files beyond the keep count', () => {
    expect(selectBackupsToPrune(files, 2)).toEqual([
      'master-reader-backup-20260101-000000.json.gz',
      'master-reader-backup-20260102-000000.json.gz',
    ]);
  });

  it('returns nothing when under the limit', () => {
    expect(selectBackupsToPrune(files, 10)).toEqual([]);
  });
});

describe('libraryToCsv', () => {
  it('writes a header and escapes values', () => {
    const csv = libraryToCsv([
      {
        title: 'A, "Tale"',
        author: 'Anne',
        category: 'Romance',
        sourceId: 'literotica',
        storyId: '1',
        url: 'https://example.test/s/1',
        addedAt: '2026-01-02T03:04:05.000Z',
        progressPercent: 50,
      },
    ]);

    const lines = csv.split('\n');
    expect(lines[0]).toBe('title,author,category,sourceId,storyId,url,addedAt,progressPercent');
    expect(lines[1]).toContain('"A, ""Tale"""');
    expect(lines[1]).toContain(',50');
  });

  it('leaves unknown progress empty', () => {
    const csv = libraryToCsv([
      {
        title: 'T',
        author: '',
        category: '',
        sourceId: 'literotica',
        storyId: '1',
        url: '',
        addedAt: '2026-01-02T00:00:00.000Z',
        progressPercent: null,
      },
    ]);
    expect(csv.split('\n')[1].endsWith(',')).toBe(true);
  });
});
