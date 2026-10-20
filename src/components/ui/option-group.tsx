import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type OptionGroupOption<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export type OptionGroupProps<T extends string> = {
  /** Visible heading, and the name announced when the group gains focus. */
  label: string;
  options: readonly OptionGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Chips wrap to fit long labels; segmented gives every option equal width. */
  variant?: 'chips' | 'segmented';
  /** Set false when the group already sits inside a bordered container. */
  framed?: boolean;
  style?: StyleProp<ViewStyle>;
};

const OptionGroupInner = function OptionGroupInner<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  variant = 'chips',
  framed = true,
  style,
}: OptionGroupProps<T>) {
  const theme = useTheme();
  const frame = framed
    ? [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]
    : null;
  const dimmed = disabled ? styles.disabled : null;

  return (
    <View style={[styles.group, style]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
        {label.toUpperCase()}
      </ThemedText>
      {variant === 'segmented' ? (
        <View style={[styles.options, frame, dimmed]}>
          <SegmentedControl
            label={label}
            options={options}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        </View>
      ) : (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          style={[styles.options, frame, dimmed]}
        >
          {options.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              icon={option.icon}
              role="radio"
              selected={option.value === value}
              disabled={disabled}
              onPress={() => onChange(option.value)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// React's memo widens a generic component's props to its constraint, which
// would reject SleepMode handlers, so the exact generic signature is restored.
export const OptionGroup = memo(OptionGroupInner) as unknown as typeof OptionGroupInner;

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  label: { marginLeft: Spacing.one },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  disabled: { opacity: 0.45 },
});
