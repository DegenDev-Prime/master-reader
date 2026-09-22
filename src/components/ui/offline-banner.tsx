import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/stores/settings';

export function OfflineBanner() {
  const theme = useTheme();
  const offline = useSettingsStore((state) => state.settings.offlineMode);

  if (!offline) return null;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {t('offline.banner')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
