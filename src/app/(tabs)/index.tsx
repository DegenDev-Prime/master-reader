import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { t } from '@/i18n';
import { StoryList } from '@/components/story-list';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import type { Story } from '@/models/story';
import { useLibraryStore } from '@/stores/library';

function countLabel(count: number): string {
  return t('library.count', { count });
}

export default function LibraryScreen() {
  const stories = useLibraryStore((state) => state.stories);
  const isHydrated = useLibraryStore((state) => state.isHydrated);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const hydrate = useLibraryStore((state) => state.hydrate);
  const refresh = useLibraryStore((state) => state.refresh);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
      void refresh();
    }, [hydrate, refresh]),
  );

  const items = stories.map((item) => item.story).filter((story): story is Story => story !== null);

  const unreadKeys = new Set(
    stories
      .filter((item) => item.entry.isUnread)
      .map((item) => `${item.entry.sourceId}:${item.entry.storyId}`),
  );

  const isEmpty = isHydrated && items.length === 0;

  return (
    <Screen>
      <AppBar
        title={t('tabs.library')}
        subtitle={isHydrated ? countLabel(items.length) : undefined}
        right={
          <IconButton
            icon="download-outline"
            label={t('downloads.title')}
            onPress={() => router.push('/downloads')}
          />
        }
      />

      {isEmpty ? (
        <EmptyState
          icon="library-outline"
          title={t('library.emptyTitle')}
          message={t('library.emptyMessage')}
          action={
            <Button
              title={t('library.browse')}
              icon="compass"
              onPress={() => router.push('/browse')}
            />
          }
        />
      ) : (
        <StoryList
          stories={items}
          onPressStory={(story) => router.push(`/story/${story.sourceId}/${story.id}`)}
          isUnread={(story) => unreadKeys.has(`${story.sourceId}:${story.id}`)}
          isRefreshing={isLoading}
          onRefresh={() => void refresh()}
        />
      )}
    </Screen>
  );
}
