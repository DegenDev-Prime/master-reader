import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextType =
  | 'default'
  | 'title'
  | 'title2'
  | 'heading'
  | 'bodyStrong'
  | 'small'
  | 'smallBold'
  | 'subtitle'
  | 'link'
  | 'linkPrimary'
  | 'code'
  | 'eyebrow';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color =
    themeColor ??
    (type === 'linkPrimary' ? 'primary' : type === 'eyebrow' ? 'textSecondary' : 'text');

  return (
    <Text
      style={[
        { color: theme[color] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'title2' && styles.title2,
        type === 'heading' && styles.heading,
        type === 'bodyStrong' && styles.bodyStrong,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'eyebrow' && styles.eyebrow,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 400,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title2: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 600,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  heading: {
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
