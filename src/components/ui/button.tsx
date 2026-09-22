import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const colors = variantColors(variant, theme);
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.foreground} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={colors.foreground} />
      ) : null}
      <ThemedText type="smallBold" style={{ color: colors.foreground }}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

function variantColors(
  variant: ButtonVariant,
  theme: ThemePalette,
): { background: string; foreground: string; border: string } {
  switch (variant) {
    case 'primary':
      return { background: theme.primary, foreground: theme.primaryText, border: theme.primary };
    case 'secondary':
      return { background: theme.backgroundElement, foreground: theme.text, border: theme.border };
    case 'ghost':
      return { background: 'transparent', foreground: theme.primary, border: 'transparent' };
    case 'danger':
      return { background: theme.danger, foreground: '#FFFFFF', border: theme.danger };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
