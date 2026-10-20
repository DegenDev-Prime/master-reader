import { ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settings';
import type { ThemePreference } from '@/theme';
import { useBackToParent } from '@/navigation/use-parent-back';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: t('settings.theme.system') },
  { value: 'light', label: t('settings.theme.light') },
  { value: 'dark', label: t('settings.theme.dark') },
  { value: 'amoled', label: t('settings.theme.amoled') },
];

export default function AppearanceSettingsScreen() {
  const backToParent = useBackToParent();
  const settings = useSettingsStore((state) => state.settings);
  const setSetting = useSettingsStore((state) => state.setSetting);

  return (
    <Screen>
      <AppBar
        title={t('settings.appearance')}
        onBack={() => backToParent({ pathname: '/settings' })}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('settings.appearance')}>
          <View style={styles.chips}>
            {THEMES.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={settings.theme === option.value}
                onPress={() => void setSetting('theme', option.value)}
              />
            ))}
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
