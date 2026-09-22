import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, resolveLocale, setLocale, t } from './translator';

describe('resolveLocale', () => {
  it('keeps supported languages', () => {
    expect(resolveLocale('en')).toBe('en');
  });

  it('falls back to English for unknown or missing languages', () => {
    expect(resolveLocale('fr')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
  });
});

describe('t', () => {
  it('returns nested translations', () => {
    expect(t('tabs.library')).toBe('Library');
    expect(t('settings.theme.amoled')).toBe('AMOLED');
  });

  it('interpolates options', () => {
    expect(t('library.count', { count: 3 })).toBe('3 stories');
    expect(t('story.continue', { percent: 40 })).toBe('Continue · 40%');
  });

  it('falls back to English after an unsupported locale is set', () => {
    setLocale('fr');
    expect(t('tabs.browse')).toBe('Browse');
    setLocale('en');
  });
});
