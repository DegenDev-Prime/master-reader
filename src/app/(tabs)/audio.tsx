import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { NowPlayingCard } from '@/components/audio/now-playing-card';
import { PlayerTransport } from '@/components/audio/player-transport';
import { UpNextList, type UpNextItem } from '@/components/audio/up-next-list';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { LoadingView } from '@/components/ui/loading';
import { OptionSheet } from '@/components/ui/option-sheet';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { chapterRepository } from '@/db/repositories/chapters';
import { narrationRepository } from '@/db/repositories/narration';
import { novelRepository } from '@/db/repositories/novels';
import { useTheme } from '@/hooks/use-theme';
import { listSelectableVoices, type SelectableVoice } from '@/narration/available-voices';
import { formatChapterLength, formatDuration, playerTiming } from '@/narration/player-estimates';
import { sleepTimerRemainingMs, type SleepTimerState as SleepMode } from '@/narration/sleep-timer';
import { deriveChapterNav, NARRATION_SPEED_VALUES } from '@/components/ui/transport-state';
import { openReader } from '@/navigation/routes';
import { useOpenTarget } from '@/navigation/use-parent-back';
import type { RouteTarget } from '@/navigation/parent';
import { narrationChunks, useNarrationStore } from '@/stores/narration';
import { useSettingsStore } from '@/stores/settings';

/** The narration settings screen, opened for the options the player lacks. */
const NARRATION_SETTINGS: RouteTarget = { pathname: '/settings/narration' };

type RecentSession = {
  sourceId: string;
  storyId: string;
  title: string;
  updatedAt: number;
};

