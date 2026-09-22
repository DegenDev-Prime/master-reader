import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { StoryList } from '@/components/story-list';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingView } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useStoryDetails } from '@/hooks/queries';
import { openStory } from '@/navigation/routes';
import { seriesToStories } from '@/services/series';
import { useDownloadsStore } from '@/stores/downloads';

export default function SeriesScreen() {
  const { sourceId, id } = useLocalSearchParams<{ sourceId: string; id: string }>();
  const details = useStoryDetails(sourceId ?? '', id ?? '');
  const enqueueMany = useDownloadsStore((state) => state.enqueueMany);

  if (!sourceId || !id) {
    return (
      <Screen>
        <AppBar title={t('series.title')} onBack={() => router.back()} />
        <ErrorState message={t('story.missing')} />
      </Screen>
    );
  }

  const series = details.data?.series ?? null;
  const stories = series ? seriesToStories(sourceId, series) : [];

  const downloadAll = () => {
    if (stories.length === 0) return;
    void enqueueMany(stories);
    Alert.alert(t('series.title'), t('series.queued', { count: stories.length }));
  };

  return (
    <Screen>
      <AppBar title={series?.title || t('series.title')} onBack={() => router.back()} />

      {details.isLoading ? (
        <LoadingView label={t('series.loading')} />
      ) : details.isError || !series ? (
        <ErrorState
          message={(details.error as Error)?.message ?? t('series.error')}
          onRetry={() => void details.refetch()}
        />
      ) : (
        <>
          <View style={styles.actions}>
            <Button
              title={t('series.downloadAll')}
              icon="download-outline"
              onPress={downloadAll}
            />
          </View>
          <StoryList
            stories={stories}
            onPressStory={(story) => openStory(story.sourceId, story.id)}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
});
