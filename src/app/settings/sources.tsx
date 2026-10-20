import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { OptionGroup } from '@/components/ui/option-group';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { listSourceInfos } from '@/services/source-manager';
import { useSettingsStore } from '@/stores/settings';
import { useBackToParent } from '@/navigation/use-parent-back';

export default function SourcesSettingsScreen() {
  const backToParent = useBackToParent();
  const activeSourceId = useSettingsStore((store) => store.settings.activeSourceId);
  const setSetting = useSettingsStore((store) => store.setSetting);
  const providers = listSourceInfos();

  return (
    <Screen>
      <AppBar
        title={t('settings.sources')}
        onBack={() => backToParent({ pathname: '/settings' })}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Section
          title={t('settings.defaultSource')}
          description={t('settings.defaultSourceDescription')}
        >
          <OptionGroup
            label={t('settings.defaultSource')}
            options={providers.map((provider) => ({
              value: provider.id,
              label: provider.name,
            }))}
            value={activeSourceId}
            onChange={(id) => void setSetting('activeSourceId', id)}
          />
        </Section>

        <Section title={t('settings.sources')}>
          <Row
            label={t('settings.manageSources')}
            description={t('settings.manageSourcesDescription')}
            right={
              <Button
                variant="secondary"
                title={t('common.manage')}
                onPress={() => router.push('/sources')}
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
