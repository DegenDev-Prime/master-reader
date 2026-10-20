import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Section({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionHeader}>
          <ThemedText type="eyebrow">{title}</ThemedText>
          {description ? (
            <ThemedText type="small" themeColor="textSecondary">
              {description}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function Row({
  label,
  description,
  right,
}: {
  label: string;
  description?: string;
  right?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowText}>
        <ThemedText type="default">{label}</ThemedText>
        {description ? (
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  sectionHeader: { marginLeft: Spacing.one, gap: Spacing.half },
  card: {
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: Spacing.half },
});
