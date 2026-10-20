import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { t } from '@/i18n';
import { chapterDisplayTitle } from '@/sources/content/chapter-title';
import { Cover } from '@/components/ui/cover';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { LoadingView } from '@/components/ui/loading';
import { OptionSheet } from '@/components/ui/option-sheet';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { chapterReadsRepository, chapterRepository } from '@/db/repositories/chapters';
import { chapterDownloadsRepository } from '@/db/repositories/chapter-downloads';
import { downloadsRepository } from '@/db/repositories/downloads';
import { libraryRepository } from '@/db/repositories/library';
import { novelRepository } from '@/db/repositories/novels';
import { progressRepository } from '@/db/repositories/progress';
import type { Novel, NovelStatus } from '@/models/novel';
import type { ReadingProgress } from '@/models/story';
import { getSource } from '@/services/source-manager';
import { downloadChapterRange } from '@/services/chapter-downloads';
import { syncNovel } from '@/services/novel-catalog';
import { useSettingsStore } from '@/stores/settings';
import { useLibraryStore } from '@/stores/library';
import { withAlpha } from '@/utils/color';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackToParent, useOpenTarget } from '@/navigation/use-parent-back';

const STATUS_KEYS: Record<NovelStatus, string> = {
  ongoing: 'story.statusOngoing',
  completed: 'story.statusCompleted',
  hiatus: 'story.statusHiatus',
  cancelled: 'story.statusCancelled',
  licensed: 'story.statusLicensed',
  unknown: 'story.statusUnknown',
};

