import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

export type NowPlayingCardProps = {
  title: string;
  cover: string | null;
  /** Chapter line, e.g. "Ch. 214 · The Long Night". */
  subtitle: string | null;
  /** The sentence being spoken, truncated by the caller. */
  sentence: string | null;
  /** Whether the voice is currently speaking. */
  playing: boolean;
  onPressChapter?: () => void;
};

/**
 * The "now playing" card. The cover, the story and the spoken sentence sit in
 * one block so the eye finds the title, the voice and the controls together.
 */
export const NowPlayingCard = memo(function NowPlayingCard({
  title,
  cover,
  subtitle,
  sentence,
  playing,
  onPressChapter,
}: NowPlayingCardProps) {
  const theme = useTheme();
  // The first letter of the first word, skipping punctuation, so a title
  // that starts with a quote still gives a readable initial.
  const initial = title.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '?';

  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
    >
      <View style={styles.header}>
        <ThemedText type="eyebrow">{t('player.nowListening').toUpperCase()}</ThemedText>
        {playing ? <PlayingIndicator /> : null}
      </View>

      <View style={styles.body}>
        <View
          style={[styles.cover, { borderColor: theme.border, backgroundColor: theme.background }]}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {cover ? (
            <Image source={{ uri: cover }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <ThemedText type="title" themeColor="textMuted" style={styles.placeholder}>
              {initial}
            </ThemedText>
          )}
        </View>

        <View style={styles.text}>
          <ThemedText type="title2" numberOfLines={2}>
            {title}
          </ThemedText>
          {subtitle ? (
            <Pressable
              onPress={onPressChapter}
              disabled={!onPressChapter}
              accessibilityRole="button"
              accessibilityLabel={subtitle}
            >
              <ThemedText type="small" themeColor="primary" numberOfLines={1}>
                {subtitle}
              </ThemedText>
            </Pressable>
          ) : null}
          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={2}
            style={styles.sentence}
          >
            {sentence ?? t('player.idleSentence')}
          </ThemedText>
        </View>
      </View>
    </View>
  );
});

/** Three bars that stand in for a playing indicator. */
export const PlayingIndicator = memo(function PlayingIndicator() {
  const theme = useTheme();
  return (
    <View
      style={styles.indicator}
      accessibilityLabel={t('player.nowListening')}
      accessibilityLiveRegion="polite"
    >
      {[0, 1, 2].map((index) => (
        <View key={index} style={[styles.indicatorBar, { backgroundColor: theme.primary }]} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  body: { flexDirection: 'row', gap: Spacing.three },
  cover: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  coverImage: { width: '100%', height: '100%' },
  placeholder: { fontSize: 34, lineHeight: 40 },
  text: { flex: 1, gap: Spacing.one, minWidth: 0 },
  sentence: { fontStyle: 'italic' },
  indicator: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 12 },
  indicatorBar: { width: 3, height: 8 },
});
