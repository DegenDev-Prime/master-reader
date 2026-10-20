import { describe, expect, it } from 'vitest';

import {
  localeDisplayName,
  normalizeSystemVoices,
  parseLocaleTag,
  type RawSystemVoice,
} from './system-voice-names';

describe('parseLocaleTag', () => {
  it('accepts expo and android tag shapes', () => {
    expect(parseLocaleTag('en-US')).toEqual({ language: 'en', region: 'US' });
    expect(parseLocaleTag('en_US')).toEqual({ language: 'en', region: 'US' });
    expect(parseLocaleTag('de')).toEqual({ language: 'de' });
    expect(parseLocaleTag('eng-USA')).toEqual({ language: 'eng' });
    expect(parseLocaleTag('English (United States)')).toBeNull();
    expect(parseLocaleTag('')).toBeNull();
  });
});

describe('localeDisplayName', () => {
  it('names language and region', () => {
    expect(localeDisplayName('en-US')).toBe('English (United States)');
    expect(localeDisplayName('en_GB')).toBe('English (United Kingdom)');
    expect(localeDisplayName('fr')).toBe('French');
    expect(localeDisplayName('zh-CN')).toBe('Chinese (China)');
    expect(localeDisplayName('en-ZZ')).toBe('English (ZZ)');
    expect(localeDisplayName('xx')).toBe('XX');
  });
});

describe('normalizeSystemVoices', () => {
  const voice = (overrides: Partial<RawSystemVoice>): RawSystemVoice => ({
    id: 'en-us-x-sfg-network',
    name: 'en-us-x-sfg-network',
    language: 'en-US',
    ...overrides,
  });

  it('replaces raw identifiers with readable labels', () => {
    const [row] = normalizeSystemVoices([voice({})]);
    expect(row).toEqual({
      id: 'en-us-x-sfg-network',
      label: 'English (United States) · Network',
      language: 'en-US',
    });
  });

  it('keeps wavenet style names distinguishable', () => {
    const rows = normalizeSystemVoices([
      voice({ id: 'en-US-Wavenet-D', name: 'Wavenet D' }),
      voice({ id: 'en-US-Wavenet-B', name: 'Wavenet B' }),
    ]);
    expect(rows.map((row) => row.label)).toEqual([
      'English (United States) · Wavenet (B)',
      'English (United States) · Wavenet (D)',
    ]);
  });

  it('drops pipeline codes but keeps them for colliding voices', () => {
    const rows = normalizeSystemVoices([
      voice({ id: 'en-us-x-sfg-network', name: 'en-us-x-sfg-network' }),
      voice({ id: 'en-us-x-tpf-network', name: 'en-us-x-tpf-network' }),
      voice({ id: 'ur-PK-language', name: 'ur-PK-language', language: 'ur-PK' }),
    ]);
    expect(rows.map((row) => row.label)).toEqual([
      'English (United States) · Network (Sfg)',
      'English (United States) · Network (Tpf)',
      'Urdu (Pakistan)',
    ]);
  });

  it('drops pipeline noise and locale restatements', () => {
    const rows = normalizeSystemVoices([
      voice({ id: 'en-us-x-sfg-default', name: 'English (United States)' }),
      voice({ id: 'fr-FR', name: 'Français (France)', language: 'fr-FR' }),
    ]);
    expect(rows.map((row) => row.label)).toEqual(['English (United States)', 'French (France)']);
  });

  it('derives the locale from the id when the language field is missing', () => {
    const rows = normalizeSystemVoices([
      voice({ id: 'de-DE-x-sfg', name: 'de-DE-x-sfg', language: '' }),
    ]);
    expect(rows[0]?.language).toBe('de-DE');
    expect(rows[0]?.label).toBe('German (Germany)');
  });

  it('deduplicates by id and resolves label collisions with an engine hint', () => {
    const rows = normalizeSystemVoices([
      voice({ id: 'en-US-1', name: 'dup' }),
      voice({ id: 'en-US-1', name: 'dup' }),
      voice({ id: 'com.google.android.tts', name: 'dup', language: 'en-US' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
    expect(new Set(rows.map((row) => row.label)).size).toBe(2);
    expect(rows.map((row) => row.label)).toContain('English (United States) · Google');
  });

  it('sorts labels alphabetically for stable chip order', () => {
    const rows = normalizeSystemVoices([
      voice({ id: 'de-DE', name: 'de', language: 'de-DE' }),
      voice({ id: 'en-GB', name: 'gb', language: 'en-GB' }),
      voice({ id: 'en-US', name: 'us', language: 'en-US' }),
    ]);
    expect(rows.map((row) => row.label)).toEqual([
      'English (United Kingdom)',
      'English (United States)',
      'German (Germany)',
    ]);
  });

  it('returns an empty list for no voices', () => {
    expect(normalizeSystemVoices([])).toEqual([]);
  });
});
