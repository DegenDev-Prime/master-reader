import { I18n } from 'i18n-js';

import en from './en.json';

export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en'] as const;

const i18n = new I18n({ en });
i18n.enableFallback = true;
i18n.defaultLocale = DEFAULT_LOCALE;
i18n.locale = DEFAULT_LOCALE;

export type TranslateOptions = Record<string, string | number>;

/** Maps an arbitrary device language code onto a supported locale. */
export function resolveLocale(languageCode?: string | null): string {
  if (!languageCode) return DEFAULT_LOCALE;
  return (SUPPORTED_LOCALES as readonly string[]).includes(languageCode)
    ? languageCode
    : DEFAULT_LOCALE;
}

export function setLocale(languageCode?: string | null): void {
  i18n.locale = resolveLocale(languageCode);
}

export function getLocale(): string {
  return i18n.locale;
}

export function t(key: string, options?: TranslateOptions): string {
  const value = i18n.t(key, options);
  return typeof value === 'string' ? value : String(value);
}
