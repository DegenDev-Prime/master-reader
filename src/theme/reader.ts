import type { ReaderFontFamily, ReaderThemeName } from '@/services/settings';

export type ReaderPalette = {
  background: string;
  text: string;
  muted: string;
  border: string;
  surface: string;
  link: string;
};

export const readerPalettes: Record<ReaderThemeName, ReaderPalette> = {
  light: {
    background: '#FFFFFF',
    text: '#1A1A1A',
    muted: '#6B6B6B',
    border: '#E2E2E2',
    surface: '#F3F3F3',
    link: '#1D4ED8',
  },
  sepia: {
    background: '#F4ECD8',
    text: '#3B3226',
    muted: '#6B5F4D',
    border: '#D8CDB6',
    surface: '#EAE0C9',
    link: '#1F4E79',
  },
  dark: {
    background: '#14161A',
    text: '#E6E6E6',
    muted: '#9AA0A6',
    border: '#2A2D33',
    surface: '#1C1F24',
    link: '#7EB3FF',
  },
  black: {
    background: '#000000',
    text: '#EDEDED',
    muted: '#8A8F94',
    border: '#1C1C1C',
    surface: '#0D0D0D',
    link: '#8AB4F8',
  },
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
