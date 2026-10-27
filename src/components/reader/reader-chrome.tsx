import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import type { ReaderPalette } from '@/theme/reader';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  palette: ReaderPalette;
  title: string;
  chapterLabel: string;
  percent: number;
  canPrevious: boolean;
  canNext: boolean;
  /** Whether this story has a narration session, so the voice controls show. */
  hasSession: boolean;
  playing: boolean;
  onBack: () => void;
  onMore: () => void;
  onPrevious: () => void;
  onChapters: () => void;
  onDisplay: () => void;
  onListen: () => void;
  onNext: () => void;
  /** Moves the voice by the configured skip interval. */
  onRewind: () => void;
  onForward: () => void;
  /** The skip interval, e.g. "15s". */
  skipLabel: string;
  speedLabel: string;
  onSpeed: () => void;
};

export function ReaderChrome({
  visible,
  palette,
  title,
  chapterLabel,
  percent,
  canPrevious,
  canNext,
  hasSession,
  playing,
  onBack,
  onMore,
  onPrevious,
  onChapters,
  onDisplay,
  onListen,
  onNext,
  onRewind,
  onForward,
  skipLabel,
  speedLabel,
  onSpeed,
}: Props) {
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  return (
    <>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.top,
          {
            backgroundColor: palette.background,
            borderBottomColor: palette.border,
            opacity,
            paddingTop: insets.top,
          },
        ]}
      >
        <View style={styles.topRow}>
          <ChromeButton
            icon="chevron-back"
            label={t('common.back')}
            palette={palette}
            onPress={onBack}
          />
          <View style={styles.topTitle}>
            <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: palette.muted }]} numberOfLines={1}>
              {chapterLabel}
            </Text>
          </View>
          <ChromeButton
            icon="ellipsis-horizontal"
            label={t('common.more')}
            palette={palette}
            onPress={onMore}
          />
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.bottom,
          {
            backgroundColor: palette.background,
            borderTopColor: palette.border,
            opacity,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.progressRow}>
          <View style={[styles.track, { backgroundColor: palette.border }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: palette.link,
                  width: `${Math.min(100, Math.max(0, percent * 100))}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* The voice controls live here, on the screen that shows the text
            being spoken, so listening never needs a trip to the Audio tab. */}
        {hasSession ? (
          <View style={styles.transport}>
            <Pressable
              onPress={onRewind}
              accessibilityRole="button"
              accessibilityLabel={t('player.rewind', { seconds: skipLabel })}
              style={({ pressed }) => [
                styles.transportButton,
                pressed && { backgroundColor: palette.surface },
              ]}
            >
              <Ionicons name="play-back" size={22} color={palette.text} />
              <Text style={[styles.transportLabel, { color: palette.muted }]}>{skipLabel}</Text>
            </Pressable>

            <Pressable
              onPress={onListen}
              accessibilityRole="button"
              accessibilityLabel={playing ? t('reader.pause') : t('reader.listen')}
              style={({ pressed }) => [
                styles.transportPlay,
                { borderColor: palette.border },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={26} color={palette.text} />
            </Pressable>

            <Pressable
              onPress={onForward}
              accessibilityRole="button"
              accessibilityLabel={t('player.forward', { seconds: skipLabel })}
              style={({ pressed }) => [
                styles.transportButton,
                pressed && { backgroundColor: palette.surface },
              ]}
            >
              <Ionicons name="play-forward" size={22} color={palette.text} />
              <Text style={[styles.transportLabel, { color: palette.muted }]}>{skipLabel}</Text>
            </Pressable>

            <Pressable
              onPress={onSpeed}
              accessibilityRole="button"
              accessibilityLabel={t('narration.speed')}
              style={({ pressed }) => [
                styles.transportSpeed,
                { borderColor: palette.border },
                pressed && { backgroundColor: palette.surface },
              ]}
            >
              <Text style={[styles.transportSpeedLabel, { color: palette.text }]}>
                {speedLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Action
            icon="chevron-back"
            label={t('reader.previous')}
            palette={palette}
            disabled={!canPrevious}
            onPress={onPrevious}
          />
          <Action icon="list" label={t('reader.chapters')} palette={palette} onPress={onChapters} />
          <Action icon="text" label={t('reader.display')} palette={palette} onPress={onDisplay} />
          {hasSession ? null : (
            <Action
              icon="headset-outline"
              label={t('reader.listen')}
              palette={palette}
              onPress={onListen}
            />
          )}
          <Action
            icon="chevron-forward"
            label={t('reader.next')}
            palette={palette}
            disabled={!canNext}
            onPress={onNext}
          />
        </View>
      </Animated.View>
    </>
  );
}

function ChromeButton({
  icon,
  label,
  palette,
  onPress,
}: {
  icon: IconName;
  label: string;
  palette: ReaderPalette;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: palette.surface }]}
    >
      <Ionicons name={icon} size={24} color={palette.text} />
    </Pressable>
  );
}

function Action({
  icon,
  label,
  palette,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  palette: ReaderPalette;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.action,
        pressed && !disabled && { backgroundColor: palette.surface },
      ]}
    >
      <Ionicons name={icon} size={22} color={disabled ? palette.border : palette.text} />
      <Text style={[styles.actionLabel, { color: disabled ? palette.muted : palette.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    left: 0,
    paddingHorizontal: 6,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
  },
  topTitle: { flex: 1, gap: 1, paddingHorizontal: 4 },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12 },
  iconButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  bottom: {
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  progressRow: { paddingHorizontal: 16, paddingTop: 10 },
  track: { height: 2, overflow: 'hidden' },
  fill: { height: 2 },
  transport: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  transportButton: {
    alignItems: 'center',
    gap: 2,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 52,
  },
  transportLabel: { fontSize: 10, fontWeight: '500' },
  transportPlay: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  transportSpeed: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 56,
    paddingHorizontal: 10,
  },
  transportSpeedLabel: { fontSize: 13, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  action: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 52,
  },
  actionLabel: { fontSize: 10, fontWeight: '500' },
});
