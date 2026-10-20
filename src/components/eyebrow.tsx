import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Local small-caps eyebrow label while the shared ThemedText `eyebrow`
 * variant is still in flight. Small-caps, letter-spaced 12pt captions are
 * used by the player top bar, hub label rails and stat-pair headers.
 * Colour always comes from the active theme token.
 */
export function Eyebrow({
  style,
  children,
  ...rest
}: Omit<TextProps, 'style'> & { style?: StyleProp<TextStyle> }) {
  const theme = useTheme();

  return (
    <Text style={[styles.eyebrow, { color: theme.textSecondary }, style]} {...rest}>
      {children}
    </Text>
  );
}

/**
 * Serif display treatment for the Arc-style typographic heads (player hero
 * title, reader chapter head). Platform serif, never a bundled font.
 */
export function serifTitle(size: number, lineHeight: number): TextStyle {
  return {
    fontFamily: Fonts.serif,
    fontSize: size,
    lineHeight,
    fontWeight: '600',
  };
}

export const EYEBROW_GAP: number = Spacing.one;

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
