import type { ReaderFontFamily, ReaderThemeName } from '@/services/settings';

export type ReaderPalette = {
  background: string;
  text: string;
  muted: string;
};

export const readerPalettes: Record<ReaderThemeName, ReaderPalette> = {
  light: { background: '#FFFFFF', text: '#1A1A1A', muted: '#6B6B6B' },
  sepia: { background: '#F4ECD8', text: '#3B3226', muted: '#7A6E5A' },
  dark: { background: '#14161A', text: '#E6E6E6', muted: '#9AA0A6' },
  black: { background: '#000000', text: '#EDEDED', muted: '#8A8F94' },
};

/**
 * Font family mapping for the reader. When the OpenDyslexic font asset has not
 * been bundled, React Native silently falls back to the system font.
 */
export const readerFontFamilies: Record<ReaderFontFamily, string | undefined> = {
  system: undefined,
  serif: 'serif',
  opendyslexic: 'OpenDyslexic',
};
