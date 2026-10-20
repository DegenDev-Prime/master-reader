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
  /** Speed chip, e.g. "1.0×". */
  speedLabel: string;
  onPressSpeed?: () => void;
  /** Sleep chip, e.g. "30 min" or "Off". */
  sleepLabel: string;
  onPressSleep?: () => void;
};

/**
 * The transport row of the player: chapter jumps around a large play button,
 * with the speed and sleep-timer chips on the same line.
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
  speedLabel,
  onPressSpeed,
  sleepLabel,
  onPressSleep,
}: PlayerTransportProps) {
  const theme = useTheme();
  const seekDisabled = loading || !canSeek;

  return (
    <View style={styles.row}>
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
      <Ionicons name={icon} size={26} color={disabled ? theme.textMuted : theme.text} />
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
  row: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
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
  chips: { flex: 1, flexDirection: 'row', gap: Spacing.one, justifyContent: 'flex-end' },
  chip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
    minHeight: 36,
    paddingHorizontal: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
