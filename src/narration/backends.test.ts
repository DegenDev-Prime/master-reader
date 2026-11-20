import { describe, expect, it } from 'vitest';

import { narrationBackendKey, resolveNarration } from './backends';
import type { VoicePackDef } from './voice-packs';

const pack = (id: string, engine: 'piper' | 'kokoro'): VoicePackDef => ({
  id,
  engine,
  name: id,
  language: 'en',
  url: 'https://example.test/pack.tar.bz2',
  bytes: 1,
});

const piper = pack('piper-en', 'piper');
const kokoro = pack('kokoro-en', 'kokoro');

describe('resolveNarration', () => {
  it('keeps a requested installed neural pack', () => {
    expect(
      resolveNarration(
        { engine: 'piper', voiceId: piper.id },
        { systemAvailable: true, systemVoiceIds: [], installedPacks: [piper, kokoro] },
      ),
    ).toEqual({ engine: 'piper', pack: piper, fallbackFrom: null });
  });

  it('uses another installed pack for the requested neural engine', () => {
    const other = pack('piper-other', 'piper');
    expect(
      resolveNarration(
        { engine: 'piper', voiceId: 'missing' },
        { systemAvailable: false, systemVoiceIds: [], installedPacks: [other] },
      ),
    ).toEqual({ engine: 'piper', pack: other, fallbackFrom: null });
  });

  it('keeps a valid system voice and ignores an unknown one', () => {
    const facts = { systemAvailable: true, systemVoiceIds: ['en-us-x'], installedPacks: [piper] };
    expect(resolveNarration({ engine: 'system', voiceId: 'en-us-x' }, facts)).toEqual({
      engine: 'system',
      voiceId: 'en-us-x',
      fallbackFrom: null,
    });
    expect(resolveNarration({ engine: 'system', voiceId: 'stale' }, facts)).toEqual({
      engine: 'system',
      voiceId: null,
      fallbackFrom: null,
    });
  });

  it('falls back to a neural pack when the device has no TTS service', () => {
    expect(
      resolveNarration(
        { engine: 'system', voiceId: null },
        { systemAvailable: false, systemVoiceIds: [], installedPacks: [kokoro] },
      ),
    ).toEqual({ engine: 'kokoro', pack: kokoro, fallbackFrom: 'system' });
  });

  it('falls back to system when the requested neural pack is missing', () => {
    expect(
      resolveNarration(
        { engine: 'kokoro', voiceId: kokoro.id },
        { systemAvailable: true, systemVoiceIds: [], installedPacks: [] },
      ),
    ).toEqual({ engine: 'system', voiceId: null, fallbackFrom: 'kokoro' });
  });

  it('falls back to the other neural family before giving up', () => {
    expect(
      resolveNarration(
        { engine: 'kokoro', voiceId: null },
        { systemAvailable: false, systemVoiceIds: [], installedPacks: [piper] },
      ),
    ).toEqual({ engine: 'piper', pack: piper, fallbackFrom: 'kokoro' });
  });

  it('returns null when nothing can speak', () => {
    expect(
      resolveNarration(
        { engine: 'system', voiceId: null },
        { systemAvailable: false, systemVoiceIds: [], installedPacks: [] },
      ),
    ).toBeNull();
  });

  it('keys the backend by engine and voice', () => {
    expect(narrationBackendKey({ engine: 'system', voiceId: null, fallbackFrom: null })).toBe(
      'system:default',
    );
    expect(narrationBackendKey({ engine: 'piper', pack: piper, fallbackFrom: null })).toBe(
      'piper:piper-en',
    );
  });
});
