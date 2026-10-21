import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { formatDuration, playerTiming } from '@/narration/player-estimates';
import { narrationChunks, useNarrationStore } from '@/stores/narration';

export type PlaybackClockProps = {
  chunkIndex: number;
  chunkCount: number;
  speed: number;
};

/**
 * The time and the progress bar of the player.
 *
 * The clock is a component of its own on purpose: it subscribes to the time
 * the store keeps, so it re-renders on its own while the voice speaks. In the
 * screen itself the same value would be folded into a memoized subtree and
 * the clock would sit still.
 */
export const PlaybackClock = memo(function PlaybackClock({
  chunkIndex,
  chunkCount,
  speed,
}: PlaybackClockProps) {
  'use no memo';
  const theme = useTheme();
  const now = useNarrationStore((state) => state.now);
  const positionAt = useNarrationStore((state) => state.positionAt);
  const elapsedMsAt = useNarrationStore((state) => state.elapsedMsAt);

  const timing = playerTiming(
    narrationChunks().slice(0, chunkCount),
    chunkIndex,
    speed,
    positionAt(now),
    elapsedMsAt(now),
  );

  return (
    <View style={styles.block}>
      <View style={styles.labels}>
        <ThemedText type="small" themeColor="textMuted">
          {t('player.partOf', {
            current: chunkIndex + 1,
            total: Math.max(chunkCount, 1),
          })}
        </ThemedText>
        {timing.totalMs > 0 ? (
          <ThemedText
            // The clock changes every second. A changing key makes sure the
            // text is replaced even when the tree around it is memoized.
            key={timing.elapsedMs}
            type="small"
            themeColor="textMuted"
          >
            {`${formatDuration(timing.elapsedMs)} / ${formatDuration(timing.totalMs)}`}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: theme.primary, width: `${timing.fraction * 100}%` },
          ]}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  block: { gap: Spacing.two },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 2, overflow: 'hidden' },
  fill: { height: 2 },
});
