import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useRef } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import type { ChapterBlock, InlineSpan } from '@/sources/content/parse';
import type { ReaderSettings } from '@/services/settings';
import { readerFontFamilies, type ReaderPalette } from '@/theme/reader';
import { withAlpha } from '@/utils/color';

type Progress = { pct: number; blockIndex: number };

type Props = {
  blocks: ChapterBlock[];
  reader: ReaderSettings;
  palette: ReaderPalette;
  chapterNumber: number | null;
  chapterTitle: string;
  initialScrollPct: number;
  initialParagraph: number | null;
  nextTitle: string | null;
  highlightIndex: number | null;
  followHighlight: boolean;
  onProgress: (progress: Progress) => void;
  onBlockPress: (blockIndex: number) => void;
  onNext: () => void;
  onBackToChapters: () => void;
  onMarkRead: () => void;
};

export const ChapterBody = memo(function ChapterBody({
  blocks,
  reader,
  palette,
  chapterNumber,
  chapterTitle,
  initialScrollPct,
  initialParagraph,
  nextTitle,
  highlightIndex,
  followHighlight,
  onProgress,
  onBlockPress,
  onNext,
  onBackToChapters,
  onMarkRead,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<number, number>>({});
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const restored = useRef(false);
  const lastReport = useRef(0);
  const lastPercent = useRef(-1);

  const fontFamily = readerFontFamilies[reader.fontFamily];
  const fontSize = reader.fontSize;
  const lineHeight = Math.round(fontSize * reader.lineHeight);
  const maxWidth = fontSize * 34;
  const paragraphGap = Math.round(fontSize * 0.6);

  const tryRestore = useCallback(() => {
    if (restored.current) return;
    if (contentHeight.current <= 0 || viewportHeight.current <= 0) return;
    const max = Math.max(0, contentHeight.current - viewportHeight.current);
    let y = 0;
    if (initialScrollPct > 0.001) {
      y = initialScrollPct * max;
    } else if (initialParagraph != null && initialParagraph > 0) {
      const offset = offsets.current[initialParagraph];
      if (offset == null) return;
      y = Math.max(0, offset - 24);
    }
    scrollRef.current?.scrollTo({ y, animated: false });
    restored.current = true;
  }, [initialParagraph, initialScrollPct]);

  useEffect(() => {
    if (!followHighlight || highlightIndex == null) return;
    const offset = offsets.current[highlightIndex];
    if (offset == null || viewportHeight.current <= 0) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, offset - viewportHeight.current / 3),
      animated: true,
    });
  }, [followHighlight, highlightIndex]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const max = Math.max(0, contentSize.height - layoutMeasurement.height);
      const pct = max > 0 ? Math.min(1, Math.max(0, contentOffset.y / max)) : 0;
      const probe = contentOffset.y + layoutMeasurement.height / 3;
      let blockIndex = 0;
      for (let index = 0; index < blocks.length; index += 1) {
        const offset = offsets.current[index];
        if (offset == null) continue;
        if (offset <= probe) blockIndex = index;
        else break;
      }

      const now = Date.now();
      const percentChanged = Math.abs(pct - lastPercent.current) > 0.002;
      if (now - lastReport.current < 120 && !percentChanged) return;
      lastReport.current = now;
      lastPercent.current = pct;
      onProgress({ pct, blockIndex });
    },
    [blocks.length, onProgress],
  );

  const onBlockLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      offsets.current[index] = event.nativeEvent.layout.y;
      tryRestore();
    },
    [tryRestore],
  );

  const paragraphStyle: TextStyle = {
    color: palette.text,
    fontFamily,
    fontSize,
    lineHeight,
    textAlign: reader.textAlign,
    marginBottom: paragraphGap,
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{
        paddingBottom: 96 + insets.bottom,
        paddingTop: insets.top + 16,
      }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onContentSizeChange={(_, h) => {
        contentHeight.current = h;
        tryRestore();
      }}
      onLayout={(event) => {
        viewportHeight.current = event.nativeEvent.layout.height;
        tryRestore();
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => onBlockPress(-1)}
        style={[
          styles.column,
          {
            maxWidth,
            paddingHorizontal: Math.min(reader.marginHorizontal, Math.max(8, (width - 240) / 2)),
          },
        ]}
      >
        <View style={styles.header}>
          {chapterNumber != null ? (
            <Text style={[styles.eyebrow, { color: palette.muted }]}>
              {t('reader.chapterEyebrow', { number: chapterNumber }).toUpperCase()}
            </Text>
          ) : null}
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: palette.text, fontFamily }]}
          >
            {chapterTitle}
          </Text>
        </View>

        {blocks.map((block, index) => {
          const highlighted = highlightIndex === index;
          const background = highlighted ? withAlpha(palette.link, 0.16) : undefined;

          if (block.kind === 'divider') {
            return (
              <View
                key={index}
                onLayout={(event) => onBlockLayout(index, event)}
                style={[styles.divider, { backgroundColor: palette.border }]}
              />
            );
          }

          if (block.kind === 'image') {
            return (
              <Pressable
                key={index}
                onPress={() => onBlockPress(index)}
                onLayout={(event) => onBlockLayout(index, event)}
                style={styles.imageWrap}
              >
                <Image
                  source={{ uri: block.src }}
                  style={[styles.image, { backgroundColor: palette.surface }]}
                  contentFit="contain"
                  transition={120}
                  accessibilityLabel={block.alt || t('reader.image')}
                />
              </Pressable>
            );
          }

          if (block.kind === 'heading') {
            return (
              <Text
                key={index}
                selectable
                accessibilityRole="header"
                onLayout={(event) => onBlockLayout(index, event)}
                onPress={onBlockPress ? () => onBlockPress(index) : undefined}
                style={[
                  paragraphStyle,
                  styles.heading,
                  highlighted && { backgroundColor: background },
                  {
                    color: palette.text,
                    fontSize: fontSize + (block.level <= 2 ? 4 : 2),
                    lineHeight: lineHeight + 4,
                  },
                ]}
              >
                {renderSpans(block.spans, palette, fontFamily, fontSize, lineHeight)}
              </Text>
            );
          }

          if (block.kind === 'pre') {
            return (
              <Text
                key={index}
                selectable
                onLayout={(event) => onBlockLayout(index, event)}
                onPress={onBlockPress ? () => onBlockPress(index) : undefined}
                style={[
                  paragraphStyle,
                  styles.pre,
                  highlighted && { backgroundColor: background },
                  { color: palette.text, backgroundColor: palette.surface },
                ]}
              >
                {block.text}
              </Text>
            );
          }

          if (block.kind === 'listItem') {
            return (
              <View
                key={index}
                onLayout={(event) => onBlockLayout(index, event)}
                style={[styles.listRow, highlighted && { backgroundColor: background }]}
              >
                <Text
                  style={[
                    paragraphStyle,
                    styles.listMarker,
                    { color: palette.muted, fontFamily, fontSize, lineHeight },
                  ]}
                >
                  {block.ordered ? `${block.index}.` : '•'}
                </Text>
                <Text
                  selectable
                  onPress={onBlockPress ? () => onBlockPress(index) : undefined}
                  style={[paragraphStyle, styles.listText]}
                >
                  {renderSpans(block.spans, palette, fontFamily, fontSize, lineHeight)}
                </Text>
              </View>
            );
          }

          if (block.kind === 'quote') {
            return (
              <View
                key={index}
                onLayout={(event) => onBlockLayout(index, event)}
                style={[
                  styles.quote,
                  { borderLeftColor: palette.border },
                  highlighted && { backgroundColor: background },
                ]}
              >
                <Text
                  selectable
                  onPress={onBlockPress ? () => onBlockPress(index) : undefined}
                  style={[
                    paragraphStyle,
                    styles.quoteText,
                    { color: palette.muted, fontFamily, fontSize, lineHeight },
                  ]}
                >
                  {renderSpans(block.spans, palette, fontFamily, fontSize, lineHeight)}
                </Text>
              </View>
            );
          }

          return (
            <Text
              key={index}
              selectable
              onLayout={(event) => onBlockLayout(index, event)}
              onPress={onBlockPress ? () => onBlockPress(index) : undefined}
              style={[paragraphStyle, highlighted && { backgroundColor: background }]}
            >
              {renderSpans(block.spans, palette, fontFamily, fontSize, lineHeight)}
            </Text>
          );
        })}

        <View
          style={[styles.endCard, { borderTopColor: palette.border }]}
          onLayout={(event) => onBlockLayout(blocks.length, event)}
        >
          <Text style={[styles.endEyebrow, { color: palette.muted }]}>
            {t('reader.endOfChapter').toUpperCase()}
          </Text>
          <Text style={[styles.endTitle, { color: palette.text, fontFamily }]}>
            {nextTitle ? t('reader.endNext', { title: nextTitle }) : t('reader.caughtUp')}
          </Text>
          <View style={styles.endActions}>
            {nextTitle ? (
              <Pressable
                onPress={onNext}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: palette.link, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.primaryLabel, { color: palette.background }]}>
                  {t('reader.readNext')}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={palette.background} />
              </Pressable>
            ) : (
              <Pressable
                onPress={onBackToChapters}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: palette.link, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.primaryLabel, { color: palette.background }]}>
                  {t('reader.backToChapters')}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onMarkRead}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: palette.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="checkmark" size={18} color={palette.text} />
              <Text style={[styles.secondaryLabel, { color: palette.text }]}>
                {t('reader.markRead')}
              </Text>
            </Pressable>
            {nextTitle ? (
              <Pressable
                onPress={onBackToChapters}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: palette.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={[styles.secondaryLabel, { color: palette.text }]}>
                  {t('reader.backToChapters')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Pressable>
    </ScrollView>
  );
});

