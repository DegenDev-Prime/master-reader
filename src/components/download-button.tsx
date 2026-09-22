import { Alert } from 'react-native';

import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import type { Story } from '@/models/story';
import { useDownloadsStore } from '@/stores/downloads';

export function DownloadButton({ story }: { story: Story }) {
  const status = useDownloadsStore((state) => state.statusOf(story.sourceId, story.id));
  const enqueue = useDownloadsStore((state) => state.enqueue);
  const remove = useDownloadsStore((state) => state.remove);
  const retry = useDownloadsStore((state) => state.retry);

  const confirmDelete = () => {
    Alert.alert(t('story.removeDownloadTitle'), t('story.removeDownloadMessage'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void remove(story.sourceId, story.id),
      },
    ]);
  };

  if (status?.status === 'completed') {
    return (
      <Button
        variant="secondary"
        title={t('download.downloaded')}
        icon="checkmark-circle"
        onPress={confirmDelete}
      />
    );
  }

  if (status?.status === 'downloading' || status?.status === 'queued') {
    return <Button variant="secondary" title={t('download.downloading')} loading disabled />;
  }

  if (status?.status === 'failed') {
    return (
      <Button
        variant="secondary"
        title={t('download.retry')}
        icon="refresh"
        onPress={() => void retry(story.sourceId, story.id)}
      />
    );
  }

  return (
    <Button
      variant="secondary"
      title={t('download.button')}
      icon="download-outline"
      onPress={() => void enqueue(story)}
    />
  );
}
