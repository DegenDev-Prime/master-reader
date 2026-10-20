import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function NavRow({
  label,
  description,
  icon,
  onPress,
  destructive,
  right,
  last,
}: {
  label: string;
  description?: string;
  icon?: IconName;
  onPress?: () => void;
  destructive?: boolean;
  right?: ReactNode;
  last?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderBottomColor: theme.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={22} color={destructive ? theme.danger : theme.textSecondary} />
      ) : null}
      <View style={styles.text}>
        <ThemedText type="default" themeColor={destructive ? 'danger' : undefined}>
          {label}
        </ThemedText>
        {description ? (
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        ) : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoHalf,
  },
  text: { flex: 1, gap: Spacing.half },
});
