import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.content}>
        <View style={styles.heading}>
          <View style={[styles.badge, { borderColor: theme.primary }]}>
            <ThemedText type="heading" style={{ color: theme.primary }}>
              18+
            </ThemedText>
          </View>
          <ThemedText type="heading">{t('ageGate.title')}</ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          {t('ageGate.body')}
        </ThemedText>

        <View style={styles.actions}>
          <Button title={t('ageGate.confirm')} onPress={onConfirm} />
          {Platform.OS === 'android' ? (
            <Button
              variant="ghost"
              title={t('ageGate.deny')}
              onPress={() => BackHandler.exitApp()}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  heading: { gap: Spacing.three, alignItems: 'flex-start' },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  body: { lineHeight: 22 },
  actions: { gap: Spacing.two, paddingTop: Spacing.two },
});
