import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { t } from '@/i18n';
import { Cover } from '@/components/ui/cover';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { LoadingView } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { libraryRepository, type LibraryNovel } from '@/db/repositories/library';
import { useTheme } from '@/hooks/use-theme';
import type { LibraryView } from '@/services/settings';
import { useSettingsStore } from '@/stores/settings';

type Filter = 'all' | 'reading' | 'unread' | 'downloaded';

export default function LibraryScreen() {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const view = useSettingsStore((state) => state.settings.defaultLibraryView);
  const setSetting = useSettingsStore((state) => state.setSetting);

  const [items, setItems] = useState<LibraryNovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    const list = await libraryRepository.listNovels();
    setItems(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (!item.novel) return false;
      if (filter === 'reading') return item.progress != null;
      if (filter === 'unread') return item.counts.read < item.counts.total;
      if (filter === 'downloaded') return item.counts.downloaded > 0;
      return true;
    });
  }, [filter, items]);

  const hero = useMemo(() => {
    return items.find((item) => item.novel && item.progress?.chapterId) ?? null;
  }, [items]);

  const openStory = useCallback((item: LibraryNovel) => {
    if (!item.novel) return;
    router.push({
      pathname: '/story/[sourceId]/[id]',
      params: { sourceId: item.novel.sourceId, id: item.novel.id },
    });
  }, []);

  const resume = useCallback((item: LibraryNovel) => {
    if (!item.novel) return;
    const chapterId = item.progress?.chapterId;
    if (chapterId) {
      router.push({
        pathname: '/reader/[sourceId]/[novelId]/[chapterId]',
        params: {
          sourceId: item.novel.sourceId,
          novelId: item.novel.id,
          chapterId,
        },
      });
      return;
    }
    router.push({
      pathname: '/chapters/[sourceId]/[id]',
      params: { sourceId: item.novel.sourceId, id: item.novel.id },
    });
  }, []);

  const remove = useCallback(
    (item: LibraryNovel) => {
      if (!item.novel) return;
      Alert.alert(t('library.removeTitle'), t('library.removeMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => {
            void libraryRepository.remove(item.novel!.sourceId, item.novel!.id).then(load);
          },
        },
      ]);
    },
    [load],
  );

  const columns = width >= 700 ? 5 : width >= 500 ? 4 : 3;
  const cellWidth = Math.floor(
    (Math.min(width, 900) - Spacing.three * 2 - (columns - 1) * Spacing.two) / columns,
  );
  const gridRows = useMemo(() => {
    const rows: LibraryNovel[][] = [];
    for (let index = 0; index < filtered.length; index += columns) {
      rows.push(filtered.slice(index, index + columns));
    }
    return rows;
  }, [columns, filtered]);

  const header = (
    <View>
      {hero?.novel ? <ContinueHero item={hero} onPress={() => resume(hero)} /> : null}
      <View style={styles.shelfHeader}>
        <ThemedText type="eyebrow">{t('library.shelfEyebrow')}</ThemedText>
        <ViewToggle view={view} onChange={(next) => void setSetting('defaultLibraryView', next)} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        <Chip
          label={t('library.filterAll')}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <Chip
          label={t('library.filterReading')}
          selected={filter === 'reading'}
          onPress={() => setFilter('reading')}
        />
        <Chip
          label={t('library.filterUnread')}
          selected={filter === 'unread'}
          onPress={() => setFilter('unread')}
        />
        <Chip
          label={t('library.filterDownloaded')}
          selected={filter === 'downloaded'}
          onPress={() => setFilter('downloaded')}
        />
      </ScrollView>
    </View>
  );

  return (
    <Screen>
      <ScreenHeader
        title={t('tabs.library')}
        subtitle={items.length > 0 ? t('library.count', { count: items.length }) : undefined}
        actions={
          <>
            <IconButton
              icon="search"
              label={t('library.search')}
              onPress={() => router.push('/search')}
            />
            <IconButton
              icon="download-outline"
              label={t('downloads.title')}
              onPress={() => router.push('/downloads')}
            />
          </>
        }
      />

      {loading ? (
        <LoadingView label={t('common.loading')} />
      ) : items.length === 0 ? (
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
      ) : view === 'grid' ? (
        <FlashList
          key={`grid-${columns}`}
          data={gridRows}
          keyExtractor={(row) =>
            row.map((item) => `${item.entry.sourceId}:${item.entry.storyId}`).join('|')
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={header}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          ListEmptyComponent={
            <EmptyState
              icon="funnel-outline"
              title={t('library.noMatchTitle')}
              message={t('library.noMatchMessage')}
              action={
                <Button
                  title={t('library.clearFilter')}
                  variant="secondary"
                  onPress={() => setFilter('all')}
                />
              }
            />
          }
          renderItem={({ item: row }) => (
            <View style={styles.gridRow}>
              {row.map((item) => (
                <View
                  key={`${item.entry.sourceId}:${item.entry.storyId}`}
                  style={{ width: cellWidth }}
                >
                  <GridCard
                    item={item}
                    width={cellWidth}
                    onPress={() => openStory(item)}
                    onLongPress={() => remove(item)}
                  />
                </View>
              ))}
            </View>
          )}
        />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => `${item.entry.sourceId}:${item.entry.storyId}`}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={header}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          ListEmptyComponent={
            <EmptyState
              icon="funnel-outline"
              title={t('library.noMatchTitle')}
              message={t('library.noMatchMessage')}
              action={
                <Button
                  title={t('library.clearFilter')}
                  variant="secondary"
                  onPress={() => setFilter('all')}
                />
              }
            />
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
          )}
          renderItem={({ item }) => (
            <ListRow item={item} onPress={() => openStory(item)} onLongPress={() => remove(item)} />
          )}
        />
      )}
    </Screen>
  );
}

