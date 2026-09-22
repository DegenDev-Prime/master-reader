import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingView } from '@/components/ui/loading';
import { Spacing } from '@/constants/theme';
import { useReadingProgress, useStoryDetails, useStoryPages } from '@/hooks/queries';
import type { StoryPage, StorySeriesItem } from '@/models/story';
import { openReader } from '@/navigation/routes';
import {
  clampPageIndex,
  nextPageIndex,
  previousPageIndex,
  progressPercent,
  recordHistory,
  saveReadingProgress,
} from '@/services/reading';
import { useSettingsStore } from '@/stores/settings';
import { readerFontFamilies, readerPalettes } from '@/theme/reader';
import { htmlToPlainText } from '@/utils/html';

type ReaderItem =
  | { key: string; kind: 'page'; page: StoryPage }
  | { key: string; kind: 'next' };

export default function ReaderScreen() {
  const params = useLocalSearchParams<{ sourceId?: string; id?: string }>();
  const sourceId = params.sourceId;
  const id = params.id;

  const pagesQuery = useStoryPages(sourceId ?? '', id ?? '');
  const progressQuery = useReadingProgress(sourceId ?? '', id ?? '');
  const detailsQuery = useStoryDetails(sourceId ?? '', id ?? '');

  if (!sourceId || !id) {
    return (
      <ReaderShell>
        <ErrorState message={t('story.missing')} />
      </ReaderShell>
    );
  }

  if (pagesQuery.isLoading || progressQuery.isLoading) {
    return (
      <ReaderShell>
        <LoadingView label={t('reader.loading')} />
      </ReaderShell>
    );
  }

  const pages = pagesQuery.data ?? [];
  if (pagesQuery.isError || pages.length === 0) {
    return (
      <ReaderShell>
        <ErrorState
          message={(pagesQuery.error as Error)?.message ?? t('reader.noContent')}
          onRetry={() => void pagesQuery.refetch()}
        />
      </ReaderShell>
    );
  }

  const series = detailsQuery.data?.series ?? null;
  const position = series ? series.items.findIndex((item) => item.id === id) : -1;
  const nextChapter = series && position >= 0 ? (series.items[position + 1] ?? null) : null;
  const prevChapter = series && position > 0 ? series.items[position - 1] : null;

  const initialPage = clampPageIndex(progressQuery.data?.pageIndex ?? 0, pages.length);
  return (
    <Reader
      pages={pages}
      sourceId={sourceId}
      storyId={id}
      initialPage={initialPage}
      nextChapter={nextChapter}
      prevChapter={prevChapter}
    />
  );
}

function ReaderShell({ children }: { children: React.ReactNode }) {
  const readerTheme = useSettingsStore((state) => state.settings.reader.theme);
  const palette = readerPalettes[readerTheme];

  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        {children}
      </SafeAreaView>
    </View>
  );
}

type ReaderProps = {
  pages: StoryPage[];
  sourceId: string;
  storyId: string;
  initialPage: number;
  nextChapter: StorySeriesItem | null;
  prevChapter: StorySeriesItem | null;
};

