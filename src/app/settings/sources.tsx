import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';

export default function SourcesSettingsScreen() {
  return (
    <Screen>
      <AppBar title={t('settings.sources')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('settings.sources')}>
          <Row
            label={t('settings.extensions')}
            description={t('settings.extensionsDescription')}
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
