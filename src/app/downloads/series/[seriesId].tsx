import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { DownloadListItem } from '@/components/download-list-item';
import { AppBar } from '@/components/ui/app-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openStory } from '@/navigation/routes';
import { groupDownloadItems } from '@/services/downloads';
import { useDownloadsStore } from '@/stores/downloads';
import { formatBytes } from '@/utils/format';

export default function DownloadSeriesScreen() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
  const theme = useTheme();
  const items = useDownloadsStore((state) => state.items);
  const refresh = useDownloadsStore((state) => state.refresh);
  const remove = useDownloadsStore((state) => state.remove);
  const retry = useDownloadsStore((state) => state.retry);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const group = useMemo(() => {
    const { series } = groupDownloadItems(items);
    return series.find((entry) => entry.seriesId === seriesId) ?? null;
  }, [items, seriesId]);

  const chapters = group?.items ?? [];
  const totalBytes = chapters.reduce((total, item) => total + (item.download.sizeBytes ?? 0), 0);

  return (
    <Screen>
      <AppBar
        title={group?.title ?? t('downloads.series')}
        subtitle={
          chapters.length > 0
            ? t('downloads.summary', { count: chapters.length, size: formatBytes(totalBytes) })
            : undefined
        }
        onBack={() => router.back()}
      />

      {chapters.length === 0 ? (
        <EmptyState
          icon="download-outline"
          title={t('downloads.emptyTitle')}
          message={t('downloads.emptyMessage')}
        />
      ) : (
        <FlatList
          data={chapters}
          keyExtractor={(item) => `${item.download.sourceId}:${item.download.storyId}`}
          renderItem={({ item }) => (
            <DownloadListItem
              item={item}
              onOpen={() => openStory(item.download.sourceId, item.download.storyId)}
              onRetry={() => void retry(item.download.sourceId, item.download.storyId)}
              onDelete={() => void remove(item.download.sourceId, item.download.storyId)}
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
          )}
          contentContainerStyle={styles.content}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  content: { paddingBottom: Spacing.six },
});
