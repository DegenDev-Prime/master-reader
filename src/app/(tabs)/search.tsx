import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { StoryList } from '@/components/story-list';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingView } from '@/components/ui/loading';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useSearch } from '@/hooks/queries';
import type { Story } from '@/models/story';
import { openStory } from '@/navigation/routes';
import { DEFAULT_SOURCE_ID } from '@/services/source-manager';
import type { SearchFilters, SearchSort } from '@/sources';

const SORTS: { value: SearchSort; label: string }[] = [
  { value: 'relevance', label: t('sort.relevance') },
  { value: 'newest', label: t('sort.newest') },
  { value: 'rating', label: t('sort.rating') },
  { value: 'comments', label: t('sort.comments') },
];

export default function SearchScreen() {
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState<SearchSort>('relevance');
  const [submitted, setSubmitted] = useState<SearchFilters | null>(null);

  const results = useSearch(DEFAULT_SOURCE_ID, submitted ?? {}, Boolean(submitted));
  const stories: Story[] = results.data?.pages.flatMap((page) => page.items) ?? [];

  const submit = () => {
    const trimmed = term.trim();
    setSubmitted({
      query: trimmed.length > 0 ? trimmed : undefined,
      sort,
    });
  };

  const selectSort = (value: SearchSort) => {
    setSort(value);
    setSubmitted((current) => (current ? { ...current, sort: value } : current));
  };

  const showInitialError = results.isError && stories.length === 0;

  return (
    <Screen>
      <AppBar title={t('search.title')} />

      <OfflineBanner />

      <View style={styles.searchRow}>
        <View style={styles.input}>
          <TextField
            icon="search"
            placeholder={t('search.placeholder')}
            value={term}
            onChangeText={setTerm}
            returnKeyType="search"
            onSubmitEditing={submit}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Button title={t('search.action')} onPress={submit} />
      </View>

      <View style={styles.sorts}>
        {SORTS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={sort === option.value}
            onPress={() => selectSort(option.value)}
          />
        ))}
      </View>

      {!submitted ? (
        <EmptyState
          icon="search-outline"
          title={t('search.promptTitle')}
          message={t('search.promptMessage')}
        />
      ) : results.isLoading ? (
        <LoadingView label={t('search.loading')} />
      ) : showInitialError ? (
        <ErrorState
          message={(results.error as Error)?.message}
          onRetry={() => void results.refetch()}
        />
      ) : stories.length === 0 ? (
        <EmptyState
          icon="sad-outline"
          title={t('search.noResultsTitle')}
          message={t('search.noResultsMessage')}
        />
      ) : (
        <StoryList
          stories={stories}
          onPressStory={(story) => openStory(story.sourceId, story.id)}
          onEndReached={() => {
            if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
          }}
          isFetchingNextPage={results.isFetchingNextPage}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  input: { flex: 1 },
  sorts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
