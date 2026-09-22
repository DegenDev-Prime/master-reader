import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { t } from '@/i18n';
import { StoryList } from '@/components/story-list';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import type { Story } from '@/models/story';
import { openStory } from '@/navigation/routes';
import { useHistoryStore } from '@/stores/history';

export default function HistoryScreen() {
  const items = useHistoryStore((state) => state.items);
  const refresh = useHistoryStore((state) => state.refresh);
  const clear = useHistoryStore((state) => state.clear);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const stories = items.map((item) => item.story).filter((story): story is Story => story !== null);

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
        right={
          items.length > 0 ? (
            <Button variant="ghost" title={t('common.clear')} onPress={confirmClear} />
          ) : null
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title={t('history.emptyTitle')}
          message={t('history.emptyMessage')}
        />
      ) : (
        <StoryList
          stories={stories}
          onPressStory={(story) => openStory(story.sourceId, story.id)}
          onRefresh={() => void refresh()}
        />
      )}
    </Screen>
  );
}
