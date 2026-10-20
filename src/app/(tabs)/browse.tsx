import { useMemo, useReducer, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { StoryList } from '@/components/story-list';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { IconButton } from '@/components/ui/icon-button';
import { LoadingView } from '@/components/ui/loading';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { OptionSheet, type OptionSheetOption } from '@/components/ui/option-sheet';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useBrowse, useCategories, useSearch } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useOpenStory } from '@/navigation/routes';
import { DEFAULT_SOURCE_ID, listSourceInfos } from '@/services/source-manager';
import { useSettingsStore } from '@/stores/settings';
import { OfflineError, type BrowseKind, type SearchSort } from '@/sources';
import {
  browseReducer,
  initialBrowseState,
  isSearchActive,
  isStale,
  toSearchFilters,
} from '@/utils/browse-state';

const SORTS: OptionSheetOption<SearchSort>[] = [
  { value: 'relevance', label: t('sort.relevance') },
  { value: 'newest', label: t('sort.newest') },
  { value: 'rating', label: t('sort.rating') },
  { value: 'comments', label: t('sort.comments') },
];

type Sheet = 'category' | 'sort' | 'provider';

export default function BrowseScreen() {
  const [state, dispatch] = useReducer(browseReducer, initialBrowseState);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const theme = useTheme();

  const activeSourceId = useSettingsStore((store) => store.settings.activeSourceId);
  const setSetting = useSettingsStore((store) => store.setSetting);

  const providers = useMemo(() => listSourceInfos(), []);
  const providerOptions = useMemo<OptionSheetOption<string>[]>(
    () => providers.map((provider) => ({ value: provider.id, label: provider.name })),
    [providers],
  );
  const source =
    providers.find((provider) => provider.id === activeSourceId) ??
    providers.find((provider) => provider.id === DEFAULT_SOURCE_ID);
  const sourceId = source?.id ?? DEFAULT_SOURCE_ID;
  const capabilities = source?.capabilities ?? [];
  const canSearch = capabilities.includes('search');
  const canLatest = capabilities.includes('latest');
  const canCategories = capabilities.includes('categories');

  const kinds = useMemo<SegmentedOption<BrowseKind>[]>(() => {
    const options: SegmentedOption<BrowseKind>[] = [
      { value: 'popular', label: t('browse.popular') },
    ];
    if (canLatest) options.push({ value: 'latest', label: t('browse.latest') });
    return options;
  }, [canLatest]);

  const searching = isSearchActive(state);
  const searchFilters = toSearchFilters(state);

  const categories = useCategories(sourceId);
  const browseQuery = useBrowse(sourceId, state.kind, state.category ?? undefined);
  const searchQuery = useSearch(sourceId, searchFilters ?? {}, searching && canSearch);
  const active = searching ? searchQuery : browseQuery;

  const browseStories = useMemo(
    () => browseQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [browseQuery.data],
  );
  const searchStories = useMemo(
    () => searchQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [searchQuery.data],
  );
  const stories = searching ? searchStories : browseStories;
  const openStoryRow = useOpenStory();

  const hasData = stories.length > 0;
  const isInitialLoading = active.isLoading && !hasData;
  const isInitialError = active.isError && !hasData;
  const isOfflineError = active.error instanceof OfflineError;
  const isRefreshing = active.isRefetching && !active.isFetchingNextPage;

  const filterKey = `${sourceId}|${state.mode}|${state.query}|${state.kind}|${state.category}|${state.sort}`;
  const footerError = failedKey === filterKey && active.isError && !active.isFetchingNextPage;

  const loadMore = () => {
    if (!active.hasNextPage || active.isFetchingNextPage) return;
    void active.fetchNextPage().then(
      (result) => setFailedKey(result.isError ? filterKey : null),
      () => setFailedKey(filterKey),
    );
  };

  const submit = () => {
    Keyboard.dismiss();
    dispatch({ type: 'submit' });
  };

  const exitSearch = () => {
    Keyboard.dismiss();
    dispatch({ type: 'clear' });
  };

  const selectProvider = (id: string | null) => {
    setSheet(null);
    if (!id || id === sourceId) return;
    dispatch({ type: 'reset' });
    void setSetting('activeSourceId', id);
  };

  const selectedCategory = categories.data?.find((option) => option.id === state.category) ?? null;
  const categoryLabel = selectedCategory ? selectedCategory.name : t('browse.allCategories');
  const categoryOptions = useMemo<OptionSheetOption<string>[]>(
    () => (categories.data ?? []).map((option) => ({ value: option.id, label: option.name })),
    [categories.data],
  );
  const sortLabel =
    SORTS.find((option) => option.value === state.sort)?.label ?? t('sort.relevance');
  const showCategoryChip = canCategories && Boolean(categories.data && categories.data.length > 0);

  return (
    <Screen>
      <AppBar
        title={searching ? t('search.title') : t('browse.title')}
        subtitle={
          searching
            ? t('search.resultsFor', { query: state.query ?? '' })
            : (source?.name ?? t('browse.subtitle'))
        }
        right={
          searching ? (
            <IconButton icon="close" label={t('search.exit')} onPress={exitSearch} />
          ) : providers.length > 1 ? (
            <IconButton
              icon="swap-horizontal"
              label={t('browse.chooseProvider')}
              onPress={() => setSheet('provider')}
            />
          ) : null
        }
      />

      <OfflineBanner />

      {canSearch ? (
        <View style={styles.searchRow}>
          <View style={styles.input}>
            <TextField
              icon="search"
              accessibilityLabel={t('search.fieldLabel')}
              placeholder={t('search.placeholder')}
              value={state.term}
              onChangeText={(term) => dispatch({ type: 'setTerm', term })}
              returnKeyType="search"
              onSubmitEditing={submit}
              autoCapitalize="none"
              autoCorrect={false}
              right={
                state.term.length > 0 ? (
                  <IconButton
                    icon="close"
                    label={t('search.clearSearch')}
                    onPress={() => dispatch({ type: 'setTerm', term: '' })}
                  />
                ) : null
              }
            />
          </View>
          <Button title={t('search.action')} onPress={submit} />
        </View>
      ) : null}

      {source ? (
        <View style={[styles.sourceRow, { borderBottomColor: theme.border }]}>
          <ThemedText
            type="eyebrow"
            numberOfLines={1}
            accessibilityLabel={`${t('browse.activeSourceEyebrow')}: ${source.name}`}
          >
            {source.name}
          </ThemedText>
          {providers.length > 1 ? (
            <Button
              variant="ghost"
              title={t('browse.changeSource')}
              onPress={() => setSheet('provider')}
            />
          ) : null}
        </View>
      ) : null}

      {canSearch && isStale(state) ? (
        <View style={styles.hintRow} accessibilityLiveRegion="polite">
          <ThemedText type="small" themeColor="textSecondary">
            {t('search.unsubmitted')}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {searching ? (
          <Chip
            label={sortLabel}
            icon="swap-vertical"
            selected={state.sort !== 'relevance'}
            accessibilityLabel={t('browse.sortBy', { name: sortLabel })}
            onPress={() => setSheet('sort')}
            style={styles.grow}
          />
        ) : (
          <SegmentedControl
            label={t('browse.listingLabel')}
            options={kinds}
            value={state.kind}
            onChange={(kind) => dispatch({ type: 'setKind', kind })}
            style={styles.grow}
          />
        )}

        {showCategoryChip ? (
          <Chip
            label={categoryLabel}
            selected={state.category !== null}
            accessibilityLabel={t('browse.filterCategory', { name: categoryLabel })}
            onPress={() => setSheet('category')}
            style={styles.category}
          />
        ) : null}
      </View>

      <View style={styles.body}>
        {isInitialLoading ? (
          <LoadingView label={searching ? t('search.loading') : t('browse.loading')} />
        ) : isInitialError ? (
          <ErrorState
            title={isOfflineError ? t('offline.listTitle') : undefined}
            message={isOfflineError ? t('offline.listMessage') : active.error?.message}
            onRetry={() => void active.refetch()}
          />
        ) : !hasData ? (
          searching ? (
            <EmptyState
              icon="sad-outline"
              title={t('search.noResultsTitle')}
              message={t('search.noResultsMessage')}
            />
          ) : (
            <EmptyState
              icon="compass-outline"
              title={t('browse.emptyTitle')}
              message={t('browse.emptyMessage')}
              action={
                state.category !== null ? (
                  <Button
                    title={t('browse.clearFilters')}
                    icon="close"
                    onPress={() => dispatch({ type: 'setCategory', category: null })}
                  />
                ) : undefined
              }
            />
          )
        ) : (
          <StoryList
            stories={stories}
            onPressStory={openStoryRow}
            onEndReached={loadMore}
            isFetchingNextPage={active.isFetchingNextPage}
            isRefreshing={isRefreshing}
            onRefresh={() => void active.refetch()}
            hasMore={active.hasNextPage}
            footerError={footerError}
            onRetryMore={loadMore}
          />
        )}
      </View>

      <OptionSheet
        visible={sheet === 'category'}
        title={t('browse.categories')}
        allLabel={t('browse.allCategories')}
        options={categoryOptions}
        value={state.category}
        onSelect={(value) => {
          dispatch({ type: 'setCategory', category: value });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />

      <OptionSheet
        visible={sheet === 'sort'}
        title={t('sort.label')}
        options={SORTS}
        value={state.sort}
        onSelect={(value) => {
          dispatch({ type: 'setSort', sort: value ?? 'relevance' });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />

      <OptionSheet
        visible={sheet === 'provider'}
        title={t('browse.chooseProvider')}
        options={providerOptions}
        value={sourceId}
        onSelect={selectProvider}
        onClose={() => setSheet(null)}
      />
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
  hintRow: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.half,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  grow: { flex: 1, minWidth: 0 },
  category: { maxWidth: '45%' },
  body: { flex: 1 },
});
