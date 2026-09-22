export type RestoreMode = 'replace' | 'merge' | 'skip';

export type RestoreCounts = {
  imported: number;
  skipped: number;
};

/**
 * Decides whether a record should be applied during restore.
 * `replace` starts from a cleared database, so it always imports; `skip` keeps
 * existing records; `merge` overwrites them.
 */
export function shouldImport(exists: boolean, mode: RestoreMode): boolean {
  if (mode === 'skip') return !exists;
  return true;
}

export function emptyCounts(): RestoreCounts {
  return { imported: 0, skipped: 0 };
}
