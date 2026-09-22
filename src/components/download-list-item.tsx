import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Download } from '@/models/story';
import type { DownloadItem } from '@/services/downloads';
import { formatBytes } from '@/utils/format';

export function downloadStatusLabel(download: Download): string {
  switch (download.status) {
    case 'queued':
      return t('download.queued');
    case 'downloading':
      return t('download.downloading');
    case 'paused':
      return t('download.paused');
    case 'completed':
      return t('download.completed', {
        size: formatBytes(download.sizeBytes),
        pages: download.totalPages ? t('download.pages', { count: download.totalPages }) : '',
      });
    case 'failed':
      return download.error
        ? t('download.failedWith', { error: download.error })
        : t('download.failed');
  }
}

export type DownloadListItemProps = {
  item: DownloadItem;
  onOpen?: () => void;
  onRetry: () => void;
  onDelete: () => void;
};

export function DownloadListItem({ item, onOpen, onRetry, onDelete }: DownloadListItemProps) {
  const theme = useTheme();
  const { download, story } = item;
  const isRetryable = download.status === 'failed';

  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <ThemedText type="default" numberOfLines={2} onPress={onOpen} style={styles.title}>
          {story?.title ?? download.storyId}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {downloadStatusLabel(download)}
        </ThemedText>
        {story?.authorName ? (
          <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
            {story.authorName}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.actions}>
        {isRetryable ? (
          <IconButton
            icon="refresh"
            label={t('download.retry')}
            onPress={onRetry}
            color={theme.primary}
          />
        ) : null}
        <IconButton
          icon="trash-outline"
          label={t('download.delete')}
          onPress={onDelete}
          color={theme.danger}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  body: { flex: 1, gap: Spacing.half },
  title: { fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
