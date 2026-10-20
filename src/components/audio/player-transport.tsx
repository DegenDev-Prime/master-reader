import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

export type PlayerTransportProps = {
  playing: boolean;
  loading?: boolean;
  canSeek?: boolean;
  canPreviousChapter?: boolean;
  canNextChapter?: boolean;
  onPressPlay: () => void;
  onPreviousChapter?: () => void;
  onNextChapter?: () => void;
  /** Rewind and forward by the configured skip interval. */
  onRewind?: () => void;
  onForward?: () => void;
  /** The skip interval, e.g. "15s". */
  skipLabel?: string;
  /** Speed chip, e.g. "1.0×". */
  speedLabel: string;
  onPressSpeed?: () => void;
  /** Sleep chip, e.g. "30 min" or "Off". */
  sleepLabel: string;
  onPressSleep?: () => void;
  /** Voice chip, e.g. "System voice". */
  voiceLabel?: string;
  onPressVoice?: () => void;
  onPressBookmark?: () => void;
  bookmarked?: boolean;
};

/**
 * The transport of the player: a skip and a play button around a large play
 * button, chapter jumps beside them, and the speed, sleep, voice and bookmark
 * controls on a second line. Every control acts on the running session
 * directly; nothing here navigates away from the player.
 */
export const PlayerTransport = memo(function PlayerTransport({
  playing,
  loading = false,
  canSeek = false,
  canPreviousChapter = false,
  canNextChapter = false,
  onPressPlay,
  onPreviousChapter,
  onNextChapter,
  onRewind,
  onForward,
  skipLabel,
  speedLabel,
  onPressSpeed,
  sleepLabel,
  onPressSleep,
  voiceLabel,
  onPressVoice,
  onPressBookmark,
  bookmarked = false,
}: PlayerTransportProps) {
  const theme = useTheme();
  const seekDisabled = loading || !canSeek;

  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <SkipButton
          icon="play-back"
          label={t('player.rewind', { seconds: skipLabel ?? '15' })}
          disabled={seekDisabled}
          onPress={onRewind}
        />

        <TransportButton
          icon="play-skip-back"
          label={t('reader.previousChapter')}
          disabled={seekDisabled || !canPreviousChapter}
          onPress={onPreviousChapter}
        />

        <Pressable
          onPress={onPressPlay}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={playing ? t('narration.pause') : t('narration.play')}
          accessibilityState={{ disabled: loading }}
          style={({ pressed }) => [
            styles.play,
            { backgroundColor: theme.primary, borderColor: theme.primary },
            pressed && { opacity: 0.85 },
            loading && { opacity: 0.5 },
          ]}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={30} color={theme.primaryText} />
        </Pressable>

        <TransportButton
          icon="play-skip-forward"
          label={t('reader.nextChapter')}
          disabled={seekDisabled || !canNextChapter}
          onPress={onNextChapter}
        />

        <SkipButton
          icon="play-forward"
          label={t('player.forward', { seconds: skipLabel ?? '15' })}
          disabled={seekDisabled}
          onPress={onForward}
        />
      </View>

      <View style={styles.chips}>
        <ChipButton
          icon="speedometer-outline"
          label={speedLabel}
          onPress={onPressSpeed}
          disabled={loading}
        />
        <ChipButton
          icon="moon-outline"
          label={sleepLabel}
          onPress={onPressSleep}
          disabled={loading}
        />
        {voiceLabel ? (
          <ChipButton
            icon="mic-outline"
            label={voiceLabel}
            onPress={onPressVoice}
            disabled={loading}
          />
        ) : null}
        {onPressBookmark ? (
          <Pressable
            onPress={onPressBookmark}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? t('narration.bookmarked') : t('narration.bookmark')}
            accessibilityState={{ disabled: loading, selected: bookmarked }}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: theme.border, backgroundColor: theme.backgroundSelected },
              pressed && !loading && { opacity: 0.85 },
              loading && { opacity: 0.45 },
            ]}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={14}
              color={bookmarked ? theme.primary : theme.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

function TransportButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Ionicons name={icon} size={24} color={disabled ? theme.textMuted : theme.text} />
    </Pressable>
  );
}

/** A skip control: the direction arrow with the interval under it. */
function SkipButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.skip,
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Ionicons name={icon} size={22} color={disabled ? theme.textMuted : theme.textSecondary} />
      <ThemedText type="small" themeColor="textMuted">
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ChipButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: theme.border, backgroundColor: theme.backgroundSelected },
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Ionicons name={icon} size={14} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
  row: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'center' },
  play: {
    alignItems: 'center',
    height: 60,
    justifyContent: 'center',
    width: 60,
    borderWidth: StyleSheet.hairlineWidth,
  },
  button: {
    alignItems: 'center',
    height: MinTouchTarget,
    justifyContent: 'center',
    width: MinTouchTarget,
  },
  skip: { alignItems: 'center', gap: 2, justifyContent: 'center', minWidth: 44 },
  chips: { flexDirection: 'row', gap: Spacing.one, justifyContent: 'center' },
  chip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
    minHeight: 36,
    paddingHorizontal: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
