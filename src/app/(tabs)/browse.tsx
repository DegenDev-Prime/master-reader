import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { StoryList } from '@/components/story-list';
import { AppBar } from '@/components/ui/app-bar';
import { Chip } from '@/components/ui/chip';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingView } from '@/components/ui/loading';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useBrowse, useCategories } from '@/hooks/queries';
import type { Story } from '@/models/story';
import { openStory } from '@/navigation/routes';
import type { BrowseKind } from '@/services/catalog';
import { DEFAULT_SOURCE_ID } from '@/services/source-manager';

const KINDS: { value: BrowseKind; label: string }[] = [
  { value: 'popular', label: t('browse.popular') },
  { value: 'latest', label: t('browse.latest') },
];

export default function BrowseScreen() {
  const [kind, setKind] = useState<BrowseKind>('popular');
  const [category, setCategory] = useState<string | null>(null);

  const categories = useCategories(DEFAULT_SOURCE_ID);
  const query = useBrowse(DEFAULT_SOURCE_ID, kind, category ?? undefined);

  const stories = useMemo<Story[]>(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const showInitialError = query.isError && stories.length === 0;

  return (
    <Screen>
      <AppBar title={t('browse.title')} subtitle={t('browse.subtitle')} />

      <OfflineBanner />

      <View style={styles.filters}>
        {KINDS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={kind === option.value}
            onPress={() => setKind(option.value)}
          />
        ))}
      </View>

      {categories.data && categories.data.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
          contentContainerStyle={styles.categories}
        >
          <Chip
            label={t('browse.allCategories')}
            selected={category === null}
            onPress={() => setCategory(null)}
          />
          {categories.data.map((option) => (
            <Chip
              key={option.id}
              label={option.name}
              selected={category === option.id}
              onPress={() => setCategory(category === option.id ? null : option.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {query.isLoading ? (
        <LoadingView label={t('browse.loading')} />
      ) : showInitialError ? (
        <ErrorState
          message={(query.error as Error)?.message}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <StoryList
          stories={stories}
          onPressStory={(story) => openStory(story.sourceId, story.id)}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          isFetchingNextPage={query.isFetchingNextPage}
          isRefreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  categoryRow: { flexGrow: 0, maxHeight: 48 },
  categories: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
});
