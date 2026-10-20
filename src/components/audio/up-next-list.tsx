import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

export type UpNextItem = {
  id: string;
  /** Chapter number shown to the reader. */
  position: number | null;
  title: string;
  /** Estimated length, e.g. "22 min". */
  length: string | null;
};

export type UpNextListProps = {
  items: UpNextItem[];
  onSelect: (item: UpNextItem) => void;
  onRemove?: (item: UpNextItem) => void;
};

/** The chapters queued after the one being read. */
export const UpNextList = memo(function UpNextList({ items, onSelect, onRemove }: UpNextListProps) {
  const theme = useTheme();
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <ThemedText type="eyebrow">{t('player.upNext').toUpperCase()}</ThemedText>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      >
        {items.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={`${t('player.chapterEyebrow', {
              position: item.position ?? index + 1,
            })} · ${item.title}`}
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: theme.border },
              index < items.length - 1 && styles.rowBorder,
              pressed && { backgroundColor: theme.backgroundSelected },
            ]}
          >
            <ThemedText type="smallBold" themeColor="textMuted" style={styles.position}>
              {item.position ?? index + 1}
            </ThemedText>
            <ThemedText type="default" numberOfLines={1} style={styles.title}>
              {item.title}
            </ThemedText>
            {item.length ? (
              <ThemedText type="small" themeColor="textMuted">
                {item.length}
              </ThemedText>
            ) : null}
            {onRemove ? (
              <Pressable
                onPress={() => onRemove(item)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('player.removeFromQueue')}
                style={styles.remove}
              >
                <Ionicons name="close" size={18} color={theme.textMuted} />
              </Pressable>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  position: { minWidth: 28, textAlign: 'right' },
  title: { flex: 1, minWidth: 0 },
  remove: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
});
