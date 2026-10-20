/**
 * Raw palette definitions for every supported app theme.
 *
 * These are the single source of truth for colour. Components must consume
 * semantic tokens (via `useAppTheme`) instead of hard-coding hex values so that
 * AMOLED and future reader themes stay consistent.
 */

export const lightPalette = {
  background: '#FFFFFF',
  backgroundElement: '#F0F0F3',
  backgroundSelected: '#E0E1E6',
  backgroundElevated: '#FFFFFF',
  text: '#11181C',
  textSecondary: '#5B6169',
  textMuted: '#6B7280',
  border: '#E1E3E8',
  borderStrong: '#80858D',
  primary: '#2563EB',
  primaryText: '#FFFFFF',
  accent: '#7C5CFF',
  danger: '#C62828',
  success: '#197A4B',
  warning: '#8A5A00',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export const darkPalette = {
  background: '#101014',
  backgroundElement: '#1C1D22',
  backgroundSelected: '#2A2C33',
  backgroundElevated: '#1C1D22',
  text: '#ECEDEE',
  textSecondary: '#B0B4BA',
  textMuted: '#7C8189',
  border: '#2A2C33',
  borderStrong: '#646873',
  primary: '#4D9BFF',
  primaryText: '#04121F',
  accent: '#9D8CFF',
  danger: '#FF6369',
  success: '#3DD68C',
  warning: '#FFB224',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export const amoledPalette = {
  background: '#000000',
  backgroundElement: '#0C0C0F',
  backgroundSelected: '#17171C',
  backgroundElevated: '#0C0C0F',
  text: '#FAFAFA',
  textSecondary: '#A9ADB4',
  textMuted: '#80858D',
  border: '#1B1B20',
  borderStrong: '#62666F',
  primary: '#4D9BFF',
  primaryText: '#04121F',
  accent: '#9D8CFF',
  danger: '#FF6369',
  success: '#3DD68C',
  warning: '#FFB224',
  overlay: 'rgba(0, 0, 0, 0.7)',
} as const;

export type ThemePalette = { [K in keyof typeof lightPalette]: string };
export type ThemeColor = keyof ThemePalette;

export const Palettes = {
  light: lightPalette,
  dark: darkPalette,
  amoled: amoledPalette,
} as const;

export type AppThemeName = keyof typeof Palettes;
export type ThemePreference = AppThemeName | 'system';
