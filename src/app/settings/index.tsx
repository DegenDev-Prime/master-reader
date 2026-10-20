import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useBackToParent } from '@/navigation/use-parent-back';

const SECTIONS = [
  { key: 'appearance', label: t('settings.appearance'), path: '/settings/appearance' },
  { key: 'reader', label: t('settings.reader'), path: '/settings/reader' },
  { key: 'advanced', label: t('settings.advanced'), path: '/settings/advanced' },
  { key: 'sources', label: t('settings.sources'), path: '/settings/sources' },
  { key: 'narration', label: t('settings.narration'), path: '/settings/narration' },
  { key: 'pronunciation', label: t('settings.pronunciation'), path: '/pronunciation' },
  { key: 'storage', label: t('settings.storage'), path: '/settings/storage' },
  { key: 'backup', label: t('settings.backup'), path: '/settings/backup' },
  { key: 'export', label: t('settings.exportStories'), path: '/export' },
  { key: 'about', label: t('settings.about'), path: '/settings/about' },
] as const;

export default function SettingsScreen() {
  const backToParent = useBackToParent();
  return (
    <Screen>
      <AppBar title={t('settings.title')} onBack={() => backToParent({ pathname: '/settings' })} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('settings.title')}>
          {SECTIONS.map((section) => (
            <Row
              key={section.key}
              label={section.label}
              right={
                <Button
                  variant="ghost"
                  title={t('common.open')}
                  onPress={() => router.push(section.path)}
                />
              }
            />
          ))}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
});
