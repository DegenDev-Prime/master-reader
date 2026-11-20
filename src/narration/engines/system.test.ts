import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SynthError } from '../clip-worker';
import * as synthStore from '../synth-store';
import { createSystemSynthesizer } from './system';

const native = vi.hoisted(() => ({ module: null as unknown }));
const file = vi.hoisted(() => ({ exists: false, size: 0, deleted: 0 }));

vi.mock('../native/system-tts', () => ({
  getSystemTtsModule: () => native.module,
  systemTtsAvailable: () => Boolean(native.module && (native.module as FakeModule).isAvailable()),
}));

vi.mock('../synth-store', () => ({
  synthCacheKey: vi.fn(async (engine: string, voice: string, text: string) => {
    return `${engine}|${voice}|${text}`;
  }),
  synthCachePath: vi.fn(async () => null),
  synthCacheStore: vi.fn(async (key: string) => {
    file.exists = false;
    return `file:///cache/${key}`;
  }),
  synthTempFile: () => ({
    uri: 'file:///tmp/system.wav',
    get exists() {
      return file.exists;
    },
    get size() {
      return file.size;
    },
    delete() {
      file.deleted += 1;
      file.exists = false;
    },
  }),
}));

type FakeModule = {
  isAvailable: () => boolean;
  warmup: () => Promise<void>;
  getVoices: () => Promise<unknown[]>;
  synthesize: (text: string, voiceId: string | null, path: string) => Promise<void>;
  release: () => Promise<void>;
};

function moduleWith(synthesize: FakeModule['synthesize']): FakeModule {
  return {
    isAvailable: () => true,
    warmup: async () => {},
    getVoices: async () => [],
    synthesize,
    release: async () => {},
  };
}

describe('system synthesizer', () => {
  beforeEach(() => {
    native.module = null;
    file.exists = false;
    file.size = 0;
    file.deleted = 0;
    vi.mocked(synthStore.synthCachePath).mockResolvedValue(null);
  });

  it('writes through the native engine and keys the cache by voice', async () => {
    let seen: [string, string | null, string] | null = null;
    native.module = moduleWith(async (text, voiceId, path) => {
      seen = [text, voiceId, path];
      file.exists = true;
      file.size = 1234;
    });

    const synth = createSystemSynthesizer({ getVoiceId: () => 'en-us-x' });
    const result = await synth.synthesize('Hello there');

    expect(seen).toEqual(['Hello there', 'en-us-x', 'file:///tmp/system.wav']);
    expect(result.uri).toBe('file:///cache/system|en-us-x|Hello there');
    expect(synthStore.synthCacheKey).toHaveBeenCalledWith('system', 'en-us-x', 'Hello there');
  });

  it('uses the engine default voice when none is selected', async () => {
    native.module = moduleWith(async () => {
      file.exists = true;
      file.size = 10;
    });
    const synth = createSystemSynthesizer({ getVoiceId: () => null });

    await synth.synthesize('Hi');

    expect(synthStore.synthCacheKey).toHaveBeenCalledWith('system', 'default', 'Hi');
  });

  it('returns a cached clip without touching the native engine', async () => {
    vi.mocked(synthStore.synthCachePath).mockResolvedValueOnce('file:///cached.wav');
    const synthesize = vi.fn(async () => {});
    native.module = moduleWith(synthesize);

    const synth = createSystemSynthesizer({ getVoiceId: () => null });
    await expect(synth.synthesize('Hi')).resolves.toEqual({
      uri: 'file:///cached.wav',
      durationMs: null,
    });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('treats a missing native module as permanent', async () => {
    const synth = createSystemSynthesizer({ getVoiceId: () => null });

    await expect(synth.synthesize('Hi')).rejects.toMatchObject({
      name: 'SynthError',
      permanent: true,
    });
  });

  it('treats an engine init failure as permanent and cleans the temp file', async () => {
    native.module = moduleWith(async () => {
      file.exists = true;
      const error = new Error('init failed') as Error & { code: string };
      error.code = 'TTS_INIT';
      throw error;
    });

    const synth = createSystemSynthesizer({ getVoiceId: () => null });
    const failure = synth.synthesize('Hi');

    await expect(failure).rejects.toBeInstanceOf(SynthError);
    await expect(failure).rejects.toMatchObject({ permanent: true });
    expect(file.deleted).toBe(1);
  });

  it('retries a synth failure that is not an engine failure', async () => {
    native.module = moduleWith(async () => {
      file.exists = true;
      const error = new Error('busy') as Error & { code: string };
      error.code = 'TTS_SYNTH';
      throw error;
    });

    const synth = createSystemSynthesizer({ getVoiceId: () => null });

    await expect(synth.synthesize('Hi')).rejects.toMatchObject({
      name: 'SynthError',
      permanent: false,
    });
  });
});
