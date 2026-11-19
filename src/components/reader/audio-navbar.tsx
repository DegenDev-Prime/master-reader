import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { changeAudioChapter, skipAudio, toggleAudio } from '@/services/audio-session';
import { useAudioStore } from '@/stores/audio';
import type { ReaderPalette } from '@/theme/reader';

type Props = {
  /** Reader screens pass their reading palette; other screens use the app theme. */
  palette?: ReaderPalette;
};

/** One shared audio bar; state lives in `useAudioStore`. */
export function AudioNavbar({ palette }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const phase = useAudioStore((state) => state.phase);

  const colors = palette ?? {
    background: theme.background,
    text: theme.text,
    muted: theme.textMuted,
    border: theme.border,
    surface: theme.backgroundElement,
    link: theme.primary,
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + Spacing.two,
        },
      ]}
    >
      <Control
        icon="play-skip-back"
        label={t('reader.previousChapter')}
        palette={colors}
        onPress={() => void changeAudioChapter(-1)}
      />
      <Control
        icon="play-back"
        label={t('player.previousChunk')}
        palette={colors}
        onPress={() => void skipAudio('backward')}
      />

      <Pressable
        onPress={() => void toggleAudio()}
        accessibilityRole="button"
        accessibilityLabel={phase === 'playing' ? t('narration.pause') : t('narration.play')}
        style={({ pressed }) => [
          styles.play,
          { backgroundColor: colors.link, borderColor: colors.link },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons
          name={phase === 'playing' ? 'pause' : 'play'}
          size={24}
          color={colors.background}
          style={phase !== 'playing' ? styles.playIcon : undefined}
        />
      </Pressable>

      <Control
        icon="play-forward"
        label={t('player.nextChunk')}
        palette={colors}
        onPress={() => void skipAudio('forward')}
      />
      <Control
        icon="play-skip-forward"
        label={t('reader.nextChapter')}
        palette={colors}
        onPress={() => void changeAudioChapter(1)}
      />
    </View>
  );
}

function Control({
  icon,
  label,
  palette,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  palette: ReaderPalette;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress ?? noop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.control, pressed && { backgroundColor: palette.surface }]}
    >
      <Ionicons name={icon} size={21} color={palette.text} />
    </Pressable>
  );
}

function noop(): void {}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    left: 0,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
  control: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  play: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  playIcon: { marginLeft: 2 },
});