function Reader({ pages, sourceId, storyId, initialPage, nextChapter, prevChapter }: ReaderProps) {
  const { width } = useWindowDimensions();
  const reader = useSettingsStore((state) => state.settings.reader);
  const setSetting = useSettingsStore((state) => state.setSetting);

  const palette = readerPalettes[reader.theme];
  const fontFamily = readerFontFamilies[reader.fontFamily];
  const horizontal = reader.pagination === 'horizontal';

  useKeepAwake();

  const listRef = useRef<FlatList<ReaderItem> | null>(null);
  const [index, setIndex] = useState(initialPage);
  const [hudVisible, setHudVisible] = useState(false);
  const lastTap = useRef(0);
  const recorded = useRef(false);

  const items = useMemo<ReaderItem[]>(() => {
    const list: ReaderItem[] = pages.map((page) => ({
      key: `p${page.index}`,
      kind: 'page',
      page,
    }));
    if (nextChapter) list.push({ key: 'next', kind: 'next' });
    return list;
  }, [pages, nextChapter]);

  const total = pages.length;

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    void recordHistory(sourceId, storyId, initialPage);
  }, [sourceId, storyId, initialPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void saveReadingProgress({ sourceId, storyId, pageIndex: index, pageCount: total });
    }, 500);
    return () => clearTimeout(timer);
  }, [index, total, sourceId, storyId]);

  // Chapter chaining: reaching the end marker loads the next chapter.
  useEffect(() => {
    if (nextChapter && index === total) {
      router.replace(`/reader/${sourceId}/${nextChapter.id}`);
    }
  }, [index, total, nextChapter, sourceId]);

  const goToPage = useCallback(
    (next: number) => {
      const target = clampPageIndex(next, total);
      setIndex(target);
      listRef.current?.scrollToIndex({ index: target, animated: true });
    },
    [total],
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((token) => token.isViewable && token.index != null);
      if (first?.index != null) setIndex(first.index);
    },
    [],
  );

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 60 }), []);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      setHudVisible((value) => !value);
    } else {
      lastTap.current = now;
    }
  }, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<ReaderItem> | null | undefined, itemIndex: number) => ({
      length: width,
      offset: width * itemIndex,
      index: itemIndex,
    }),
    [width],
  );

  const percent = progressPercent(Math.min(index, total - 1), total);

  const renderPage = (page: StoryPage) => (
    <ScrollView
      style={horizontal ? { width } : undefined}
      contentContainerStyle={[styles.page, { paddingHorizontal: reader.marginHorizontal }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={handleTap}>
        <Text
          style={{
            color: palette.text,
            fontFamily,
            fontSize: reader.fontSize,
            lineHeight: reader.fontSize * reader.lineHeight,
            textAlign: reader.textAlign,
          }}
        >
          {htmlToPlainText(page.content ?? '')}
        </Text>
      </Pressable>
    </ScrollView>
  );

  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      <FlatList
        ref={listRef}
        data={items}
        horizontal={horizontal}
        pagingEnabled={horizontal}
        initialScrollIndex={horizontal ? initialPage : undefined}
        getItemLayout={horizontal ? getItemLayout : undefined}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          }, 50);
        }}
        extraData={`${reader.fontSize}:${reader.lineHeight}:${reader.fontFamily}:${reader.textAlign}:${reader.marginHorizontal}:${reader.theme}:${reader.pagination}`}
        renderItem={({ item }) =>
          item.kind === 'page' ? (
            renderPage(item.page)
          ) : (
            <View style={[horizontal ? { width } : styles.fill, styles.endPage]}>
              <Text style={[styles.endTitle, { color: palette.text }]}>
                {t('reader.endOfChapter')}
              </Text>
              <Button
                title={t('reader.continueTo', { title: nextChapter?.title ?? '' })}
                icon="arrow-forward"
                onPress={() => {
                  if (nextChapter) router.replace(`/reader/${sourceId}/${nextChapter.id}`);
                }}
              />
            </View>
          )
        }
      />

      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('reader.close')}
          style={styles.backButton}
        >
          <Text style={[styles.back, { color: palette.text }]}>{'\u2039'}</Text>
        </Pressable>
      </SafeAreaView>

      {hudVisible ? (
        <ReadingHub
          reader={reader}
          palette={palette}
          sourceId={sourceId}
          index={Math.min(index, total - 1)}
          total={total}
          percent={percent}
          nextChapter={nextChapter}
          prevChapter={prevChapter}
          onChangeFont={(delta) =>
            void setSetting('reader', {
              ...reader,
              fontSize: Math.min(32, Math.max(12, reader.fontSize + delta)),
            })
          }
          onChangePagination={(pagination) => void setSetting('reader', { ...reader, pagination })}
          onPrevPage={() => goToPage(previousPageIndex(index))}
          onNextPage={() => goToPage(nextPageIndex(index, total))}
          onClose={() => setHudVisible(false)}
        />
      ) : null}
    </View>
  );
}

