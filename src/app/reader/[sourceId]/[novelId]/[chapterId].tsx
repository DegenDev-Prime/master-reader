import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { NavigationBar } from 'expo-navigation-bar';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { ChapterBody } from '@/components/reader/chapter-body';
import { DisplaySheet } from '@/components/reader/display-sheet';
import { ReaderChrome } from '@/components/reader/reader-chrome';
import { OptionSheet } from '@/components/ui/option-sheet';
import { NARRATION_SPEED_VALUES, nearestSpeedOption } from '@/components/ui/transport-state';
import {
  chapterReadsRepository,
  chapterRepository,
  type ChapterListItem,
} from '@/db/repositories/chapters';
import { libraryRepository } from '@/db/repositories/library';
import { novelRepository } from '@/db/repositories/novels';
import { progressRepository } from '@/db/repositories/progress';
import type { Novel } from '@/models/novel';
import { blockIndexForRange, chunkIndexForBlock } from '@/narration/chapter-highlight';
import type { ReaderSettings } from '@/services/settings';
import { downloadChapterRange } from '@/services/chapter-downloads';
import { getChapterHtml, syncNovel } from '@/services/novel-catalog';
import { sourceRangeForNarrationRange } from '@/services/pronunciation';
import { parseChapterBlocks, type ChapterBlock } from '@/sources/content/parse';
import { chapterDisplayTitle } from '@/sources/content/chapter-title';
import { chapterText } from '@/sources/content/chapter-text';
import { useBackToParent, useOpenTarget } from '@/navigation/use-parent-back';
import { narrationChunks, narrationPageMap, useNarrationStore } from '@/stores/narration';
import { useSettingsStore } from '@/stores/settings';
import { readerPalettes, type ReaderPalette } from '@/theme/reader';

type LoadState = 'loading' | 'ready' | 'offline' | 'error' | 'empty';

