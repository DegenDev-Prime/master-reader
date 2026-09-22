import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { StoryListItem, formatCount } from '@/components/story-list-item';
import { DownloadButton } from '@/components/download-button';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingView } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReadingProgress, useStoryDetails } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { openReader, openSeries } from '@/navigation/routes';
import { progressPercent } from '@/services/reading';
import { seriesToStories } from '@/services/series';
import { libraryKey, useLibraryStore } from '@/stores/library';
import { useDownloadsStore } from '@/stores/downloads';

export default function StoryDetailScreen() {
  const { sourceId, id } = useLocalSearchParams<{ sourceId: string; id: string }>();
  const theme = useTheme();

  const details = useStoryDetails(sourceId, id);
  const progress = useReadingProgress(sourceId, id);
  const keys = useLibraryStore((state) => state.keys);
  const add = useLibraryStore((state) => state.add);
  const remove = useLibraryStore((state) => state.remove);
  const hydrate = useLibraryStore((state) => state.hydrate);
  const hydrateDownloads = useDownloadsStore((state) => state.refresh);
  const enqueueMany = useDownloadsStore((state) => state.enqueueMany);

  useEffect(() => {
    void hydrate();
    void hydrateDownloads();
  }, [hydrate, hydrateDownloads]);

  if (!sourceId || !id) {
    return (
      <Screen>
        <AppBar title={t('story.title')} onBack={() => router.back()} />
        <ErrorState message={t('story.missing')} />
      </Screen>
    );
  }

  const story = details.data;
  const series = story?.series ?? null;
  const inLibrary = keys.has(libraryKey(sourceId, id));
  const savedProgress = progress.data;
  const percent = savedProgress?.pageCount
    ? progressPercent(savedProgress.pageIndex, savedProgress.pageCount)
    : 0;

  return (
    <Screen edges={['top']}>
      <AppBar
        title={story?.title ?? t('story.title')}
        subtitle={story?.authorName ?? undefined}
        onBack={() => router.back()}
      />

      {details.isLoading ? (
        <LoadingView label={t('story.loading')} />
      ) : details.isError || !story ? (
        <ErrorState
          message={(details.error as Error)?.message ?? t('story.error')}
          onRetry={() => void details.refetch()}
        />
      ) : (
        <StoryListItem story={story} />
      )}

      {story ? (
        <View style={styles.actions}>
          <Button
            title={savedProgress ? t('story.continue', { percent }) : t('story.startReading')}
            icon="book-outline"
            onPress={() => openReader(sourceId, id)}
          />
          <View style={styles.actionRow}>
            <Button
              variant="secondary"
              title={inLibrary ? t('story.inLibrary') : t('story.addToLibrary')}
              icon={inLibrary ? 'checkmark' : 'add'}
              style={styles.flex}
              onPress={() => (inLibrary ? void remove(sourceId, id) : void add(story))}
            />
            <View style={styles.flex}>
              <DownloadButton story={story} />
            </View>
          </View>
          {series && series.items.length > 1 ? (
            <View style={styles.actionRow}>
              <Button
                variant="secondary"
                title={t('series.view')}
                icon="list-outline"
                style={styles.flex}
                onPress={() => openSeries(sourceId, id)}
              />
              <Button
                variant="secondary"
                title={t('series.downloadAll')}
                icon="download-outline"
                style={styles.flex}
                onPress={() => {
                  const items = seriesToStories(sourceId, series);
                  void enqueueMany(items);
                  Alert.alert(t('series.title'), t('series.queued', { count: items.length }));
                }}
              />
            </View>
          ) : null}
          <Button
            variant="secondary"
            title={t('story.openWeb')}
            icon="open-outline"
            onPress={() => {
              if (story.url) void WebBrowser.openBrowserAsync(story.url);
            }}
          />
        </View>
      ) : null}

      {story ? (
        <View style={[styles.meta, { borderTopColor: theme.border }]}>
          <MetaRow label={t('story.category')} value={story.categoryName} />
          <MetaRow label={t('story.language')} value={story.lang} />
          <MetaRow label={t('story.words')} value={formatCount(story.wordCount)} />
          <MetaRow
            label={t('story.rating')}
            value={story.rating ? story.rating.toFixed(2) : null}
          />
          <MetaRow label={t('story.views')} value={formatCount(story.views)} />
          <MetaRow
            label={t('story.published')}
            value={
              story.publishedAt ? new Date(story.publishedAt * 1000).toLocaleDateString() : null
            }
          />
          {story.tags && story.tags.length > 0 ? (
            <View style={styles.tags}>
              {story.tags.slice(0, 12).map((tag) => (
                <Chip key={tag} label={tag} />
              ))}
            </View>
          ) : null}
          {story.description ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
              {story.description}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <ThemedText type="small" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  meta: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingVertical: Spacing.one },
  description: { paddingTop: Spacing.two },
});
