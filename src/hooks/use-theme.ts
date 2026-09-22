import { useAppTheme } from '@/theme';

/**
 * Returns the semantic colour tokens for the active theme.
 */
export function useTheme() {
  return useAppTheme().palette;
}
