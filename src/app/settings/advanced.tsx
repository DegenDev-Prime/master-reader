import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch } from 'react-native';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { updateLibrary } from '@/services/library-updater';
import { useSettingsStore } from '@/stores/settings';
import { useBackToParent } from '@/navigation/use-parent-back';

export default function AdvancedSettingsScreen() {
  const backToParent = useBackToParent();
  const theme = useTheme();
  const settings = useSettingsStore((state) => state.settings);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const [isUpdateBusy, setIsUpdateBusy] = useState(false);

  const checkUpdates = async () => {
    setIsUpdateBusy(true);
    try {
      const result = await updateLibrary();
      Alert.alert(
        t('backup.updatesTitle'),
        t('backup.updatesResult', { checked: result.checked, updated: result.updated }),
      );
    } catch {
      Alert.alert(t('backup.updatesTitle'), t('backup.updatesFailed'));
    } finally {
      setIsUpdateBusy(false);
    }
  };

  return (
    <Screen>
      <AppBar
        title={t('settings.advanced')}
        onBack={() => backToParent({ pathname: '/settings' })}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('settings.advanced')}>
          <Row
            label={t('settings.offline')}
            description={t('settings.offlineDescription')}
            right={
              <Switch
                value={settings.offlineMode}
                onValueChange={(value) => void setSetting('offlineMode', value)}
                trackColor={{ true: theme.primary, false: theme.border }}
              />
            }
          />
          <Row
            label={t('settings.libraryUpdates')}
            description={t('settings.libraryUpdatesDescription')}
            right={
              <Switch
                value={settings.checkForLibraryUpdates}
                onValueChange={(value) => void setSetting('checkForLibraryUpdates', value)}
                trackColor={{ true: theme.primary, false: theme.border }}
              />
            }
          />
          <Row
            label={t('settings.checkNow')}
            right={
              <Button
                variant="secondary"
                title={t('common.run')}
                loading={isUpdateBusy}
                onPress={() => void checkUpdates()}
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