function ContinueHero({ item, onPress }: { item: LibraryNovel; onPress: () => void }) {
  const theme = useTheme();
  const novel = item.novel!;
  const total = item.counts.total;
  const current = (item.progress?.pageIndex ?? 0) + 1;
  const percent = total > 0 ? Math.min(1, current / total) : 0;

  return (
    <View
      style={[styles.hero, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
    >
      <ThemedText type="eyebrow">{t('library.continueEyebrow')}</ThemedText>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${novel.title}. ${t('library.resumeReading')}`}
        style={({ pressed }) => [styles.heroBody, pressed && { opacity: 0.9 }]}
      >
        <Cover uri={novel.coverUrl} title={novel.title} width={68} />
        <View style={styles.heroText}>
          <ThemedText type="heading" numberOfLines={2}>
            {novel.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {novel.authorName ?? t('story.unknownAuthor')}
          </ThemedText>
          <ThemedText type="small" themeColor="textMuted">
            {t('library.resumeChapter', { chapter: current, total })}
          </ThemedText>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[styles.fill, { backgroundColor: theme.primary, width: `${percent * 100}%` }]}
            />
          </View>
        </View>
      </Pressable>
      <Button title={t('library.resumeReading')} icon="book-outline" onPress={onPress} />
    </View>
  );
}

function GridCard({
  item,
  width,
  onPress,
  onLongPress,
}: {
  item: LibraryNovel;
  width: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const novel = item.novel!;
  const unread = Math.max(0, item.counts.total - item.counts.read);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${novel.title}. ${t('library.chaptersRead', {
        read: item.counts.read,
        total: item.counts.total,
      })}`}
      style={({ pressed }) => [styles.gridCard, pressed && { opacity: 0.85 }]}
    >
      <View>
        <Cover uri={novel.coverUrl} title={novel.title} width={width} />
        {unread > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <ThemedText type="smallBold" style={{ color: theme.primaryText }}>
              {unread > 99 ? '99+' : unread}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText type="small" numberOfLines={2} style={styles.gridTitle}>
        {novel.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
        {item.counts.total > 0
          ? t('library.chaptersRead', {
              read: item.counts.read,
              total: item.counts.total,
            })
          : t('library.noChapters')}
      </ThemedText>
    </Pressable>
  );
}

function ListRow({
  item,
  onPress,
  onLongPress,
}: {
  item: LibraryNovel;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const novel = item.novel!;
  const unread = Math.max(0, item.counts.total - item.counts.read);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={novel.title}
      style={({ pressed }) => [
        styles.listRow,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.background },
      ]}
    >
      <Cover uri={novel.coverUrl} title={novel.title} width={48} />
      <View style={styles.listText}>
        <ThemedText type="bodyStrong" numberOfLines={2}>
          {novel.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {novel.authorName ?? t('story.unknownAuthor')}
        </ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {item.counts.total > 0
            ? t('library.chaptersRead', {
                read: item.counts.read,
                total: item.counts.total,
              })
            : t('library.noChapters')}
          {unread > 0 ? ` · ${t('library.unreadCount', { count: unread })}` : ''}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: LibraryView;
  onChange: (view: LibraryView) => void;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('library.viewToggleLabel')}
      style={[
        styles.toggleGroup,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <ToggleSegment
        icon="grid-outline"
        label={t('library.gridLabel')}
        selected={view === 'grid'}
        onPress={() => onChange('grid')}
      />
      <ToggleSegment
        icon="list"
        label={t('library.listLabel')}
        selected={view === 'list'}
        onPress={() => onChange('list')}
      />
    </View>
  );
}

function ToggleSegment({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.toggleSegment,
        selected && { backgroundColor: theme.primary },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons name={icon} size={20} color={selected ? theme.primaryText : theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: Spacing.six },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  gridCard: { gap: Spacing.one },
  gridTitle: { marginTop: Spacing.one },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 20,
    minWidth: 24,
    paddingHorizontal: 5,
    position: 'absolute',
    right: 4,
    top: 4,
  },
  hero: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    marginBottom: Spacing.three,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    padding: Spacing.three,
  },
  heroBody: { flexDirection: 'row', gap: Spacing.three },
  heroText: { flex: 1, gap: Spacing.one, justifyContent: 'center' },
  track: { height: 2, marginTop: Spacing.one, overflow: 'hidden' },
  fill: { height: 2 },
  shelfHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  filters: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  toggleGroup: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  toggleSegment: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
  },
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 88,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  listText: { flex: 1, gap: Spacing.half },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
});
