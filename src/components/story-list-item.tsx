import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Story } from '@/models/story';
import { formatCount } from '@/utils/format';

export { formatCount };

export type StoryListItemProps = {
  story: Story;
  onPress?: () => void;
  unread?: boolean;
  right?: ReactNode;
};

export function StoryListItem({ story, onPress, unread, right }: StoryListItemProps) {
  const theme = useTheme();

  const meta = [story.authorName, story.categoryName].filter(Boolean).join('  \u00b7  ');
  const stats = [
    story.wordCount ? `${formatCount(story.wordCount)} words` : null,
    story.rating ? `\u2605 ${story.rating.toFixed(2)}` : null,
    story.views ? `${formatCount(story.views)} views` : null,
  ]
    .filter(Boolean)
    .join('   ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}
    >
      <View style={styles.body}>
        <View style={styles.titleRow}>
          {unread ? <View style={[styles.dot, { backgroundColor: theme.primary }]} /> : null}
          <ThemedText type="default" numberOfLines={2} style={styles.title}>
            {story.title}
          </ThemedText>
        </View>

        {story.flags.isNew || story.flags.isHot ? (
          <View style={styles.badges}>
            {story.flags.isNew ? <Badge label={t('story.badgeNew')} color={theme.success} /> : null}
            {story.flags.isHot ? <Badge label={t('story.badgeHot')} color={theme.warning} /> : null}
          </View>
        ) : null}

        {meta ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}

        {stats ? (
          <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
            {stats}
          </ThemedText>
        ) : null}
      </View>

      {right ?? <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />}
    </Pressable>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <ThemedText type="small" style={[styles.badgeText, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  body: { flex: 1, gap: Spacing.half },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badges: { flexDirection: 'row', gap: Spacing.one },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 11, lineHeight: 16 },
});
