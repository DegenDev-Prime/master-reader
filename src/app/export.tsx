import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { File, Paths } from 'expo-file-system';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingView } from '@/components/ui/loading';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import type { Story } from '@/models/story';
import {
  downloadsRepository,
  pagesRepository,
  progressRepository,
  storiesRepository,
} from '@/db/repositories';
import { buildEpub } from '@/services/epub';
import { useBackToParent } from '@/navigation/use-parent-back';

type ExportCandidate = {
  key: string;
  story: Story | null;
  chapterCount: number | null;
};

/**
 * FLOSS alternative to Arc's Pro export: bundles whatever is cached or
 * downloaded into a plain EPUB and hands it to the system share sheet.
 * Story-detail actions belong to Agent A's screen; this landing replaces the
 * per-story gate with a dated list of recent reading.
 */
export default function ExportScreen() {
  const backToParent = useBackToParent();
  const [candidates, setCandidates] = useState<ExportCandidate[] | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [failed, setFailed] = useState<ExportCandidate | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [completed, progress] = await Promise.all([
          downloadsRepository.listByStatus('completed'),
          progressRepository.listAll(),
        ]);

        const ordered: { sourceId: string; storyId: string }[] = [
          ...completed.map((download) => ({
            sourceId: download.sourceId,
            storyId: download.storyId,
          })),
          ...[...progress]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((item) => ({ sourceId: item.sourceId, storyId: item.storyId })),
        ];

        const seen = new Set<string>();
        const keys: { sourceId: string; storyId: string }[] = [];
        for (const entry of ordered) {
          const key = `${entry.sourceId}:${entry.storyId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          keys.push(entry);
          if (keys.length >= 30) break;
        }

        const rows: ExportCandidate[] = [];
        for (const entry of keys) {
          const story = await storiesRepository
            .get(entry.sourceId, entry.storyId)
            .catch(() => null);
          const download = completed.find(
            (item) => item.sourceId === entry.sourceId && item.storyId === entry.storyId,
          );
          const saved = progress.find(
            (item) => item.sourceId === entry.sourceId && item.storyId === entry.storyId,
          );
          const pageCount = download?.totalPages ?? saved?.pageCount ?? null;
          rows.push({
            key: `${entry.sourceId}:${entry.storyId}`,
            story,
            chapterCount: pageCount,
          });
        }
        if (!cancelled) setCandidates(rows);
      } catch {
        if (!cancelled) setCandidates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const exportStory = useCallback((candidate: ExportCandidate) => {
    const story = candidate.story;
    if (!story) return;
    setLoadingKey(candidate.key);
    setFailed(null);
    void (async () => {
      try {
        const pages = await pagesRepository.listForStory(story.sourceId, story.id);
        const bytes = await buildEpub(story, pages);
        const file = new File(Paths.cache, `${story.sourceId}-${story.id}.epub`);
        if (file.exists) file.delete();
        file.create();
        file.write(bytes);

        let shared = false;
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/epub+zip',
            dialogTitle: t('export.epub'),
          });
          shared = true;
        }
        if (shared) Alert.alert(t('export.title'), t('export.shared'));
      } catch (error) {
        console.warn('EPUB export failed', error);
        setFailed({ key: candidate.key, story, chapterCount: null });
      } finally {
        setLoadingKey(null);
      }
    })();
  }, []);

  const emptyState = (
    <EmptyState
      icon="share-outline"
      title={t('export.title')}
      message={t('export.epubDescription')}
    />
  );

  return (
    <Screen>
      <AppBar
        title={t('export.title')}
        onBack={() => backToParent({ pathname: '/settings/backup' })}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('export.epub')} description={t('export.epubDescription')}>
          {failed ? (
            <ErrorState
              message={t('export.failed')}
              onRetry={() => {
                const retry = failed;
                setFailed(null);
                exportStory(retry);
              }}
            />
          ) : candidates === null ? (
            <LoadingView label={t('common.loading')} />
          ) : candidates.length === 0 ? (
            emptyState
          ) : (
            candidates.map((candidate) => (
              <Row
                key={candidate.key}
                label={candidate.story?.title ?? candidate.key}
                description={
                  candidate.chapterCount
                    ? t('downloads.chapters', { count: candidate.chapterCount })
                    : undefined
                }
                right={
                  <Button
                    variant="secondary"
                    icon={loadingKey === candidate.key ? undefined : 'share-outline'}
                    title={loadingKey === candidate.key ? t('export.building') : t('export.epub')}
                    loading={loadingKey === candidate.key}
                    accessibilityLabel={`${t('export.epub')} · ${candidate.story?.title ?? candidate.key}`}
                    onPress={() => exportStory(candidate)}
                    disabled={!candidate.story}
                  />
                }
              />
            ))
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
});
