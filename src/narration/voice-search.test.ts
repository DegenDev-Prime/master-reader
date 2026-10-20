import { describe, expect, it } from 'vitest';

import type { VoiceInfo } from './types';
import { filterVoices, groupVoicesByLanguage } from './voice-search';

const voice = (id: string, name: string, language: string): VoiceInfo => ({
  id,
  name,
  language,
  engine: 'system',
});

const VOICES: VoiceInfo[] = [
  voice('v1', 'English (United States) · Network', 'en-US'),
  voice('v2', 'English (United Kingdom)', 'en-GB'),
  voice('v3', 'German (Germany)', 'de'),
  voice('v4', 'Castilian Spanish', 'es-ES'),
];

describe('filterVoices', () => {
  it('returns every voice for a blank query', () => {
    expect(filterVoices(VOICES, '')).toBe(VOICES);
    expect(filterVoices(VOICES, '   ')).toBe(VOICES);
  });

  it('matches names case-insensitively', () => {
    expect(filterVoices(VOICES, 'german').map((row) => row.id)).toEqual(['v3']);
    expect(filterVoices(VOICES, 'NETWORK').map((row) => row.id)).toEqual(['v1']);
  });

  it('matches language tags and their display names', () => {
    expect(filterVoices(VOICES, 'en-GB').map((row) => row.id)).toEqual(['v2']);
    expect(filterVoices(VOICES, 'united kingdom').map((row) => row.id)).toEqual(['v2']);
    expect(filterVoices(VOICES, 'spanish').map((row) => row.id)).toEqual(['v4']);
  });

  it('returns no rows when nothing matches', () => {
    expect(filterVoices(VOICES, 'esperanto')).toEqual([]);
  });
});

describe('groupVoicesByLanguage', () => {
  it('groups by language with readable, alphabetically sorted labels', () => {
    const groups = groupVoicesByLanguage(VOICES);
    expect(groups.map((group) => group.label)).toEqual([
      'English (United Kingdom)',
      'English (United States)',
      'German',
      'Spanish (Spain)',
    ]);
  });

  it('sorts voices within a group by name', () => {
    const groups = groupVoicesByLanguage([
      voice('b', 'Zeta', 'en-US'),
      voice('a', 'Alpha', 'en-US'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].voices.map((row) => row.name)).toEqual(['Alpha', 'Zeta']);
  });
});
