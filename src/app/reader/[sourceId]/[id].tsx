import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { chapterRepository } from '@/db/repositories/chapters';
import { progressRepository } from '@/db/repositories/progress';
import { syncNovel } from '@/services/novel-catalog';
import { useSettingsStore } from '@/stores/settings';
import { readerPalettes } from '@/theme/reader';

/**
 * Compatibility route for links produced before chapter ids were part of the
 * reader path. Resolves the saved chapter (or the legacy page index) once and
 * replaces itself with the canonical reader route.
 */
export default function LegacyReaderRedirect() {
  const params = useLocalSearchParams<{
    sourceId?: string;
    id?: string;
    chapter?: string;
    page?: string;
  }>();
  const reader = useSettingsStore((state) => state.settings.reader);
  const palette = readerPalettes[reader.theme];
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function redirect() {
      const { sourceId, id, chapter, page } = params;
      if (!sourceId || !id) {
        setFailed(true);
        return;
      }

      try {
        let chapters = await chapterRepository.listMetadata(sourceId, id);
        if (chapters.length === 0) {
          chapters = (await syncNovel(sourceId, id)).chapters;
        }
        if (cancelled) return;

        const progress = await progressRepository.get(sourceId, id);
        const pageIndex = page != null ? Number(page) : NaN;
        const target =
          (chapter ? chapters.find((item) => item.id === chapter) : null) ??
          (Number.isFinite(pageIndex) ? chapters[pageIndex] : null) ??
          chapters.find((item) => item.id === progress?.chapterId) ??
          chapters[0];

        if (!target) {
          setFailed(true);
          return;
        }
        router.replace(`/reader/${sourceId}/${id}/${target.id}`);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void redirect();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      {failed ? (
        <>
          <Text style={[styles.title, { color: palette.text }]}>{t('reader.errorTitle')}</Text>
          <Text style={[styles.body, { color: palette.muted }]}>{t('reader.errorMessage')}</Text>
          <Text
            onPress={() => router.back()}
            style={[styles.link, { color: palette.link }]}
            accessibilityRole="button"
          >
            {t('common.back')}
          </Text>
        </>
      ) : (
        <ActivityIndicator size="large" color={palette.link} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    padding: 32,
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '600', marginTop: 8 },
});
