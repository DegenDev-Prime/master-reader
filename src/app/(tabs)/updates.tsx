import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { Cover } from '@/components/ui/cover';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { LoadingView } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { libraryRepository, type LibraryNovel } from '@/db/repositories/library';
import { storyUpdatesRepository, type StoryUpdateGroup } from '@/db/repositories/story-updates';
import { useTheme } from '@/hooks/use-theme';
import { syncNovel } from '@/services/novel-catalog';

type UpdateRow = {
  kind: 'header' | 'update';
  key: string;
  /** Day label for a header row. */
  label?: string;
  group?: StoryUpdateGroup;
  novel?: LibraryNovel['novel'];
};

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp * 1000);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

function dayLabel(timestamp: number): string {
  const today = startOfDay(Math.floor(Date.now() / 1000));
  const day = startOfDay(timestamp);
  if (day === today) return t('updates.today');
  if (day === today - 86_400) return t('updates.yesterday');
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

export default function UpdatesScreen() {
  const theme = useTheme();
  const [groups, setGroups] = useState<StoryUpdateGroup[]>([]);
  const [library, setLibrary] = useState<LibraryNovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [list, updateGroups] = await Promise.all([
      libraryRepository.listNovels(),
      storyUpdatesRepository.listGroups(),
    ]);
    setLibrary(list);
    setGroups(updateGroups);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const check = useCallback(async () => {
    setChecking(true);
    setMessage(null);
    let failed = 0;
    const novels = library.filter((item) => item.novel != null).slice(0, 25);
    for (const item of novels) {
      if (!item.novel) continue;
      try {
        await syncNovel(item.novel.sourceId, item.novel.id);
      } catch {
        failed += 1;
      }
    }
    await load();
    setLastChecked(Math.floor(Date.now() / 1000));
    setMessage(failed > 0 ? t('updates.failed') : null);
    setChecking(false);
  }, [library, load]);

  const rows = useMemo<UpdateRow[]>(() => {
    const result: UpdateRow[] = [];
    let currentDay: number | null = null;
    for (const group of groups) {
      const day = startOfDay(group.updatedAt);
      if (day !== currentDay) {
        currentDay = day;
        result.push({ kind: 'header', key: `day-${day}`, label: dayLabel(group.updatedAt) });
      }
      result.push({ kind: 'update', key: `${group.sourceId}:${group.novelId}`, group });
    }
    return result;
  }, [groups]);

  const novelsById = useMemo(() => {
    const map = new Map<string, LibraryNovel['novel']>();
    for (const item of library) {
      if (item.novel) map.set(`${item.novel.sourceId}:${item.novel.id}`, item.novel);
    }
    return map;
  }, [library]);

  const openNovel = useCallback((group: StoryUpdateGroup) => {
    const first = group.chapters[group.chapters.length - 1];
    router.push({
      pathname: '/reader/[sourceId]/[novelId]/[chapterId]',
      params: {
        sourceId: group.sourceId,
        novelId: group.novelId,
        chapterId: first?.id ?? '',
      },
    });
  }, []);

  const markSeen = useCallback(
    async (group: StoryUpdateGroup) => {
      await storyUpdatesRepository.markSeen(group.sourceId, group.novelId);
      await load();
    },
    [load],
  );

  const unseen = groups.reduce((sum, group) => sum + group.unseen, 0);
  const footer = checking
    ? t('updates.checking')
    : (message ??
      (lastChecked
        ? `${t('updates.lastChecked')} ${new Date(lastChecked * 1000).toLocaleTimeString(
            undefined,
            {
              hour: '2-digit',
              minute: '2-digit',
            },
          )}`
        : t('updates.never')));

  return (
    <Screen>
      <ScreenHeader
        title={t('updates.title')}
        subtitle={unseen > 0 ? `${unseen} ${t('updates.newChapters')}` : t('updates.subtitle')}
        actions={
          <IconButton
            icon="refresh"
            label={t('updates.check')}
            disabled={checking}
            onPress={() => void check()}
          />
        }
      />
      {loading ? (
        <LoadingView label={t('common.loading')} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="sync-outline"
          title={t('updates.emptyTitle')}
          message={t('updates.emptyMessage')}
          action={
            <Button
              title={t('updates.check')}
              icon="refresh"
              loading={checking}
              onPress={() => void check()}
            />
          }
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={checking}
              onRefresh={() => void check()}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListFooterComponent={
            <View style={styles.footer}>
              <ThemedText type="small" themeColor="textMuted">
                {footer}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <ThemedText type="eyebrow" style={styles.dayHeader}>
                  {item.label}
                </ThemedText>
              );
            }
            const group = item.group;
            if (!group) return null;
            const novel = novelsById.get(`${group.sourceId}:${group.novelId}`);
            const chapterRange = chapterSummary(group);

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={novel?.title ?? group.novelId}
                onPress={() => openNovel(group)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed ? theme.backgroundSelected : theme.background,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <Cover uri={novel?.coverUrl} title={novel?.title ?? ''} width={52} />
                <View style={styles.rowText}>
                  <ThemedText type="bodyStrong" numberOfLines={2}>
                    {novel?.title ?? group.novelId}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {chapterRange}
                  </ThemedText>
                </View>
                {group.unseen > 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                    <ThemedText type="smallBold" style={{ color: theme.primaryText }}>
                      {group.unseen}
                    </ThemedText>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('updates.markSeen')}
                    hitSlop={12}
                    onPress={() => void markSeen(group)}
                    style={styles.seenButton}
                  >
                    <Ionicons name="checkmark-done" size={20} color={theme.textMuted} />
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

/** "Ch. 212-214" when the group spans chapters, "Ch. 88" for a single one. */
function chapterSummary(group: StoryUpdateGroup): string {
  const count = group.chapters.length;
  if (count === 0) return '';
  if (count === 1) {
    const title = group.chapters[0].title;
    return title ? `Ch. ${title}` : t('updates.newChaptersShort');
  }
  return `${count} ${t('updates.newChapters')}`;
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.six },
  dayHeader: {
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
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
  badge: {
    alignItems: 'center',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
  },
  seenButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
});
