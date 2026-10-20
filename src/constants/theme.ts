/**
 * App-wide design tokens.
 *
 * Colour lives in `@/theme/palettes` (light / dark / AMOLED). This module
 * re-exports it for convenience and defines the non-colour tokens: spacing,
 * radii, type scale and layout constants.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { Palettes } from '@/theme/palettes';

export const Colors = Palettes;
export type { ThemeColor } from '@/theme/palettes';

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  twoHalf: 12,
  three: 16,
  four: 24,
  five: 32,
  fiveHalf: 48,
  six: 64,
} as const;

export const Radius = {
  small: 0,
  medium: 0,
  large: 0,
  full: 0,
} as const;

/** Minimum hit area for any pressable control (WCAG 2.5.5). */
export const MinTouchTarget = 48;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