export default function ReaderScreen() {
  const { sourceId, novelId, chapterId } = useLocalSearchParams<{
    sourceId: string;
    novelId: string;
    chapterId: string;
  }>();
  const reader = useSettingsStore((state) => state.settings.reader);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const offlineMode = useSettingsStore((state) => state.settings.offlineMode);
  const palette = readerPalettes[reader.theme];
  const insets = useSafeAreaInsets();

  useEffect(() => {
    NavigationBar.setHidden(true);
    return () => NavigationBar.setHidden(false);
  }, []);

  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<ChapterListItem[]>([]);
  const [meta, setMeta] = useState<ChapterListItem | null>(null);
  const [blocks, setBlocks] = useState<ChapterBlock[]>([]);
  const [restore, setRestore] = useState<{ pct: number; paragraph: number | null }>({
    pct: 0,
    paragraph: null,
  });
  const [pct, setPct] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const chapterRef = useRef<ChapterListItem | null>(null);
  const chaptersRef = useRef<ChapterListItem[]>([]);
  const progressRef = useRef({ pct: 0, blockIndex: 0 });
  const dirtyRef = useRef(false);
  const savedAtRef = useRef(0);
  const readMarkedRef = useRef(false);

  const title = novel?.title ?? meta?.title ?? '';

  const narrationStatus = useNarrationStore((store) =>
    store.sourceId === sourceId && store.storyId === novelId ? store.status : 'idle',
  );
  const narrationError = useNarrationStore((store) =>
    store.sourceId === sourceId && store.storyId === novelId ? store.error : null,
  );
  const narrationChunkIndex = useNarrationStore((store) =>
    store.sourceId === sourceId && store.storyId === novelId ? store.chunkIndex : -1,
  );
  const playNarration = useNarrationStore((store) => store.play);
  const pauseNarration = useNarrationStore((store) => store.pause);
  const resumeNarration = useNarrationStore((store) => store.resume);
  const seekNarration = useNarrationStore((store) => store.seekChunk);
  const skipNarration = useNarrationStore((store) => store.skip);
  const setNarrationSpeed = useNarrationStore((store) => store.setSpeed);
  const narrationSpeed = useNarrationStore((store) => store.speed);
  const hasNarration = useNarrationStore(
    (store) => store.sourceId === sourceId && store.storyId === novelId && store.chunkCount > 0,
  );
  const skipSeconds = useSettingsStore((state) => state.settings.narration.skipSeconds);
  const listening =
    narrationStatus === 'playing' || narrationStatus === 'paused' || narrationStatus === 'loading';

  useKeepAwake();

  const saveProgress = useCallback(
    async (force = false) => {
      const current = chapterRef.current;
      if (!current || !sourceId || !novelId) return;
      if (!force && Date.now() - savedAtRef.current < 4000) return;
      const narration = useNarrationStore.getState();
      if (
        narration.sourceId === sourceId &&
        narration.storyId === novelId &&
        (narration.status === 'playing' || narration.status === 'loading')
      ) {
        return;
      }
      const progress = progressRef.current;
      savedAtRef.current = Date.now();
      dirtyRef.current = false;
      try {
        await progressRepository.save({
          sourceId,
          storyId: novelId,
          pageIndex: current.position,
          chapterId: current.id,
          pageCount: chaptersRef.current.length,
          scrollPct: progress.pct,
          paragraphIndex: progress.blockIndex,
        });
        await libraryRepository.touch(sourceId, novelId);
        if (progress.pct >= 0.9 && !readMarkedRef.current) {
          readMarkedRef.current = true;
          await chapterReadsRepository.markRead(sourceId, novelId, current.id);
        }
      } catch {
        dirtyRef.current = true;
      }
    },
    [novelId, sourceId],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sourceId || !novelId || !chapterId) return;
      setState('loading');
      setError(null);
      setBlocks([]);
      setMeta(null);
      chapterRef.current = null;
      readMarkedRef.current = false;
      setChromeVisible(false);

      try {
        let list = await chapterRepository.listMetadata(sourceId, novelId);
        if (list.length === 0) {
          if (offlineMode) throw new Error(t('reader.notDownloadedMessage'));
          const result = await syncNovel(sourceId, novelId);
          list = result.chapters;
        }
        if (cancelled) return;

        const index = list.findIndex((chapter) => chapter.id === chapterId);
        if (index < 0) {
          throw new Error(t('reader.chapterMissing'));
        }
        const current = list[index];
        chaptersRef.current = list;
        chapterRef.current = current;
        setChapters(list);
        setMeta(current);
        setNovel(await novelRepository.get(sourceId, novelId));

        let html = await chapterRepository.getContent(sourceId, novelId, chapterId);
        if (!html) {
          if (offlineMode) {
            if (!cancelled) setState('offline');
            return;
          }
          html = await getChapterHtml(sourceId, novelId, chapterId);
        }
        if (cancelled) return;
        if (!html) {
          setState('empty');
          return;
        }
        const parsed = parseChapterBlocks(html);
        if (parsed.length === 0) {
          setState('empty');
          return;
        }

        const saved = await progressRepository.get(sourceId, novelId);
        const sameChapter = saved?.chapterId === chapterId;
        setRestore({
          pct: sameChapter ? (saved?.scrollPct ?? 0) : 0,
          paragraph: sameChapter ? (saved?.paragraphIndex ?? null) : null,
        });
        progressRef.current = {
          pct: sameChapter ? (saved?.scrollPct ?? 0) : 0,
          blockIndex: sameChapter ? (saved?.paragraphIndex ?? 0) : 0,
        };
        setPct(sameChapter ? (saved?.scrollPct ?? 0) : 0);
        readMarkedRef.current = current.readAt != null;
        setBlocks(parsed);
        setState('ready');

        const next = list[index + 1];
        if (next && !next.hasContent && !offlineMode) {
          void getChapterHtml(sourceId, novelId, next.id).catch(() => undefined);
        }
      } catch (caught) {
        if (cancelled) return;
        if (offlineMode) {
          setState('offline');
        } else {
          setError(caught instanceof Error ? caught.message : t('reader.errorMessage'));
          setState('error');
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      void saveProgress(true);
    };
  }, [chapterId, novelId, offlineMode, reloadKey, saveProgress, sourceId]);

  const onProgress = useCallback((next: { pct: number; blockIndex: number }) => {
    progressRef.current = next;
    dirtyRef.current = true;
    setPct(next.pct);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (dirtyRef.current) void saveProgress();
    }, 5000);
    return () => clearInterval(timer);
  }, [saveProgress]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void saveProgress(true);
    });
    return () => subscription.remove();
  }, [saveProgress]);

  const index = useMemo(
    () => chapters.findIndex((chapter) => chapter.id === chapterId),
    [chapters, chapterId],
  );
  const previous = index > 0 ? chapters[index - 1] : null;
  const next = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null;

  const goTo = useCallback(
    (chapter: ChapterListItem | null) => {
      if (!chapter || !sourceId || !novelId) return;
      void saveProgress(true).then(() => {
        router.replace({
          pathname: '/reader/[sourceId]/[novelId]/[chapterId]',
          params: { sourceId, novelId, chapterId: chapter.id },
        });
      });
    },
    [novelId, saveProgress, sourceId],
  );

  const chaptersTarget = useMemo(
    () => ({
      pathname: '/chapters/[sourceId]/[id]',
      params: { sourceId, id: novelId },
    }),
    [novelId, sourceId],
  );

  const openTarget = useOpenTarget();

  const openChapters = useCallback(() => {
    if (!sourceId || !novelId) return;
    openTarget(chaptersTarget);
  }, [chaptersTarget, novelId, openTarget, sourceId]);

  const backToParent = useBackToParent();

  const handleBack = useCallback(() => {
    // The top bar is only visible after a deliberate tap, so hiding it first
    // would make every press look ignored. Back means back.
    backToParent(chaptersTarget);
  }, [backToParent, chaptersTarget]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (displayOpen) {
          setDisplayOpen(false);
          return true;
        }
        if (menuOpen) {
          setMenuOpen(false);
          return true;
        }
        if (chromeVisible) {
          setChromeVisible(false);
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }, [chromeVisible, displayOpen, menuOpen]),
  );

  useEffect(() => {
    if (!chromeVisible) return;
    const timer = setTimeout(() => setChromeVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [chromeVisible]);

  const updateReader = useCallback(
    (nextReader: ReaderSettings) => {
      void setSetting('reader', nextReader);
    },
    [setSetting],
  );

  const markRead = useCallback(async () => {
    const current = chapterRef.current;
    if (!current || !sourceId || !novelId) return;
    await chapterReadsRepository.markRead(sourceId, novelId, current.id);
    readMarkedRef.current = true;
  }, [novelId, sourceId]);

  const markUnread = useCallback(async () => {
    const current = chapterRef.current;
    if (!current || !sourceId || !novelId) return;
    await chapterReadsRepository.markUnread(sourceId, novelId, current.id);
    readMarkedRef.current = false;
  }, [novelId, sourceId]);

  const downloadChapter = useCallback(async () => {
    const current = chapterRef.current;
    if (!current || !sourceId || !novelId) return;
    if (offlineMode) {
      Alert.alert(t('reader.offlineTitle'), t('reader.offlineMessage'));
      return;
    }
    setDownloading(true);
    try {
      await downloadChapterRange(sourceId, novelId, [current.id]);
    } catch {
      Alert.alert(t('download.failed'), t('reader.errorMessage'));
    } finally {
      setDownloading(false);
    }
  }, [novelId, offlineMode, sourceId]);

  const metaTitle = meta?.title ?? null;
  const novelUrl = novel?.url ?? null;

  const onMenu = useCallback(
    (value: string | null) => {
      setMenuOpen(false);
      if (!value) return;
      if (value === 'chapters') openChapters();
      if (value === 'download') void downloadChapter();
      if (value === 'read') void markRead();
      if (value === 'unread') void markUnread();
      if (value === 'open') {
        if (novelUrl) void Linking.openURL(novelUrl);
      }
      if (value === 'share') {
        void Share.share({
          message: [title, chapterDisplayTitle(metaTitle), novelUrl].filter(Boolean).join('\n'),
        });
      }
    },
    [downloadChapter, markRead, markUnread, metaTitle, novelUrl, openChapters, title],
  );

  const onListen = useCallback(() => {
    if (!sourceId || !novelId) return;
    if (narrationStatus === 'loading') return;
    // Both screens drive the same session, so this is the whole rule: if the
    // voice is already in this chapter, toggle it; if it is elsewhere in the
    // loaded window, move it here; otherwise start a session at this chapter.
    if (listening && meta) {
      const all = narrationChunks();
      const target = all.findIndex((chunk) => chunk.pageIndex === meta.position);
      if (target >= 0) {
        const current = all[narrationChunkIndex];
        if (current?.pageIndex !== meta.position) {
          void seekNarration(target);
          return;
        }
        if (narrationStatus === 'playing') {
          void pauseNarration();
          return;
        }
        if (narrationStatus === 'paused') {
          void resumeNarration();
          return;
        }
      }
    }
    if (narrationError) {
      Alert.alert(t('reader.listen'), narrationError);
    }
    // A loaded session that already finished or failed is replayed in place:
    // rebuilding it would reload the whole window for nothing.
    if (hasNarration && !listening) {
      const all = narrationChunks();
      const target = meta ? all.findIndex((chunk) => chunk.pageIndex === meta.position) : -1;
      void seekNarration(
        target >= 0 ? target : Math.min(narrationChunkIndex, all.length - 1),
        true,
      );
      return;
    }
    void playNarration(sourceId, novelId, title, meta?.id ?? null);
  }, [
    hasNarration,
    listening,
    meta,
    narrationChunkIndex,
    narrationError,
    narrationStatus,
    novelId,
    pauseNarration,
    playNarration,
    resumeNarration,
    seekNarration,
    sourceId,
    title,
  ]);

  const chapterLabel =
    meta != null
      ? t('reader.position', {
          current: meta.number ?? meta.position + 1,
          total: chapters.length,
          percent: Math.round(pct * 100),
        })
      : '';

  const onNextChapter = useCallback(() => {
    goTo(next);
  }, [goTo, next]);

  const onMarkReadPress = useCallback(() => {
    void markRead();
  }, [markRead]);

  const chapterTitle =
    chapterDisplayTitle(meta?.title) ||
    (meta ? t('reader.chapterFallback', { number: meta.number ?? meta.position + 1 }) : '');

  const textInfo = useMemo(() => chapterText(blocks), [blocks]);
  // Narration reads the pronunciation-applied text; the reader shows the raw
  // text. The narrator hands over the exact map it used, so the spoken block
  // is highlighted without either side guessing at offsets.
  const mappedNarration = meta ? narrationPageMap(meta.position, textInfo.text) : null;
  const highlightIndex = useMemo(() => {
    if (!listening || !meta || !mappedNarration) return null;
    const chunk = narrationChunks()[narrationChunkIndex];
    if (!chunk || chunk.pageIndex !== meta.position) return null;
    const range = sourceRangeForNarrationRange(mappedNarration, chunk.start, chunk.end);
    return blockIndexForRange(textInfo.spans, range);
  }, [listening, mappedNarration, meta, narrationChunkIndex, textInfo.spans]);

  // A tap anywhere asks for the controls, even while the voice is running:
  // otherwise the chrome is unreachable exactly when it is wanted.
  const onBlockPress = useCallback(() => {
    setChromeVisible((visible) => !visible);
  }, []);

  // Long press on a paragraph sends the voice there.
  const onBlockLongPress = useCallback(
    (blockIndex: number) => {
      if (!listening || !meta || !mappedNarration) return;
      const target = chunkIndexForBlock(
        narrationChunks(),
        mappedNarration,
        textInfo.spans,
        blockIndex,
        meta.position,
      );
      if (target != null) void seekNarration(target);
    },
    [listening, mappedNarration, meta, seekNarration, textInfo.spans],
  );

  if (state === 'loading') {
    return (
      <ReaderFrame palette={palette} dark={reader.theme === 'dark' || reader.theme === 'black'}>
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator color={palette.link} size="large" />
          <Text style={[styles.stateLabel, { color: palette.muted }]}>
            {t('reader.loadingChapter')}
          </Text>
        </View>
      </ReaderFrame>
    );
  }

  if (state === 'offline' || state === 'error' || state === 'empty') {
    const isOffline = state === 'offline';
    const isEmpty = state === 'empty';
    return (
      <ReaderFrame palette={palette} dark={reader.theme === 'dark' || reader.theme === 'black'}>
        <View style={[styles.stateHeader, { paddingTop: insets.top }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.stateBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={26} color={palette.text} />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Ionicons
            name={
              isOffline ? 'cloud-offline-outline' : isEmpty ? 'document-outline' : 'warning-outline'
            }
            size={40}
            color={palette.muted}
          />
          <Text style={[styles.stateTitle, { color: palette.text }]}>
            {isOffline
              ? t('reader.notDownloadedTitle')
              : isEmpty
                ? t('reader.emptyTitle')
                : t('reader.errorTitle')}
          </Text>
          <Text style={[styles.stateBody, { color: palette.muted }]}>
            {isOffline
              ? t('reader.notDownloadedMessage')
              : isEmpty
                ? t('reader.emptyMessage')
                : (error ?? t('reader.errorMessage'))}
          </Text>
          <View style={styles.stateActions}>
            {!isOffline && !isEmpty ? (
              <Pressable
                onPress={() => setReloadKey((key) => key + 1)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.statePrimary,
                  { backgroundColor: palette.link, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.statePrimaryLabel, { color: palette.background }]}>
                  {t('common.retry')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={openChapters}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.stateSecondary,
                { borderColor: palette.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.stateSecondaryLabel, { color: palette.text }]}>
                {t('reader.backToChapters')}
              </Text>
            </Pressable>
          </View>
        </View>
      </ReaderFrame>
    );
  }

  return (
    <ReaderFrame palette={palette} dark={reader.theme === 'dark' || reader.theme === 'black'}>
      <ChapterBody
        key={chapterId}
        blocks={blocks}
        reader={reader}
        palette={palette}
        chapterNumber={meta?.number ?? (meta ? meta.position + 1 : null)}
        chapterTitle={chapterTitle}
        initialScrollPct={restore.pct}
        initialParagraph={restore.paragraph}
        nextTitle={
          chapterDisplayTitle(next?.title) ||
          (next ? t('reader.chapterFallback', { number: next.number ?? next.position + 1 }) : null)
        }
        highlightIndex={highlightIndex}
        followHighlight={listening && narrationStatus === 'playing'}
        onProgress={onProgress}
        onBlockPress={onBlockPress}
        onBlockLongPress={onBlockLongPress}
        onNext={onNextChapter}
        onBackToChapters={openChapters}
        onMarkRead={onMarkReadPress}
      />

      <ReaderChrome
        visible={chromeVisible}
        palette={palette}
        title={title}
        chapterLabel={chapterLabel}
        percent={pct}
        canPrevious={previous != null}
        canNext={next != null}
        hasSession={hasNarration}
        playing={narrationStatus === 'playing'}
        onBack={handleBack}
        onMore={() => setMenuOpen(true)}
        onPrevious={() => goTo(previous)}
        onChapters={openChapters}
        onDisplay={() => {
          setChromeVisible(false);
          setDisplayOpen(true);
        }}
        onListen={onListen}
        onNext={() => goTo(next)}
        onRewind={() => void skipNarration(-skipSeconds)}
        onForward={() => void skipNarration(skipSeconds)}
        skipLabel={t('narration.skipSeconds', { count: skipSeconds })}
        speedLabel={t('narration.speedValue', { value: narrationSpeed })}
        onSpeed={() => setSpeedOpen(true)}
      />

      {!chromeVisible && hasNarration ? (
        <View
          style={[
            styles.listeningBar,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              bottom: insets.bottom + 24,
            },
          ]}
        >
          <Pressable
            onPress={() => void skipNarration(-skipSeconds)}
            style={styles.listeningAction}
            accessibilityRole="button"
            accessibilityLabel={t('player.rewind', { seconds: skipSeconds })}
          >
            <Ionicons name="play-back" size={20} color={palette.text} />
          </Pressable>
          <Pressable
            onPress={onListen}
            style={styles.listeningAction}
            accessibilityRole="button"
            accessibilityLabel={
              narrationStatus === 'playing' ? t('reader.pause') : t('reader.listen')
            }
          >
            <Ionicons
              name={narrationStatus === 'playing' ? 'pause' : 'play'}
              size={22}
              color={palette.link}
            />
          </Pressable>
          <Pressable
            onPress={() => void skipNarration(skipSeconds)}
            style={styles.listeningAction}
            accessibilityRole="button"
            accessibilityLabel={t('player.forward', { seconds: skipSeconds })}
          >
            <Ionicons name="play-forward" size={20} color={palette.text} />
          </Pressable>
        </View>
      ) : null}

      <DisplaySheet
        visible={displayOpen}
        reader={reader}
        palette={palette}
        onChange={updateReader}
        onClose={() => setDisplayOpen(false)}
      />

      <OptionSheet
        visible={speedOpen}
        title={t('narration.speed')}
        value={nearestSpeedOption(narrationSpeed)}
        options={NARRATION_SPEED_VALUES.map((value) => ({
          value: String(value),
          label: t('narration.speedValue', { value }),
        }))}
        onSelect={(value) => {
          if (value != null) void setNarrationSpeed(Number(value));
          setSpeedOpen(false);
        }}
        onClose={() => setSpeedOpen(false)}
      />

      <OptionSheet
        visible={menuOpen}
        title={chapterTitle}
        value={null}
        options={[
          { value: 'chapters', label: t('reader.chapterList'), icon: 'list' },
          {
            value: 'download',
            label: downloading ? t('download.downloading') : t('reader.downloadChapter'),
            icon: 'download-outline',
          },
          { value: 'read', label: t('reader.markRead'), icon: 'checkmark-outline' },
          { value: 'unread', label: t('reader.markUnread'), icon: 'ellipse-outline' },
          { value: 'open', label: t('reader.openSource'), icon: 'open-outline' },
          { value: 'share', label: t('reader.share'), icon: 'share-outline' },
        ]}
        onSelect={onMenu}
        onClose={() => setMenuOpen(false)}
      />
    </ReaderFrame>
  );
}

function ReaderFrame({
  children,
  palette,
  dark,
}: {
  children: React.ReactNode;
  palette: ReaderPalette;
  dark: boolean;
}) {
  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 32,
  },
  stateHeader: {
    left: 0,
    paddingHorizontal: 8,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  stateBack: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  stateLabel: { fontSize: 14 },
  stateTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  stateBody: { fontSize: 14, lineHeight: 21, maxWidth: 360, textAlign: 'center' },
  stateActions: { gap: 10, marginTop: 8, width: '100%', maxWidth: 360 },
  statePrimary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 20,
  },
  statePrimaryLabel: { fontSize: 15, fontWeight: '600' },
  stateSecondary: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 20,
  },
  stateSecondaryLabel: { fontSize: 15, fontWeight: '500' },
  listeningBar: {
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: 'absolute',
  },
  listeningAction: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 44,
  },
});
