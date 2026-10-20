import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackToParent } from '@/navigation/use-parent-back';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { LoadingView } from '@/components/ui/loading';
import { OptionSheet } from '@/components/ui/option-sheet';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  chapterReadsRepository,
  chapterRepository,
  type ChapterListItem,
} from '@/db/repositories/chapters';
import { chapterDownloadsRepository } from '@/db/repositories/chapter-downloads';
import { progressRepository } from '@/db/repositories/progress';
import type { ReadingProgress } from '@/models/story';
import { downloadChapterRange } from '@/services/chapter-downloads';
import { syncNovel } from '@/services/novel-catalog';
import { useTheme } from '@/hooks/use-theme';
import { withAlpha } from '@/utils/color';
import { chapterDisplayTitle } from '@/sources/content/chapter-title';

type Filter = 'all' | 'unread' | 'downloaded';
type Sort = 'asc' | 'desc';

const ROW_HEIGHT = 56;

export default function ChaptersScreen() {
  const { sourceId, id } = useLocalSearchParams<{ sourceId: string; id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChapterListItem>>(null);
  const didScroll = useRef(false);

  const [chapters, setChapters] = useState<ChapterListItem[]>([]);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('asc');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpText, setJumpText] = useState('');
  const [selected, setSelected] = useState<ChapterListItem | null>(null);

  const load = useCallback(async () => {
    if (!sourceId || !id) return [];
    const [list, savedProgress] = await Promise.all([
      chapterRepository.listMetadata(sourceId, id),
      progressRepository.get(sourceId, id),
    ]);
    setChapters(list);
    setProgress(savedProgress);
    setLoading(false);
    return list;
  }, [sourceId, id]);

  const refresh = useCallback(async () => {
    if (!sourceId || !id) return;
    setRefreshing(true);
    try {
      const result = await syncNovel(sourceId, id);
      setChapters(result.chapters);
      setProgress(await progressRepository.get(sourceId, id));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, [sourceId, id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load().then((list) => {
        if (active && list.length === 0) void refresh();
      });
      return () => {
        active = false;
      };
    }, [load, refresh]),
  );

  const currentId = progress?.chapterId ?? null;
  const readCount = chapters.filter((chapter) => chapter.readAt != null).length;
  const downloadedCount = chapters.filter((chapter) => chapter.hasContent).length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = chapters.filter((chapter) => {
      if (filter === 'unread' && chapter.readAt != null) return false;
      if (filter === 'downloaded' && !chapter.hasContent) return false;
      if (!query) return true;
      const number = String(chapter.number ?? chapter.position + 1);
      return chapter.title.toLowerCase().includes(query) || number.includes(query);
    });
    return sort === 'asc' ? list : [...list].reverse();
  }, [chapters, filter, search, sort]);

  const currentIndex = filtered.findIndex((chapter) => chapter.id === currentId);

  useEffect(() => {
    if (didScroll.current || currentIndex < 0 || filtered.length === 0) return;
    didScroll.current = true;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: currentIndex,
        viewPosition: 0.35,
        animated: false,
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [currentIndex, filtered.length]);

  const storyTarget = {
    pathname: '/story/[sourceId]/[id]',
    params: { sourceId, id },
  };

  const openChapter = useCallback(
    (chapterId: string) => {
      if (!sourceId || !id) return;
      router.push({
        pathname: '/reader/[sourceId]/[novelId]/[chapterId]',
        params: { sourceId, novelId: id, chapterId },
      });
    },
    [sourceId, id],
  );

  const backToParent = useBackToParent();

  const markRead = useCallback(
    async (chapter: ChapterListItem, read: boolean) => {
      if (!sourceId || !id) return;
      if (read) {
        await chapterReadsRepository.markRead(sourceId, id, chapter.id);
      } else {
        await chapterReadsRepository.markUnread(sourceId, id, chapter.id);
      }
      await load();
    },
    [sourceId, id, load],
  );

  const markThrough = useCallback(
    (chapter: ChapterListItem) => {
      if (!sourceId || !id) return;
      const count = chapters.filter((item) => item.position <= chapter.position).length;
      Alert.alert(t('chapters.markThroughTitle', { count }), t('chapters.markThroughMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chapters.markRead'),
          onPress: () => {
            void chapterReadsRepository.markReadThrough(sourceId, id, chapter.position).then(load);
          },
        },
      ]);
    },
    [sourceId, id, chapters, load],
  );

  const download = useCallback(
    async (chapter: ChapterListItem) => {
      if (!sourceId || !id) return;
      try {
        await downloadChapterRange(sourceId, id, [chapter.id]);
        await load();
      } catch {
        Alert.alert(t('download.failed'), t('story.error'));
      }
    },
    [sourceId, id, load],
  );

  const deleteDownload = useCallback(
    async (chapter: ChapterListItem) => {
      if (!sourceId || !id) return;
      await chapterDownloadsRepository.remove(sourceId, id, [chapter.id]);
      await chapterRepository.removeContent(sourceId, id, [chapter.id]);
      await load();
    },
    [sourceId, id, load],
  );

  const onRowAction = useCallback(
    (value: string | null) => {
      const chapter = selected;
      setSelected(null);
      if (!value || !chapter) return;
      if (value === 'read') void markRead(chapter, true);
      if (value === 'unread') void markRead(chapter, false);
      if (value === 'through') markThrough(chapter);
      if (value === 'download') void download(chapter);
      if (value === 'delete') void deleteDownload(chapter);
    },
    [selected, markRead, markThrough, download, deleteDownload],
  );

  const onMenu = useCallback(
    (value: string | null) => {
      setMenuOpen(false);
      if (!value || !sourceId || !id) return;
      if (value === 'refresh') void refresh();
      if (value === 'sort') setSort((current) => (current === 'asc' ? 'desc' : 'asc'));
      if (value === 'read') {
        void chapterReadsRepository
          .markReadThrough(sourceId, id, Number.MAX_SAFE_INTEGER)
          .then(load);
      }
      if (value === 'unread') {
        void chapterReadsRepository.markAllUnread(sourceId, id).then(load);
      }
    },
    [sourceId, id, refresh, load],
  );

  const jump = useCallback(() => {
    const wanted = Number(jumpText.trim());
    if (!Number.isFinite(wanted) || wanted < 1 || wanted > chapters.length) return;

    let target = chapters[0];
    let best = Number.POSITIVE_INFINITY;
    for (const chapter of chapters) {
      const number = chapter.number ?? chapter.position + 1;
      const distance = Math.abs(number - wanted);
      if (distance < best) {
        best = distance;
        target = chapter;
      }
    }
    if (!target) return;

    setJumpOpen(false);
    setJumpText('');
    setFilter('all');
    setSearch('');
    setSort('asc');
    const index = chapters.findIndex((chapter) => chapter.id === target.id);
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated: true });
    }, 80);
  }, [jumpText, chapters]);

  const currentNumber = progress?.chapterId
    ? (chapters.find((chapter) => chapter.id === progress.chapterId)?.number ?? null)
    : null;

  if (loading) {
    return (
      <Screen>
        <AppBar title={t('chapters.title')} onBack={() => backToParent(storyTarget)} />
        <LoadingView label={t('common.loading')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar
        title={t('chapters.title')}
        onBack={() => backToParent(storyTarget)}
        right={
          <View style={styles.appActions}>
            <IconButton
              icon="search"
              label={t('chapters.searchPlaceholder')}
              onPress={() => setSearchOpen((open) => !open)}
            />
            <IconButton
              icon="ellipsis-horizontal"
              label={t('common.more')}
              onPress={() => setMenuOpen(true)}
            />
          </View>
        }
      />

      <View style={styles.summary}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('chapters.summary', {
            total: chapters.length,
            read: readCount,
            downloaded: downloadedCount,
          })}
        </ThemedText>
        {error ? (
          <ThemedText type="small" themeColor="warning">
            {t('chapters.sourceError')}
          </ThemedText>
        ) : null}
      </View>

      {searchOpen ? (
        <View
          style={[
            styles.search,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder={t('chapters.searchPlaceholder')}
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
          />
          <IconButton icon="close" label={t('common.close')} onPress={() => setSearch('')} />
        </View>
      ) : null}

      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          <Chip
            label={sort === 'asc' ? t('chapters.sortAsc') : t('chapters.sortDesc')}
            icon={sort === 'asc' ? 'arrow-up' : 'arrow-down'}
            onPress={() => setSort((current) => (current === 'asc' ? 'desc' : 'asc'))}
          />
          <Chip
            label={t('chapters.filterAll')}
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <Chip
            label={t('chapters.filterUnread')}
            selected={filter === 'unread'}
            onPress={() => setFilter('unread')}
          />
          <Chip
            label={t('chapters.filterDownloaded')}
            selected={filter === 'downloaded'}
            onPress={() => setFilter('downloaded')}
          />
        </ScrollView>
      </View>

      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(chapter) => chapter.id}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        contentContainerStyle={styles.list}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          setTimeout(() => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, (averageItemLength || ROW_HEIGHT) * index - 180),
              animated: false,
            });
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index,
                viewPosition: 0.35,
                animated: false,
              });
            }, 120);
          }, 100);
        }}
        initialNumToRender={16}
        windowSize={11}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText type="heading">
              {search ? t('chapters.noSearch', { query: search }) : t('chapters.emptyTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {search ? t('chapters.searchPlaceholder') : t('chapters.emptyMessage')}
            </ThemedText>
            <Button
              title={t('common.refresh')}
              variant="secondary"
              onPress={() => void refresh()}
              loading={refreshing}
            />
          </View>
        }
        renderItem={({ item }) => {
          const isCurrent = item.id === currentId;
          const number = item.number ?? item.position + 1;
          return (
            <Pressable
              onPress={() => openChapter(item.id)}
              onLongPress={() => setSelected(item)}
              delayLongPress={350}
              accessibilityRole="button"
              accessibilityLabel={`${number}. ${chapterDisplayTitle(item.title) || t('chapters.untitled')}`}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: isCurrent
                    ? withAlpha(theme.primary, 0.08)
                    : pressed
                      ? theme.backgroundSelected
                      : theme.background,
                  borderBottomColor: theme.border,
                  borderLeftColor: isCurrent ? theme.primary : 'transparent',
                },
              ]}
            >
              <ThemedText
                type="small"
                themeColor={isCurrent ? 'primary' : 'textMuted'}
                style={styles.number}
              >
                {number}
              </ThemedText>
              <ThemedText
                type="default"
                themeColor={isCurrent ? 'text' : 'textSecondary'}
                numberOfLines={1}
                style={styles.title}
              >
                {chapterDisplayTitle(item.title) || t('chapters.untitled')}
              </ThemedText>
              {item.readAt != null ? (
                <Ionicons name="checkmark" size={17} color={theme.success} />
              ) : null}
              {item.hasContent ? (
                <Ionicons name="download-outline" size={16} color={theme.textMuted} />
              ) : null}
            </Pressable>
          );
        }}
      />

      <Pressable
        onPress={() => {
          setJumpText(currentNumber ? String(currentNumber) : '');
          setJumpOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('chapters.jump')}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.primary,
            bottom: insets.bottom + Spacing.three,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Ionicons name="navigate" size={18} color={theme.primaryText} />
        <ThemedText type="smallBold" style={{ color: theme.primaryText }}>
          {t('chapters.jump')}
        </ThemedText>
      </Pressable>

      <OptionSheet
        visible={selected != null}
        title={selected?.title || t('chapters.untitled')}
        value={null}
        options={[
          { value: 'read', label: t('chapters.markRead'), icon: 'checkmark-outline' },
          { value: 'unread', label: t('chapters.markUnread'), icon: 'ellipse-outline' },
          { value: 'through', label: t('chapters.markThrough'), icon: 'checkmark-done-outline' },
          { value: 'download', label: t('chapters.downloadChapter'), icon: 'download-outline' },
          ...(selected?.hasContent
            ? [
                {
                  value: 'delete' as const,
                  label: t('chapters.deleteChapter'),
                  icon: 'trash-outline' as const,
                },
              ]
            : []),
        ]}
        onSelect={onRowAction}
        onClose={() => setSelected(null)}
      />

      <OptionSheet
        visible={menuOpen}
        title={t('chapters.title')}
        value={null}
        options={[
          { value: 'refresh', label: t('common.refresh'), icon: 'refresh' },
          {
            value: 'sort',
            label: sort === 'asc' ? t('chapters.sortDesc') : t('chapters.sortAsc'),
            icon: 'swap-vertical',
          },
          { value: 'read', label: t('story.markAllRead'), icon: 'checkmark-done-outline' },
          { value: 'unread', label: t('story.markAllUnread'), icon: 'ellipse-outline' },
        ]}
        onSelect={onMenu}
        onClose={() => setMenuOpen(false)}
      />

      <Modal
        visible={jumpOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setJumpOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable
            style={[styles.backdrop, { backgroundColor: theme.overlay }]}
            onPress={() => setJumpOpen(false)}
            importantForAccessibility="no"
          />
          <View
            style={[
              styles.jumpSheet,
              { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
            ]}
          >
            <ThemedText type="heading">{t('chapters.jumpTitle')}</ThemedText>
            <TextInput
              autoFocus
              value={jumpText}
              onChangeText={setJumpText}
              keyboardType="number-pad"
              onSubmitEditing={jump}
              placeholder={t('chapters.jumpPlaceholder')}
              placeholderTextColor={theme.textMuted}
              style={[styles.jumpInput, { borderColor: theme.borderStrong, color: theme.text }]}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {t('chapters.jumpRange', { total: chapters.length })}
            </ThemedText>
            <View style={styles.jumpActions}>
              <Button
                title={t('chapters.current')}
                variant="secondary"
                onPress={() => {
                  setJumpOpen(false);
                  listRef.current?.scrollToIndex({
                    index: Math.max(0, currentIndex),
                    viewPosition: 0.35,
                    animated: true,
                  });
                }}
              />
              <Button title={t('chapters.go')} onPress={jump} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  appActions: { flexDirection: 'row', alignItems: 'center' },
  summary: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  search: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.twoHalf,
  },
  searchInput: { flex: 1, minHeight: 48, fontSize: 16 },
  filters: {
    paddingVertical: Spacing.two,
  },
  filterContent: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  list: { paddingBottom: 96 },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 2,
    flexDirection: 'row',
    gap: Spacing.two,
    height: ROW_HEIGHT,
    paddingHorizontal: Spacing.twoHalf,
  },
  number: { width: 48, fontVariant: ['tabular-nums'] },
  title: { flex: 1 },
  empty: { alignItems: 'center', gap: Spacing.two, padding: Spacing.five },
  fab: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: Spacing.one,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    position: 'absolute',
    right: Spacing.three,
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  jumpSheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
  },
  jumpInput: {
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 24,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
  },
  jumpActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
