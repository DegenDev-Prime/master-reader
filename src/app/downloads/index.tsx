import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { DownloadListItem } from '@/components/download-list-item';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openStory } from '@/navigation/routes';
import {
  downloadItemsBytes,
  groupDownloadItems,
  type DownloadItem,
  type DownloadSeriesGroup,
} from '@/services/downloads';
import { useDownloadsStore } from '@/stores/downloads';
import { formatBytes } from '@/utils/format';

type Row =
  | { kind: 'series'; group: DownloadSeriesGroup }
  | { kind: 'item'; item: DownloadItem };

export default function DownloadsScreen() {
  const theme = useTheme();
  const items = useDownloadsStore((state) => state.items);
  const refresh = useDownloadsStore((state) => state.refresh);
  const remove = useDownloadsStore((state) => state.remove);
  const retry = useDownloadsStore((state) => state.retry);
  const process = useDownloadsStore((state) => state.process);

  useEffect(() => {
    void refresh().then(() => process());
  }, [refresh, process]);

  const rows = useMemo<Row[]>(() => {
    const { series, standalone } = groupDownloadItems(items);
    return [
      ...series.map((group) => ({ kind: 'series' as const, group })),
      ...standalone.map((item) => ({ kind: 'item' as const, item })),
    ];
  }, [items]);

  const completed = items.filter((item) => item.download.status === 'completed');
  const totalBytes = downloadItemsBytes(completed);

  const confirmClear = () => {
    Alert.alert(t('downloads.clearTitle'), t('downloads.clearMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.clear'),
        style: 'destructive',
        onPress: () => {
          for (const item of completed) {
            void remove(item.download.sourceId, item.download.storyId);
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <AppBar
        title={t('downloads.title')}
        subtitle={
          items.length > 0
            ? t('downloads.summary', { count: items.length, size: formatBytes(totalBytes) })
            : undefined
        }
        onBack={() => router.back()}
        right={
          completed.length > 0 ? (
            <Button variant="ghost" title={t('common.clear')} onPress={confirmClear} />
          ) : null
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon="download-outline"
          title={t('downloads.emptyTitle')}
          message={t('downloads.emptyMessage')}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) =>
            row.kind === 'series'
              ? `series:${row.group.seriesId}`
              : `${row.item.download.sourceId}:${row.item.download.storyId}`
          }
          renderItem={({ item: row }) =>
            row.kind === 'series' ? (
              <SeriesRow group={row.group} onPress={() => router.push(`/downloads/series/${row.group.seriesId}`)} />
            ) : (
              <DownloadListItem
                item={row.item}
                onOpen={() => openStory(row.item.download.sourceId, row.item.download.storyId)}
                onRetry={() => void retry(row.item.download.sourceId, row.item.download.storyId)}
                onDelete={() => void remove(row.item.download.sourceId, row.item.download.storyId)}
              />
            )
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
          )}
          contentContainerStyle={styles.content}
        />
      )}
    </Screen>
  );
}

function SeriesRow({ group, onPress }: { group: DownloadSeriesGroup; onPress: () => void }) {
  const theme = useTheme();
  const total = group.items.length;
  const done = group.items.filter((item) => item.download.status === 'completed').length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.seriesRow,
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
    >
      <View style={styles.seriesBody}>
        <ThemedText type="default" numberOfLines={2} style={styles.seriesTitle}>
          {group.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {t('downloads.chapters', { count: total })} · {formatBytes(downloadItemsBytes(group.items))}
        </ThemedText>
        <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
          {t('downloads.completedOf', { done, total })}
        </ThemedText>
      </View>
      <View style={[styles.seriesBadge, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('common.open')}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  content: { paddingBottom: Spacing.six },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  seriesBody: { flex: 1, gap: Spacing.half },
  seriesTitle: { fontWeight: '600' },
  seriesBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
