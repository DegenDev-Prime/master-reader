import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Announced instead of the default button role; use "radio" inside a labelled group. */
  role?: AccessibilityRole;
  /** Overrides the text announced by screen readers when the label is truncated. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Chip({
  label,
  selected,
  disabled,
  onPress,
  icon,
  role,
  accessibilityLabel,
  style,
}: ChipProps) {
  const theme = useTheme();
  const background = selected ? theme.primary : theme.backgroundElement;
  const foreground = selected ? theme.primaryText : theme.textSecondary;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole={role ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: background, borderColor: selected ? theme.primary : theme.border },
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={foreground} /> : null}
      <ThemedText type="small" numberOfLines={1} style={{ color: foreground, flexShrink: 1 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