export default function StoryScreen() {
  const { sourceId, id } = useLocalSearchParams<{ sourceId: string; id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const offlineMode = useSettingsStore((state) => state.settings.offlineMode);
  const [novel, setNovel] = useState<Novel | null>(null);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [chapters, setChapters] = useState<
    Awaited<ReturnType<typeof chapterRepository.listMetadata>>
  >([]);
  const [downloaded, setDownloaded] = useState(0);
  const [inLibrary, setInLibrary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [download, setDownload] = useState<{ done: number; total: number } | null>(null);

  const loadLocal = useCallback(async () => {
    if (!sourceId || !id) return;
    const [cachedNovel, chapterList, savedProgress, contains, counts] = await Promise.all([
      novelRepository.get(sourceId, id),
      chapterRepository.listMetadata(sourceId, id),
      progressRepository.get(sourceId, id),
      libraryRepository.contains(sourceId, id),
      chapterRepository.counts(sourceId, id),
    ]);
    setNovel(cachedNovel);
    setChapters(chapterList);
    setProgress(savedProgress);
    setInLibrary(contains);
    setDownloaded(counts.downloaded);
    setLoading(false);
    return { cachedNovel, chapterList };
  }, [sourceId, id]);

  const refresh = useCallback(
    async (quiet = false) => {
      if (!sourceId || !id) return;
      if (!quiet) setSyncing(true);
      try {
        const result = await syncNovel(sourceId, id);
        setNovel(result.novel);
        setChapters(result.chapters);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('story.error'));
      } finally {
        setSyncing(false);
      }
    },
    [sourceId, id],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadLocal().then((result) => {
        if (!active) return;
        const syncedAt = result?.cachedNovel?.chaptersSyncedAt ?? 0;
        const stale = Date.now() / 1000 - syncedAt > 900;
        if ((!result?.chapterList.length || stale) && !offlineMode) {
          void refresh(true);
        }
      });
      return () => {
        active = false;
      };
    }, [loadLocal, offlineMode, refresh]),
  );

  const current = useMemo(() => {
    if (chapters.length === 0) return null;
    if (progress?.chapterId) {
      const found = chapters.find((chapter) => chapter.id === progress.chapterId);
      if (found) return found;
    }
    return chapters.find((chapter) => chapter.position === progress?.pageIndex) ?? chapters[0];
  }, [chapters, progress]);

  const currentIndex = current ? chapters.findIndex((chapter) => chapter.id === current.id) : -1;
  const total = chapters.length;
  const percent = total > 0 && currentIndex >= 0 ? (currentIndex + 1) / total : 0;
  const unread = chapters.filter((chapter) => chapter.readAt == null).length;
  const nextChapters = useMemo(() => {
    if (currentIndex < 0) return chapters.filter((chapter) => chapter.readAt == null).slice(0, 3);
    return chapters
      .slice(currentIndex + 1)
      .filter((chapter) => chapter.readAt == null)
      .slice(0, 3);
  }, [chapters, currentIndex]);

  const openChapter = useCallback(
    (chapterId?: string | null) => {
      if (!sourceId || !id) return;
      router.push({
        pathname: '/reader/[sourceId]/[novelId]/[chapterId]',
        params: {
          sourceId,
          novelId: id,
          chapterId: chapterId ?? current?.id ?? chapters[0]?.id ?? '',
        },
      });
    },
    [sourceId, id, current, chapters],
  );

  const backToParent = useBackToParent();
  const openTarget = useOpenTarget();

  const chaptersTarget = useMemo(
    () => ({
      pathname: '/chapters/[sourceId]/[id]',
      params: { sourceId, id },
    }),
    [id, sourceId],
  );

  const toggleLibrary = useCallback(async () => {
    if (!sourceId || !id) return;
    if (inLibrary) {
      Alert.alert(t('story.removeTitle'), t('story.removeMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('story.removeKeep'),
          onPress: () => {
            void (async () => {
              await libraryRepository.remove(sourceId, id);
              setInLibrary(false);
              await useLibraryStore.getState().refresh();
            })();
          },
        },
        {
          text: t('story.removeDownloads'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await chapterDownloadsRemove(sourceId, id);
              await libraryRepository.remove(sourceId, id);
              setInLibrary(false);
              setDownloaded(0);
              await useLibraryStore.getState().refresh();
            })();
          },
        },
      ]);
      return;
    }
    await libraryRepository.add(sourceId, id);
    setInLibrary(true);
    await useLibraryStore.getState().refresh();
  }, [sourceId, id, inLibrary]);

  const startDownload = useCallback(
    (count: number | 'all') => {
      if (!sourceId || !id || chapters.length === 0) return;
      const remaining = chapters.filter((chapter) => !chapter.hasContent);
      const targets = count === 'all' ? remaining : remaining.slice(0, count);
      if (targets.length === 0) {
        Alert.alert(t('download.downloaded'), t('story.downloadComplete', { count: 0 }));
        return;
      }

      setDownload({ done: 0, total: targets.length });
      void downloadChapterRange(
        sourceId,
        id,
        targets.map((chapter) => chapter.id),
        {
          onProgress: (value) =>
            setDownload({ done: value.completed + value.failed, total: value.total }),
        },
      )
        .then(async (result) => {
          await loadLocal();
          Alert.alert(
            t('download.button'),
            result.failed > 0
              ? t('story.downloadFailed', { count: result.failed })
              : t('story.downloadComplete', { count: result.completed }),
          );
        })
        .catch(() => {
          Alert.alert(t('download.failed'), t('story.error'));
        })
        .finally(() => setDownload(null));
    },
    [sourceId, id, chapters, loadLocal],
  );

  const confirmDownload = useCallback(() => {
    const remaining = chapters.filter((chapter) => !chapter.hasContent).length;
    if (remaining === 0) {
      Alert.alert(t('download.downloaded'), t('story.downloadComplete', { count: 0 }));
      return;
    }
    Alert.alert(t('download.button'), t('story.downloadMessage', { count: remaining }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('story.downloadNext', { count: Math.min(10, remaining) }),
        onPress: () => startDownload(10),
      },
      { text: t('story.downloadAll'), onPress: () => startDownload('all') },
    ]);
  }, [chapters, startDownload]);

  const onMenu = useCallback(
    (value: string | null) => {
      setMenuOpen(false);
      if (!value || !sourceId || !id) return;
      if (value === 'refresh') {
        void refresh();
        return;
      }
      if (value === 'open') {
        const source = getSource(sourceId);
        void Linking.openURL(novel?.url ?? source.info.baseUrl);
        return;
      }
      if (value === 'read') {
        void chapterReadsRepository
          .markReadThrough(sourceId, id, Number.MAX_SAFE_INTEGER)
          .then(() => loadLocal());
        return;
      }
      if (value === 'unread') {
        void chapterReadsRepository.markAllUnread(sourceId, id).then(() => loadLocal());
        return;
      }
      if (value === 'remove') {
        void toggleLibrary();
      }
    },
    [sourceId, id, novel, refresh, loadLocal, toggleLibrary],
  );

  if (loading) {
    return (
      <Screen>
        <TopBar onBack={() => backToParent({ pathname: '/' })} />
        <LoadingView label={t('story.loading')} />
      </Screen>
    );
  }

  if (!novel) {
    return (
      <Screen>
        <TopBar onBack={() => backToParent({ pathname: '/' })} />
        <EmptyState
          icon="cloud-offline-outline"
          title={t('story.error')}
          message={error ?? t('story.offline')}
          action={
            <Button title={t('common.retry')} onPress={() => void refresh()} loading={syncing} />
          }
        />
      </Screen>
    );
  }

  const sourceName = getSourceName(sourceId);
  const statusLabel = STATUS_KEYS[novel.status ?? 'unknown'];
  const genres = novel.genres ?? [];

  return (
    <Screen>
      <TopBar
        onBack={() => backToParent({ pathname: '/' })}
        right={
          <IconButton
            icon="ellipsis-horizontal"
            label={t('common.more')}
            onPress={() => setMenuOpen(true)}
          />
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.six + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={syncing}
            onRefresh={() => void refresh()}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <View style={styles.hero}>
          <Cover uri={novel.coverUrl} title={novel.title} width={112} />
          <View style={styles.heroText}>
            <ThemedText type="title2" accessibilityRole="header">
              {novel.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {novel.authorName ?? t('story.unknownAuthor')}
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              {[
                novel.status && novel.status !== 'unknown' ? t(statusLabel) : null,
                `${total} ${t('common.chapters')}`,
                novel.lang ? novel.lang.toUpperCase() : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            {genres.length > 0 ? (
              <ThemedText type="small" themeColor="textMuted" numberOfLines={2}>
                {genres.slice(0, 5).join(' · ')}
              </ThemedText>
            ) : null}
            <ThemedText type="small" style={{ color: theme.textMuted }}>
              {sourceName}
            </ThemedText>
          </View>
        </View>

        {error ? (
          <View
            style={[
              styles.banner,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={theme.warning} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.bannerText}>
              {t('story.sourceUnavailable')}
            </ThemedText>
            <Pressable onPress={() => void refresh()} accessibilityRole="button">
              <ThemedText type="smallBold" themeColor="primary">
                {t('common.retry')}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {current ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('story.chapterOf', {
                  chapter: current.number ?? current.position + 1,
                  total,
                })}
              </ThemedText>
              <ThemedText type="small" themeColor="textMuted">
                {t('library.progressPercent', { percent: Math.round(percent * 100) })}
              </ThemedText>
            </View>
            <View style={[styles.track, { backgroundColor: withAlpha(theme.primary, 0.16) }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: theme.primary, width: `${percent * 100}%` },
                ]}
              />
            </View>
            <Button
              title={progress ? t('story.resume') : t('story.startReading')}
              icon="play"
              onPress={() => openChapter(current.id)}
            />
          </View>
        ) : (
          <EmptyState
            icon="list-outline"
            title={t('chapters.emptyTitle')}
            message={t('chapters.emptyMessage')}
            action={<Button title={t('common.refresh')} onPress={() => void refresh()} />}
          />
        )}

        <View style={styles.actions}>
          <Button
            title={t('chapters.title')}
            variant="secondary"
            icon="list-outline"
            style={styles.actionButton}
            onPress={() => {
              if (sourceId && id) openTarget(chaptersTarget);
            }}
          />
          <Button
            title={
              download
                ? `${download.done}/${download.total}`
                : downloaded > 0
                  ? t('download.downloaded')
                  : t('download.button')
            }
            variant="secondary"
            icon="download-outline"
            style={styles.actionButton}
            loading={download != null}
            disabled={offlineMode}
            onPress={confirmDownload}
          />
        </View>

        {!inLibrary ? (
          <Button
            title={t('story.addToLibrary')}
            variant="secondary"
            icon="add"
            onPress={() => void toggleLibrary()}
          />
        ) : null}

        {novel.description ? (
          <View style={styles.section}>
            <ThemedText type="eyebrow">{t('story.synopsis')}</ThemedText>
            <ThemedText
              type="default"
              themeColor="textSecondary"
              numberOfLines={synopsisOpen ? undefined : 4}
              style={styles.synopsis}
            >
              {novel.description}
            </ThemedText>
            <Pressable
              onPress={() => setSynopsisOpen((open) => !open)}
              accessibilityRole="button"
              style={styles.moreLink}
            >
              <ThemedText type="smallBold" themeColor="primary">
                {synopsisOpen ? t('story.less') : t('story.more')}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="eyebrow">{t('story.nextUp')}</ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              {unread} {t('updates.unread')}
            </ThemedText>
          </View>
          {nextChapters.length > 0 ? (
            <View style={[styles.list, { borderColor: theme.border }]}>
              {nextChapters.map((chapter) => (
                <Pressable
                  key={chapter.id}
                  onPress={() => openChapter(chapter.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.nextRow,
                    {
                      backgroundColor: pressed ? theme.backgroundSelected : theme.background,
                      borderBottomColor: theme.border,
                    },
                  ]}
                >
                  <ThemedText type="smallBold" themeColor="textMuted" style={styles.nextNumber}>
                    {chapter.number ?? chapter.position + 1}
                  </ThemedText>
                  <ThemedText type="default" numberOfLines={1} style={styles.nextTitle}>
                    {chapterDisplayTitle(chapter.title) || t('chapters.untitled')}
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {t('updates.allCaughtUp')}
            </ThemedText>
          )}
          <Pressable
            onPress={() => {
              if (sourceId && id) openTarget(chaptersTarget);
            }}
            accessibilityRole="button"
            style={styles.moreLink}
          >
            <ThemedText type="smallBold" themeColor="primary">
              {t('story.allChapters')} →
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      <OptionSheet
        visible={menuOpen}
        title={novel.title}
        options={[
          { value: 'refresh', label: t('common.refresh'), icon: 'refresh' },
          { value: 'open', label: t('story.openWeb'), icon: 'open-outline' },
          { value: 'read', label: t('story.markAllRead'), icon: 'checkmark-done-outline' },
          { value: 'unread', label: t('story.markAllUnread'), icon: 'ellipse-outline' },
          ...(inLibrary
            ? [
                {
                  value: 'remove' as const,
                  label: t('common.remove'),
                  icon: 'trash-outline' as const,
                },
              ]
            : []),
        ]}
        value={null}
        onSelect={onMenu}
        onClose={() => setMenuOpen(false)}
      />
    </Screen>
  );
}

function TopBar({ onBack, right }: { onBack: () => void; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={styles.back}
      >
        <Ionicons name="chevron-back" size={24} color={theme.text} />
      </Pressable>
      <View style={styles.topSpacer} />
      {right}
    </View>
  );
}

function getSourceName(sourceId: string): string {
  try {
    return getSource(sourceId).info.name;
  } catch {
    return sourceId;
  }
}

async function chapterDownloadsRemove(sourceId: string, novelId: string): Promise<void> {
  await chapterDownloadsRepository.remove(sourceId, novelId);
  await chapterRepository.removeContent(sourceId, novelId);
  await downloadsRepository.remove(sourceId, novelId);
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: Spacing.two,
  },
  back: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  topSpacer: { flex: 1 },
  content: { gap: Spacing.four, padding: Spacing.three, paddingBottom: Spacing.six },
  hero: { flexDirection: 'row', gap: Spacing.three },
  heroText: { flex: 1, gap: Spacing.one, paddingTop: Spacing.one },
  banner: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.twoHalf,
  },
  bannerText: { flex: 1 },
  progressBlock: { gap: Spacing.two },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 2, overflow: 'hidden' },
  fill: { height: 2 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionButton: { flex: 1 },
  section: { gap: Spacing.two },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  synopsis: { lineHeight: 24 },
  moreLink: { minHeight: 32, justifyContent: 'center' },
  list: { borderWidth: StyleSheet.hairlineWidth },
  nextRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 52,
    paddingHorizontal: Spacing.twoHalf,
  },
  nextNumber: { width: 40 },
  nextTitle: { flex: 1 },
});
