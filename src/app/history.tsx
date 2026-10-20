import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { Eyebrow } from '@/components/eyebrow';
import { StoryList } from '@/components/story-list';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { progressRepository } from '@/db/repositories';
import type { Story } from '@/models/story';
import { useOpenStory } from '@/navigation/routes';
import { computeReadingStats, type ReadingStatsRange } from '@/services/stats';
import { useTheme } from '@/hooks/use-theme';
import { useHistoryStore } from '@/stores/history';
import { useBackToParent } from '@/navigation/use-parent-back';

const RANGE_OPTIONS: ReadingStatsRange[] = ['week', 'all'];

export default function HistoryScreen() {
  const backToParent = useBackToParent();
  const items = useHistoryStore((state) => state.items);
  const refresh = useHistoryStore((state) => state.refresh);
  const clear = useHistoryStore((state) => state.clear);
  const openStoryRow = useOpenStory();

  const [range, setRange] = useState<ReadingStatsRange>('week');
  const [progress, setProgress] = useState<Awaited<
    ReturnType<typeof progressRepository.listAll>
  > | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void progressRepository
        .listAll()
        .then((rows) => setProgress(rows))
        .catch(() => setProgress([]));
    }, [refresh]),
  );

  const stats = useMemo(
    () => (progress ? computeReadingStats(progress, range) : null),
    [progress, range],
  );

  const stories = useMemo(
    () => items.map((item) => item.story).filter((story): story is Story => story !== null),
    [items],
  );

  const confirmClear = () => {
    Alert.alert(t('history.clearTitle'), t('history.clearMessage'), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => void clear() },
    ]);
  };

  return (
    <Screen>
      <AppBar
        title={t('history.title')}
        subtitle={items.length > 0 ? t('history.entries', { count: items.length }) : undefined}
        onBack={() => backToParent({ pathname: '/' })}
        right={
          items.length > 0 ? (
            <Button variant="ghost" title={t('common.clear')} onPress={confirmClear} />
          ) : null
        }
      />

      {stats ? <StatsHeader stats={stats} range={range} onRange={setRange} /> : null}

      {items.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title={t('history.emptyTitle')}
          message={t('history.emptyMessage')}
        />
      ) : (
        <StoryList stories={stories} onPressStory={openStoryRow} onRefresh={() => void refresh()} />
      )}
    </Screen>
  );
}

function StatsHeader({
  stats,
  range,
  onRange,
}: {
  stats: ReturnType<typeof computeReadingStats>;
  range: ReadingStatsRange;
  onRange: (range: ReadingStatsRange) => void;
}) {
  const theme = useTheme();
  const empty = stats.chaptersRead === 0;

  return (
    <View style={[styles.statsBlock, { borderBottomColor: theme.border }]}>
      <Eyebrow>{t('stats.title')}</Eyebrow>
      {empty ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('stats.empty')}
        </ThemedText>
      ) : (
        <View style={styles.statsRow}>
          <StatPair value={stats.chaptersRead} caption={t('stats.chaptersRead')} />
          <StatPair value={stats.chaptersFinished} caption={t('stats.finished')} />
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('stats.title')}
            style={styles.rangeChips}
          >
            {RANGE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option === 'week' ? t('stats.thisWeek') : t('stats.allTime')}
                role="radio"
                selected={range === option}
                onPress={() => onRange(option)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/** §2.7 stat pair: big number + small-caps caption. */
function StatPair({ value, caption }: { value: number; caption: string }) {
  return (
    <View style={styles.statPair}>
      <ThemedText type="heading">{value}</ThemedText>
      <Eyebrow>{caption}</Eyebrow>
    </View>
  );
}

const styles = StyleSheet.create({
  statsBlock: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  statPair: { gap: Spacing.half },
  rangeChips: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginLeft: 'auto',
  },
});
