import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch } from 'react-native';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clearSynthCache, synthCacheBytes } from '@/narration/synth-store';
import { clearCaches } from '@/services/cache';
import { useSettingsStore } from '@/stores/settings';
import { useBackToParent } from '@/navigation/use-parent-back';
import { formatBytes } from '@/utils/format';

export default function StorageSettingsScreen() {
  const backToParent = useBackToParent();
  const theme = useTheme();
  const settings = useSettingsStore((state) => state.settings);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const [narrationBytes, setNarrationBytes] = useState<number | null>(null);

  const loadSizes = useCallback(() => {
    void synthCacheBytes()
      .then(setNarrationBytes)
      .catch(() => setNarrationBytes(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSizes();
    }, [loadSizes]),
  );

  const confirmClearCache = () => {
    Alert.alert(t('settings.clearCacheTitle'), t('settings.clearCacheMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.clear'),
        style: 'destructive',
        onPress: () => {
          void clearCaches().then(loadSizes);
        },
      },
    ]);
  };

  const confirmClearNarration = () => {
    Alert.alert(t('settings.clearNarrationCacheTitle'), t('settings.clearNarrationCacheMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.clear'),
        style: 'destructive',
        onPress: () => {
          void clearSynthCache().then(loadSizes);
        },
      },
    ]);
  };

  return (
    <Screen>
      <AppBar
        title={t('settings.storage')}
        onBack={() => backToParent({ pathname: '/settings' })}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('settings.storage')}>
          <Row
            label={t('settings.cacheListings')}
            description={t('settings.cacheListingsDescription')}
            right={
              <Switch
                value={settings.cacheLists}
                onValueChange={(value) => void setSetting('cacheLists', value)}
                trackColor={{ true: theme.primary, false: theme.border }}
              />
            }
          />
          <Row
            label={t('settings.clearCache')}
            description={t('settings.clearCacheDescription')}
            right={
              <Button variant="secondary" title={t('common.clear')} onPress={confirmClearCache} />
            }
          />
          <Row
            label={t('settings.narrationCache')}
            description={t('settings.narrationCacheDescription', {
              size: formatBytes(narrationBytes),
            })}
            right={
              <Button
                variant="secondary"
                title={t('common.clear')}
                onPress={confirmClearNarration}
              />
            }
          />
          <Row
            label={t('settings.downloads')}
            description={t('settings.downloadsDescription')}
            right={
              <Button
                variant="secondary"
                title={t('common.manage')}
                onPress={() => router.push('/downloads')}
              />
            }
          />
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
});
