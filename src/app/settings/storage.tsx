import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Switch } from 'react-native';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clearCaches } from '@/services/cache';
import { useSettingsStore } from '@/stores/settings';
import { useBackToParent } from '@/navigation/use-parent-back';

export default function StorageSettingsScreen() {
  const backToParent = useBackToParent();
  const theme = useTheme();
  const settings = useSettingsStore((state) => state.settings);
  const setSetting = useSettingsStore((state) => state.setSetting);

  const confirmClearCache = () => {
    Alert.alert(t('settings.clearCacheTitle'), t('settings.clearCacheMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.clear'), style: 'destructive', onPress: () => void clearCaches() },
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
