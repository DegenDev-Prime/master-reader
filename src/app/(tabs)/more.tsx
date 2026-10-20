import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { NavRow } from '@/components/ui/nav-row';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Section } from '@/components/ui/section';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function MoreScreen() {
  return (
    <Screen>
      <ScreenHeader title={t('more.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('more.reading')}>
          <NavRow
            icon="time-outline"
            label={t('more.history')}
            description={t('more.historyDescription')}
            onPress={() => router.push('/history')}
          />
          <NavRow
            icon="cloud-download-outline"
            label={t('more.downloads')}
            description={t('more.downloadsDescription')}
            onPress={() => router.push('/downloads')}
            last
          />
        </Section>

        <Section title={t('more.app')}>
          <NavRow
            icon="globe-outline"
            label={t('more.sources')}
            description={t('more.sourcesDescription')}
            onPress={() => router.push('/sources')}
          />
          <NavRow
            icon="settings-outline"
            label={t('more.settings')}
            description={t('more.settingsDescription')}
            onPress={() => router.push('/settings')}
          />
          <NavRow
            icon="information-circle-outline"
            label={t('more.about')}
            onPress={() => router.push('/settings/about')}
            last
          />
        </Section>

        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textMuted">
            {t('more.footer')}
          </ThemedText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  footer: { paddingHorizontal: Spacing.one, paddingTop: Spacing.two },
});
