import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Cover } from '@/components/ui/cover';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingView } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { chapterDownloadsRepository } from '@/db/repositories/chapter-downloads';
import { chapterRepository } from '@/db/repositories/chapters';
import { downloadsRepository } from '@/db/repositories/downloads';
import { libraryRepository, type LibraryNovel } from '@/db/repositories/library';
import { useTheme } from '@/hooks/use-theme';
import { formatBytes } from '@/utils/format';
import { useBackToParent } from '@/navigation/use-parent-back';

type Row = LibraryNovel & { bytes: number };

export default function DownloadsScreen() {
  const backToParent = useBackToParent();
  const theme = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const items = await libraryRepository.listNovels();
    const downloaded = items.filter((item) => item.novel && item.counts.downloaded > 0);
    const withBytes = await Promise.all(
      downloaded.map(async (item) => {
        const counts = await chapterDownloadsRepository.counts(
          item.entry.sourceId,
          item.entry.storyId,
        );
        return { ...item, bytes: counts.bytes };
      }),
    );
    setRows(withBytes);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const summary = useMemo(() => {
    return rows.reduce(
      (total, row) => ({
        chapters: total.chapters + row.counts.downloaded,
        bytes: total.bytes + row.bytes,
      }),
      { chapters: 0, bytes: 0 },
    );
  }, [rows]);

  const remove = useCallback(
    (row: Row) => {
      if (!row.novel) return;
      Alert.alert(
        t('downloads.removeTitle'),
        t('downloads.removeMessage', {
          count: row.counts.downloaded,
          size: formatBytes(row.bytes),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('download.delete'),
            style: 'destructive',
            onPress: () => {
              void (async () => {
                await chapterDownloadsRepository.remove(row.novel!.sourceId, row.novel!.id);
                await chapterRepository.removeContent(row.novel!.sourceId, row.novel!.id);
                await downloadsRepository.remove(row.novel!.sourceId, row.novel!.id);
                await load();
              })();
            },
          },
        ],
      );
    },
    [load],
  );

  return (
    <Screen>
      <AppBar title={t('downloads.title')} onBack={() => backToParent({ pathname: '/' })} />
      {loading ? (
        <LoadingView label={t('common.loading')} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="cloud-download-outline"
          title={t('downloads.emptyTitle')}
          message={t('downloads.emptyMessage')}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => `${row.entry.sourceId}:${row.entry.storyId}`}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={[styles.summary, { borderColor: theme.border }]}>
              <View style={styles.stat}>
                <ThemedText type="heading">{rows.length}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('downloads.storiesStat')}
                </ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.stat}>
                <ThemedText type="heading">{summary.chapters}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('common.chapters')}
                </ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.stat}>
                <ThemedText type="heading">{formatBytes(summary.bytes)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('downloads.sizeStat')}
                </ThemedText>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const novel = item.novel;
            if (!novel) return null;
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/story/[sourceId]/[id]',
                    params: { sourceId: novel.sourceId, id: novel.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={novel.title}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed ? theme.backgroundSelected : theme.background,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <Cover uri={novel.coverUrl} title={novel.title} width={48} />
                <View style={styles.rowText}>
                  <ThemedText type="bodyStrong" numberOfLines={2}>
                    {novel.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('downloads.completedOf', {
                      done: item.counts.downloaded,
                      total: item.counts.total,
                    })}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textMuted">
                    {formatBytes(item.bytes)}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => remove(item)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('download.delete')}
                  style={styles.delete}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.textMuted} />
                </Pressable>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.six },
  summary: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    margin: Spacing.three,
    paddingVertical: Spacing.three,
  },
  stat: { alignItems: 'center', flex: 1, gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.one },
  delete: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});
