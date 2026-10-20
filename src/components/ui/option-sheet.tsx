import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type OptionSheetOption<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type OptionSheetRow<T extends string> = {
  value: T | null;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export type OptionSheetProps<T extends string> = {
  visible: boolean;
  /** Sheet heading, and the label announced for the list of options. */
  title: string;
  options: readonly OptionSheetOption<T>[];
  value: T | null;
  /** Leading "no restriction" row. Omit when a value is always required. */
  allLabel?: string;
  onSelect: (value: T | null) => void;
  onClose: () => void;
};

export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  value,
  allLabel,
  onSelect,
  onClose,
}: OptionSheetProps<T>) {
  const theme = useTheme();
  const rows: readonly OptionSheetRow<T>[] = allLabel
    ? [{ value: null, label: allLabel }, ...options]
    : options;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.overlay }]}
          onPress={onClose}
          importantForAccessibility="no"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.backgroundElevated, borderTopColor: theme.border },
          ]}
        >
          <View style={styles.header}>
            <ThemedText type="heading" numberOfLines={1} accessibilityRole="header">
              {title}
            </ThemedText>
            <IconButton icon="close" label={t('common.close')} onPress={onClose} />
          </View>
          <FlatList
            data={rows}
            keyExtractor={(row) => row.value ?? '__all__'}
            extraData={value}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.border }]} />
            )}
            renderItem={({ item }) => (
              <OptionSheetRowView
                item={item}
                selected={item.value === value}
                onPress={() => onSelect(item.value)}
              />
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

function OptionSheetRowView<T extends string>({
  item,
  selected,
  onPress,
}: {
  item: OptionSheetRow<T>;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const foreground = selected ? theme.primary : theme.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={item.label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.rowLabel}>
        {item.icon ? (
          <Ionicons
            name={item.icon}
            size={18}
            color={selected ? theme.primary : theme.textSecondary}
          />
        ) : null}
        <ThemedText type="default" numberOfLines={1} style={{ color: foreground }}>
          {item.label}
        </ThemedText>
      </View>
      {selected ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    maxHeight: '70%',
    paddingBottom: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  list: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
});
