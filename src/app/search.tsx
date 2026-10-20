import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Cover } from '@/components/ui/cover';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { OptionSheet } from '@/components/ui/option-sheet';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Novel } from '@/models/novel';
import { searchNovels } from '@/services/novel-catalog';
import { listSourceInfos, getSourceInfo } from '@/services/source-manager';
import { useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/stores/settings';
import { useBackToParent } from '@/navigation/use-parent-back';

export default function SearchScreen() {
  const backToParent = useBackToParent();
  const theme = useTheme();
  const sourceId = useSettingsStore((state) => state.settings.activeSourceId);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [items, setItems] = useState<Novel[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);

  const source = getSourceInfo(sourceId);
  const sources = listSourceInfos();

  const run = useCallback(
    async (text: string, nextPage: number) => {
      if (!text.trim()) return;
      if (nextPage === 1) {
        setLoading(true);
        setItems([]);
        setError(null);
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await searchNovels(sourceId, { query: text.trim() }, nextPage);
        setItems((current) => (nextPage === 1 ? result.items : [...current, ...result.items]));
        setPage(result.page);
        setHasNext(result.hasNext);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('search.noResultsMessage'));
        if (nextPage === 1) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sourceId],
  );

  return (
    <Screen>
      <AppBar title={t('search.title')} onBack={() => backToParent({ pathname: '/' })} />
      <View style={styles.searchRow}>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => {
              setSubmitted(query.trim());
              void run(query, 1);
            }}
            placeholder={t('search.placeholder')}
            placeholderTextColor={theme.textMuted}
            returnKeyType="search"
            style={[styles.input, { color: theme.text }]}
            accessibilityLabel={t('search.fieldLabel')}
          />
          {query.length > 0 ? (
            <IconButton icon="close" label={t('search.clearSearch')} onPress={() => setQuery('')} />
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={() => setSourceOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('browse.chooseProvider')}
        style={({ pressed }) => [
          styles.sourceRow,
          {
            backgroundColor: pressed ? theme.backgroundSelected : theme.background,
            borderBottomColor: theme.border,
            borderTopColor: theme.border,
          },
        ]}
      >
        <Ionicons name="globe-outline" size={18} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('browse.activeSourceEyebrow')}
        </ThemedText>
        <ThemedText type="smallBold" style={styles.sourceName} numberOfLines={1}>
          {source?.name ?? sourceId}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="primary">
          {t('browse.changeSource')}
        </ThemedText>
      </Pressable>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('search.loading')}
          </ThemedText>
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title={submitted ? t('search.noResultsTitle') : t('search.promptTitle')}
          message={submitted ? (error ?? t('search.noResultsMessage')) : t('search.promptMessage')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.sourceId}:${item.id}`}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.resultsLabel}>
              {t('search.resultsFor', { query: submitted })}
            </ThemedText>
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (hasNext && !loading && !loadingMore) {
              void run(submitted, page + 1);
            }
          }}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footer} color={theme.primary} /> : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/story/[sourceId]/[id]',
                  params: { sourceId: item.sourceId, id: item.id },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={item.title}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? theme.backgroundSelected : theme.background,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <Cover uri={item.coverUrl} title={item.title} width={48} />
              <View style={styles.rowText}>
                <ThemedText type="bodyStrong" numberOfLines={2}>
                  {item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.authorName ?? t('story.unknownAuthor')}
                </ThemedText>
                <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
                  {[
                    item.chapterCount != null
                      ? `${item.chapterCount} ${t('common.chapters')}`
                      : null,
                    item.genres?.slice(0, 2).join(' · '),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          )}
        />
      )}

      <OptionSheet
        visible={sourceOpen}
        title={t('browse.chooseProvider')}
        value={sourceId}
        options={sources.map((info) => ({ value: info.id, label: info.name }))}
        onSelect={(value) => {
          setSourceOpen(false);
          if (value && value !== sourceId) {
            setItems([]);
            setSubmitted('');
            setPage(0);
            setHasNext(false);
            setError(null);
            void setSetting('activeSourceId', value);
          }
        }}
        onClose={() => setSourceOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { padding: Spacing.three },
  inputWrap: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingLeft: Spacing.twoHalf,
    paddingRight: Spacing.one,
  },
  input: { flex: 1, fontSize: 16, minHeight: 48 },
  sourceRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sourceName: { flex: 1 },
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.two,
    justifyContent: 'center',
  },
  list: { paddingBottom: Spacing.six },
  resultsLabel: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.one },
  footer: { padding: Spacing.four },
});
