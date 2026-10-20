import Constants from 'expo-constants';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/stores/settings';
import { useBackToParent } from '@/navigation/use-parent-back';

export default function AboutSettingsScreen() {
  const backToParent = useBackToParent();
  const theme = useTheme();
  const reset = useSettingsStore((state) => state.reset);

  return (
    <Screen>
      <AppBar title={t('settings.about')} onBack={() => backToParent({ pathname: '/settings' })} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('settings.about')}>
          <Row
            label={t('settings.version')}
            right={
              <ThemedText type="small" themeColor="textSecondary">
                {Constants.expoConfig?.version ?? '0.0.0'}
              </ThemedText>
            }
          />
          <View style={styles.about}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('settings.disclaimer')}
            </ThemedText>
          </View>
        </Section>

        <Pressable style={styles.reset} onPress={() => void reset()}>
          <ThemedText type="smallBold" style={{ color: theme.danger }}>
            {t('settings.reset')}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  about: { padding: Spacing.three },
  reset: { alignItems: 'center', paddingVertical: Spacing.three },
});
