import { describe, expect, it } from 'vitest';

import type { Download } from '@/models/story';

import { decideStaleDownloadRows } from './download-recovery';

const row = (sourceId: string, storyId: string, status: Download['status']): Download => ({
  sourceId,
  storyId,
  status,
  downloadedPages: 3,
  totalPages: 12,
  sizeBytes: 4096,
  path: null,
  error: null,
  startedAt: 1000,
  completedAt: null,
});

describe('decideStaleDownloadRows', () => {
  it('re-queues rows stuck in downloading, preserving their identity', () => {
    const stuck = row('royalroad', '7', 'downloading');
    const result = decideStaleDownloadRows([stuck]);
    expect(result).toEqual([stuck]);
    // The caller re-queues by spreading: every field must ride along.
    expect(Object.keys(result[0])).toContain('sizeBytes');
  });

  it('never re-queues completed, failed, queued or paused rows', () => {
    const rows = [
      row('royalroad', '1', 'completed'),
      row('royalroad', '2', 'failed'),
      row('royalroad', '3', 'queued'),
      row('royalroad', '4', 'paused'),
    ];
    expect(decideStaleDownloadRows(rows)).toEqual([]);
  });

  it('picks only the downloading subset out of a mixed list', () => {
    const a = row('royalroad', '1', 'downloading');
    const b = row('royalroad', '2', 'completed');
    const c = row('novelfire', '9', 'downloading');
    const result = decideStaleDownloadRows([a, b, c]);
    expect(result.map((entry) => `${entry.sourceId}:${entry.storyId}`)).toEqual([
      'royalroad:1',
      'novelfire:9',
    ]);
  });

  it('handles an empty repository', () => {
    expect(decideStaleDownloadRows([])).toEqual([]);
  });
});
