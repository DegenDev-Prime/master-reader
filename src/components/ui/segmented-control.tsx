import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export type SegmentedControlProps<T extends string> = {
  /** Announced as the group label when a screen reader enters the control. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  style,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[
        styles.group,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const foreground = selected ? theme.primaryText : theme.textSecondary;

        return (
          <Pressable
            key={option.value}
            onPress={disabled ? undefined : () => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: theme.primary },
              pressed && !disabled && { opacity: 0.85 },
            ]}
          >
            {option.icon ? <Ionicons name={option.icon} size={14} color={foreground} /> : null}
            <ThemedText type="small" numberOfLines={1} style={{ color: foreground }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: MinTouchTarget,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
});