export default function AudioScreen() {
  const theme = useTheme();
  const status = useNarrationStore((state) => state.status);
  const sourceId = useNarrationStore((state) => state.sourceId);
  const storyId = useNarrationStore((state) => state.storyId);
  const title = useNarrationStore((state) => state.title);
  const chunkIndex = useNarrationStore((state) => state.chunkIndex);
  const chunkCount = useNarrationStore((state) => state.chunkCount);
  const chunkText = useNarrationStore((state) => state.chunkText);
  const chapterWindow = useNarrationStore((state) => state.chapterWindow);
  const error = useNarrationStore((state) => state.error);
  const play = useNarrationStore((state) => state.play);
  const toggle = useNarrationStore((state) => state.toggle);
  const stop = useNarrationStore((state) => state.stop);
  const speed = useNarrationStore((state) => state.speed);
  const sleep = useNarrationStore((state) => state.sleep);
  const seriesPosition = useNarrationStore((state) => state.seriesPosition);
  const seriesLength = useNarrationStore((state) => state.seriesLength);
  const playPrevInQueue = useNarrationStore((state) => state.playPrevInQueue);
  const playNextInQueue = useNarrationStore((state) => state.playNextInQueue);
  const skip = useNarrationStore((state) => state.skip);
  const setSpeed = useNarrationStore((state) => state.setSpeed);
  const setVoice = useNarrationStore((state) => state.setVoice);
  const playChapter = useNarrationStore((state) => state.playChapter);
  const addBookmark = useNarrationStore((state) => state.addBookmark);
  const bookmarks = useNarrationStore((state) => state.bookmarks);

  const [recent, setRecent] = useState<RecentSession[] | null>(null);
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [chapterLabel, setChapterLabel] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [speedSheet, setSpeedSheet] = useState(false);
  const [voiceSheet, setVoiceSheet] = useState(false);
  const [voices, setVoices] = useState<SelectableVoice[] | null>(null);

  const hasSession = sourceId !== null && storyId !== null;
  const narrationSettings = useSettingsStore((state) => state.settings.narration);
  const engine = narrationSettings.engine;

  const load = useCallback(async () => {
    const sessions = await narrationRepository.listAll();
    const rows = await Promise.all(
      sessions
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 3)
        .map(async (session) => {
          const novel = await novelRepository.get(session.sourceId, session.storyId);
          return {
            sourceId: session.sourceId,
            storyId: session.storyId,
            title: novel?.title ?? session.storyId,
            updatedAt: session.updatedAt,
          } satisfies RecentSession;
        }),
    );
    setRecent(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // The cover of the narrated story, so the player card is not a blank box.
  useFocusEffect(
    useCallback(() => {
      if (!sourceId || !storyId) {
        setCover(null);
        return;
      }
      let cancelled = false;
      void novelRepository
        .get(sourceId, storyId)
        .then((novel) => {
          if (!cancelled) setCover(novel?.coverUrl ?? null);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [sourceId, storyId]),
  );

  // The queue is the narration window itself: the chapters that follow the
  // one being read.
  const currentChapterId = useMemo(() => {
    const chunk = narrationChunks()[chunkIndex];
    if (!chunk) return null;
    return chapterWindow.find((chapter) => chapter.position === chunk.pageIndex)?.id ?? null;
  }, [chunkIndex, chapterWindow]);

  useFocusEffect(
    useCallback(() => {
      if (!sourceId || !storyId) {
        setUpNext([]);
        setChapterLabel(null);
        return;
      }
      let cancelled = false;
      void (async () => {
        const chapters = await chapterRepository.listMetadata(sourceId, storyId);
        if (cancelled) return;

        const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
        const startIndex = currentChapterId
          ? chapterWindow.findIndex((chapter) => chapter.id === currentChapterId)
          : -1;

        const next = chapterWindow
          .slice(startIndex >= 0 ? startIndex + 1 : 0)
          .slice(0, 3)
          .map((chapter, index) => {
            const meta = byId.get(chapter.id);
            const position = meta?.number ?? (meta ? meta.position + 1 : null);
            return {
              id: chapter.id,
              position,
              title:
                meta?.title ||
                chapter.title ||
                t('player.chapterNumber', { position: position ?? index + 1 }),
              length: formatChapterLength(meta?.wordCount),
            } satisfies UpNextItem;
          });

        setUpNext(next);
        const current = currentChapterId ? byId.get(currentChapterId) : null;
        const currentWindow = chapterWindow.find((chapter) => chapter.id === currentChapterId);
        const name = current?.title || currentWindow?.title || '';
        setChapterLabel(
          current
            ? `${t('player.chapterEyebrow', {
                position: current.number ?? current.position + 1,
              })} · ${name}`.trim()
            : null,
        );
      })();
      return () => {
        cancelled = true;
      };
    }, [chapterWindow, currentChapterId, sourceId, storyId]),
  );

  // The voices of the current engine, loaded when the picker is opened.
  useEffect(() => {
    if (!voiceSheet) return;
    let cancelled = false;
    void listSelectableVoices(engine)
      .then((list) => {
        if (!cancelled) setVoices(list);
      })
      .catch(() => {
        if (!cancelled) setVoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [engine, voiceSheet]);

  const { canPrevChapter, canNextChapter } = deriveChapterNav(
    seriesPosition,
    seriesLength,
    chunkIndex,
  );

  const onPlayPress = useCallback(() => {
    if (!sourceId || !storyId) return;
    if (hasSession) void toggle(sourceId, storyId, title);
    else void play(sourceId, storyId, title);
  }, [hasSession, play, sourceId, storyId, title, toggle]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openTarget = useOpenTarget();

  // The name of the voice in use, so the player shows which one speaks. The
  // list of voices arrives after the screen does, so the label is derived
  // from both.
  const voiceId = useSettingsStore((state) => state.settings.narration.voiceId);
  const voiceLabel = useMemo(() => {
    if (!voiceId) return t('narration.engineSystem');
    return voices?.find((voice) => voice.id === voiceId)?.name ?? voiceId;
  }, [voiceId, voices]);

  // Playback timing of the loaded session. The chunk list grows as the
  // background loader adds chapters, so its length is a dependency.
  const timing = useMemo(
    () => playerTiming(narrationChunks().slice(0, chunkCount), chunkIndex, speed),
    [chunkIndex, speed, chunkCount],
  );

  return (
    <Screen>
      <ScreenHeader
        title={t('audio.title')}
        actions={
          hasSession ? (
            <IconButton
              icon="stop-circle-outline"
              label={t('narration.stop')}
              onPress={() => void stop()}
            />
          ) : null
        }
      />

      {recent === null ? (
        <LoadingView label={t('common.loading')} />
      ) : !hasSession && recent.length === 0 ? (
        <EmptyState
          icon="headset-outline"
          title={t('audio.emptyTitle')}
          message={t('audio.emptyMessage')}
          action={
            <Button
              title={t('audio.openLibrary')}
              icon="library-outline"
              onPress={() => router.push('/')}
            />
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          {hasSession ? (
            <>
              <NowPlayingCard
                title={title ?? storyId ?? ''}
                cover={cover}
                subtitle={chapterLabel}
                sentence={chunkText}
                playing={status === 'playing'}
                onPressChapter={
                  sourceId && storyId ? () => openReader(sourceId, storyId) : undefined
                }
              />

              {error ? (
                <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
                  {error}
                </ThemedText>
              ) : null}

              <View style={styles.progressBlock}>
                <View style={styles.progressLabels}>
                  <ThemedText type="small" themeColor="textMuted">
                    {t('player.partOf', {
                      current: chunkIndex + 1,
                      total: Math.max(chunkCount, 1),
                    })}
                  </ThemedText>
                  {timing.totalMs > 0 ? (
                    <ThemedText type="small" themeColor="textMuted">
                      {`${formatDuration(timing.elapsedMs)} / ${formatDuration(timing.totalMs)}`}
                    </ThemedText>
                  ) : null}
                </View>
                <View style={[styles.track, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: theme.primary,
                        width: `${timing.fraction * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              <PlayerTransport
                playing={status === 'playing'}
                loading={status === 'loading'}
                canSeek={hasSession}
                canPreviousChapter={canPrevChapter}
                canNextChapter={canNextChapter}
                onPressPlay={onPlayPress}
                onPreviousChapter={() => void playPrevInQueue()}
                onNextChapter={() => void playNextInQueue()}
                onRewind={() => void skip(-narrationSettings.skipSeconds)}
                onForward={() => void skip(narrationSettings.skipSeconds)}
                skipLabel={t('narration.skipSeconds', { count: narrationSettings.skipSeconds })}
                speedLabel={t('narration.speedValue', { value: speed })}
                onPressSpeed={() => setSpeedSheet(true)}
                sleepLabel={sleepLabel(sleep)}
                onPressSleep={() => openTarget(NARRATION_SETTINGS)}
                voiceLabel={voiceLabel}
                onPressVoice={() => setVoiceSheet(true)}
                onPressBookmark={() => void addBookmark()}
                bookmarked={bookmarks.length > 0}
              />

              <UpNextList items={upNext} onSelect={(item) => void playChapter(item.id)} />
            </>
          ) : (
            <RecentList
              sessions={recent}
              onSelect={(session) => void play(session.sourceId, session.storyId, session.title)}
            />
          )}

          <PressableRow
            icon="settings-outline"
            label={t('player.voice', { voice: voiceLabel })}
            onPress={() => openTarget(NARRATION_SETTINGS)}
          />
        </ScrollView>
      )}

      <OptionSheet
        visible={speedSheet}
        title={t('narration.speed')}
        options={NARRATION_SPEED_VALUES.map((value) => ({
          value: String(value),
          label: t('narration.speedValue', { value }),
        }))}
        value={String(speed)}
        onSelect={(value) => {
          if (value != null) void setSpeed(Number(value));
          setSpeedSheet(false);
        }}
        onClose={() => setSpeedSheet(false)}
      />

      <OptionSheet
        visible={voiceSheet}
        title={t('narration.voice')}
        options={(voices ?? []).map((voice) => ({
          value: voice.id,
          label: voice.name,
        }))}
        value={narrationSettings.voiceId}
        allLabel={t('narration.engineSystem')}
        onSelect={(value) => {
          void setVoice(value);
          setVoiceSheet(false);
        }}
        onClose={() => setVoiceSheet(false)}
      />
    </Screen>
  );
}

function RecentList({
  sessions,
  onSelect,
}: {
  sessions: RecentSession[];
  onSelect: (session: RecentSession) => void;
}) {
  const theme = useTheme();
  if (sessions.length === 0) return null;

  return (
    <View style={styles.section}>
      <ThemedText type="eyebrow">{t('player.recent').toUpperCase()}</ThemedText>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      >
        {sessions.map((session, index) => (
          <RecentRow
            key={`${session.sourceId}:${session.storyId}`}
            session={session}
            last={index === sessions.length - 1}
            onPress={() => onSelect(session)}
          />
        ))}
      </View>
    </View>
  );
}

function RecentRow({
  session,
  last,
  onPress,
}: {
  session: RecentSession;
  last: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.recentRow,
        !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={styles.recentText}>
        <ThemedText type="default" numberOfLines={1}>
          {session.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
          {relativeTime(session.updatedAt)}
        </ThemedText>
      </View>
      <IconButton
        icon="play"
        label={t('narration.resume')}
        color={theme.primary}
        onPress={onPress}
      />
    </View>
  );
}

function PressableRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.card,
        styles.voiceRow,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}
    >
      <Ionicons name={icon} size={20} color={theme.textSecondary} />
      <ThemedText type="default" style={styles.voiceLabel} numberOfLines={1}>
        {label}
      </ThemedText>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

/** The sleep chip shows what the timer will do next. */
function sleepLabel(sleep: SleepMode): string {
  if (sleep.mode === 'endOfChapter') return t('narration.sleepEndOfChapter');
  if (sleep.mode === 'minutes') {
    const remaining = sleepTimerRemainingMs(sleep, Date.now());
    const minutes = remaining != null ? Math.max(1, Math.ceil(remaining / 60_000)) : 0;
    return t('narration.sleepMinutes', { count: minutes });
  }
  return t('narration.sleepOff');
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (seconds < 60) return t('player.justNow');
  if (seconds < 3600) return t('player.minutesAgo', { count: Math.floor(seconds / 60) });
  if (seconds < 86_400) return t('player.hoursAgo', { count: Math.floor(seconds / 3600) });
  return t('player.daysAgo', { count: Math.floor(seconds / 86_400) });
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, padding: Spacing.three, paddingBottom: Spacing.six },
  section: { gap: Spacing.two },
  card: { borderWidth: StyleSheet.hairlineWidth },
  progressBlock: { gap: Spacing.two },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 2, overflow: 'hidden' },
  fill: { height: 2 },
  recentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  recentText: { flex: 1, gap: Spacing.half, minWidth: 0 },
  voiceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  voiceLabel: { flex: 1, minWidth: 0 },
});
