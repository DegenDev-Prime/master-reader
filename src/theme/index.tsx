import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { Palettes, type AppThemeName, type ThemePalette, type ThemePreference } from './palettes';

type ThemeContextValue = {
  /** The active preference, which may be `system`. */
  preference: ThemePreference;
  /** The concrete theme currently applied. */
  themeName: AppThemeName;
  /** Semantic colour tokens for the active theme. */
  palette: ThemePalette;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export type AppThemeProviderProps = {
  children: ReactNode;
  /** Controlled preference, sourced from the settings store. */
  preference: ThemePreference;
  onPreferenceChange?: (preference: ThemePreference) => void;
};

export function AppThemeProvider({
  children,
  preference,
  onPreferenceChange,
}: AppThemeProviderProps) {
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    const themeName: AppThemeName =
      preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

    return {
      preference,
      themeName,
      palette: Palettes[themeName],
      setPreference: onPreferenceChange ?? (() => {}),
    };
  }, [preference, systemScheme, onPreferenceChange]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}

export { Palettes } from './palettes';
export type { AppThemeName, ThemePalette, ThemePreference } from './palettes';