function renderSpans(
  spans: InlineSpan[],
  palette: ReaderPalette,
  fontFamily: string | undefined,
  fontSize: number,
  lineHeight: number,
) {
  return spans.map((span, index) => {
    const style: TextStyle = {
      color: span.href ? palette.link : palette.text,
      fontFamily,
      fontSize,
      lineHeight,
    };
    if (span.bold) style.fontWeight = '700';
    if (span.italic) style.fontStyle = 'italic';
    if (span.underline || span.href) style.textDecorationLine = 'underline';
    if (span.strike) style.textDecorationLine = 'line-through';

    if (span.href) {
      return (
        <Text
          key={index}
          style={style}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(span.href!)}
        >
          {span.text}
        </Text>
      );
    }

    return (
      <Text key={index} style={style}>
        {span.text}
      </Text>
    );
  });
}

const styles = StyleSheet.create({
  column: {
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 28,
    marginTop: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.1,
    lineHeight: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  heading: {
    fontWeight: '700',
  },
  pre: {
    fontFamily: 'monospace',
    padding: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 24,
  },
  imageWrap: {
    marginBottom: 20,
  },
  image: {
    height: 240,
    width: '100%',
  },
  listRow: {
    flexDirection: 'row',
    gap: 8,
  },
  listMarker: {
    minWidth: 20,
    textAlign: 'right',
  },
  listText: {
    flex: 1,
  },
  quote: {
    borderLeftWidth: 2,
    marginBottom: 16,
    paddingLeft: 14,
  },
  quoteText: {
    fontStyle: 'italic',
    marginBottom: 0,
  },
  endCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    marginTop: 40,
    paddingBottom: 24,
    paddingTop: 28,
  },
  endEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  endTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: 8,
  },
  endActions: {
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