type ReadingHubProps = {
  reader: ReturnType<typeof useSettingsStore.getState>['settings']['reader'];
  palette: { text: string; muted: string };
  sourceId: string;
  index: number;
  total: number;
  percent: number;
  nextChapter: StorySeriesItem | null;
  prevChapter: StorySeriesItem | null;
  onChangeFont: (delta: number) => void;
  onChangePagination: (pagination: 'horizontal' | 'vertical') => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onClose: () => void;
};

function ReadingHub({
  reader,
  palette,
  sourceId,
  index,
  total,
  percent,
  nextChapter,
  prevChapter,
  onChangeFont,
  onChangePagination,
  onPrevPage,
  onNextPage,
  onClose,
}: ReadingHubProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.hubWrap} pointerEvents="box-none">
      <View style={[styles.hub, { backgroundColor: readerPalettes[reader.theme].background }]}>
        <View style={styles.hubRow}>
          <Text style={[styles.hubLabel, { color: palette.muted }]}>{t('reader.font')}</Text>
          <View style={styles.hubControls}>
            <Pressable onPress={() => onChangeFont(-1)} hitSlop={8}>
              <Text style={[styles.hubButton, { color: palette.text }]}>A-</Text>
            </Pressable>
            <Text style={[styles.hubValue, { color: palette.text }]}>{reader.fontSize}</Text>
            <Pressable onPress={() => onChangeFont(1)} hitSlop={8}>
              <Text style={[styles.hubButton, { color: palette.text }]}>A+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hubRow}>
          <Text style={[styles.hubLabel, { color: palette.muted }]}>
            {t('settings.pagination')}
          </Text>
          <View style={styles.hubControls}>
            <Chip
              label={t('settings.paginationStyle.horizontal')}
              selected={reader.pagination === 'horizontal'}
              onPress={() => onChangePagination('horizontal')}
            />
            <Chip
              label={t('settings.paginationStyle.vertical')}
              selected={reader.pagination === 'vertical'}
              onPress={() => onChangePagination('vertical')}
            />
          </View>
        </View>

        <View style={styles.hubRow}>
          <Text style={[styles.hubLabel, { color: palette.muted }]}>{t('reader.progress')}</Text>
          <View style={styles.hubControls}>
            <Text style={[styles.hubValue, { color: palette.text }]}>
              {index + 1} / {total} · {percent}%
            </Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${percent}%`, backgroundColor: readerPalettes[reader.theme].text },
            ]}
          />
        </View>

        <View style={styles.hubRow}>
          <View style={styles.hubControls}>
            <Button variant="ghost" title={t('reader.previous')} onPress={onPrevPage} />
            <Button variant="ghost" title={t('reader.next')} onPress={onNextPage} />
          </View>
          <View style={styles.hubControls}>
            {prevChapter ? (
              <Button
                variant="secondary"
                title={t('reader.previous')}
                onPress={() => openReader(sourceId, prevChapter.id)}
              />
            ) : null}
            {nextChapter ? (
              <Button
                variant="secondary"
                title={t('reader.nextChapter')}
                onPress={() => openReader(sourceId, nextChapter.id)}
              />
            ) : null}
          </View>
        </View>

        <Pressable onPress={onClose} style={styles.hubClose} hitSlop={8}>
          <Text style={[styles.hubCloseText, { color: palette.muted }]}>{'\u2304'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingTop: Spacing.six, paddingBottom: Spacing.six },
  endPage: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.five,
  },
  endTitle: { fontSize: 18, fontWeight: '600' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  backButton: { opacity: 0.5 },
  back: { fontSize: 30, lineHeight: 30 },
  hubWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  hub: {
    margin: Spacing.three,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.3)',
  },
  hubRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hubLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  hubControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hubButton: { fontSize: 18, fontWeight: '700', paddingHorizontal: Spacing.two },
  hubValue: { fontSize: 14, fontWeight: '600' },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.25)',
    overflow: 'hidden',
  },
  progressFill: { height: 4 },
  hubClose: { alignItems: 'center', paddingTop: Spacing.one },
  hubCloseText: { fontSize: 20 },
});
