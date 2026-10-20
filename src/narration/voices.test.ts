import { describe, expect, it } from 'vitest';

import {
  groupVoicePacksByLanguage,
  voicePackById,
  voicePacksForEngine,
  VOICE_PACKS,
} from './voice-packs';

describe('voice pack manifest', () => {
  it('has unique ids and https urls', () => {
    const ids = VOICE_PACKS.map((pack) => pack.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pack of VOICE_PACKS) {
      expect(pack.url.startsWith('https://')).toBe(true);
      expect(pack.bytes).toBeGreaterThan(0);
      expect(pack.name.length).toBeGreaterThan(0);
    }
  });

  it('looks up packs by id and engine', () => {
    expect(voicePackById('piper-en-amy-low')?.engine).toBe('piper');
    expect(voicePackById('nope')).toBeNull();
    expect(voicePacksForEngine('piper').length).toBeGreaterThanOrEqual(2);
    expect(voicePacksForEngine('kokoro')).toHaveLength(1);
  });

  it('offers several piper languages with tight int8 downloads', () => {
    const piper = voicePacksForEngine('piper');
    expect(new Set(piper.map((pack) => pack.language)).size).toBeGreaterThanOrEqual(8);
    for (const pack of piper) {
      if (pack.id === 'piper-en-amy-low' || pack.id === 'piper-en-ryan-low') continue;
      expect(pack.url).toContain('-int8.tar.bz2');
      expect(pack.bytes).toBeLessThan(30 * 1024 * 1024);
    }
  });

  it('groups packs under readable language headings', () => {
    const groups = groupVoicePacksByLanguage(voicePacksForEngine('piper'));
    expect(groups.length).toBeGreaterThanOrEqual(8);
    const us = groups.find((group) => group.language === 'en-US');
    expect(us?.label).toBe('English (United States)');
    expect(us?.packs.map((pack) => pack.name)).toEqual([
      'Amy (US English)',
      'Danny (US English)',
      'Kathleen (US English)',
      'Lessac (US English)',
      'LJSpeech (US English)',
      'Ryan (US English)',
    ]);
    const labels = groups.map((group) => group.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en')));
  });
});
