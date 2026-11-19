import { StyleSheet, View } from 'react-native';

import { AudioNavbar } from '@/components/reader/audio-navbar';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { useAudioStore } from '@/stores/audio';

export default function AudioScreen() {
  const title = useAudioStore((state) => state.title);
  const chapterLabel = useAudioStore((state) => state.chapterLabel);
  const error = useAudioStore((state) => state.error);

  return (
    <Screen>
      <ScreenHeader title={t('tabs.audio')} />
      <View style={styles.body}>
        {title ? (
          <View style={styles.nowPlaying}>
            <ThemedText type="eyebrow">{t('player.nowListening')}</ThemedText>
            <ThemedText type="title2" numberOfLines={2}>
              {title}
            </ThemedText>
            {chapterLabel ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {chapterLabel}
              </ThemedText>
            ) : null}
            {error ? (
              <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
                {error}
              </ThemedText>
            ) : null}
          </View>
        ) : (
          <EmptyState
            icon="headset-outline"
            title={t('audio.emptyTitle')}
            message={t('audio.emptyMessage')}
          />
        )}
      </View>
      <AudioNavbar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingBottom: 80 },
  nowPlaying: { gap: Spacing.one, padding: Spacing.three },
});
