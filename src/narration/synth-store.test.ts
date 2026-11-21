import { beforeEach, describe, expect, it, vi } from 'vitest';

import { discardSynthTemp } from './synth-store';

const files = vi.hoisted(() => new Set<string>());

vi.mock('expo-file-system', () => ({
  File: class {
    constructor(public uri: string) {}
    get exists() {
      return files.has(this.uri);
    }
    delete() {
      files.delete(this.uri);
    }
  },
  Directory: class {},
  Paths: { cache: { uri: 'file:///cache/' } },
}));

vi.mock('expo-crypto', () => ({}));

describe('discardSynthTemp', () => {
  beforeEach(() => {
    files.clear();
  });

  it('removes a failed synthesis at its original path', () => {
    files.add('file:///cache/tmp-clip.wav');

    discardSynthTemp('file:///cache/tmp-clip.wav');

    expect(files.has('file:///cache/tmp-clip.wav')).toBe(false);
  });

  it('leaves the moved cache clip alone', () => {
    // expo-file-system rewrites the source File URI on move(), so cleanup must
    // use the path captured before the move.
    files.add('file:///cache/clip.wav');

    discardSynthTemp('file:///cache/tmp-clip.wav');

    expect(files.has('file:///cache/clip.wav')).toBe(true);
  });
});
