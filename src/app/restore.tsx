import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { Row, Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import { importBackupFromFile, pickBackupFile, type RestoreMode } from '@/services/backup';

const MODES: { value: RestoreMode; label: string; description: string }[] = [
  { value: 'merge', label: t('restore.merge'), description: t('restore.mergeDescription') },
  {
    value: 'replace',
    label: t('restore.replace'),
    description: t('restore.replaceDescription'),
  },
  {
    value: 'skip',
    label: t('restore.skip'),
    description: t('restore.skipDescription'),
  },
];

export default function RestoreScreen() {
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [busy, setBusy] = useState(false);

  const selected = MODES.find((option) => option.value === mode) ?? MODES[0];

  const run = async () => {
    setBusy(true);
    try {
      const uri = await pickBackupFile();
      if (!uri) return;

      const counts = await importBackupFromFile(uri, mode);
      Alert.alert(
        t('restore.completeTitle'),
        t('restore.completeMessage', { imported: counts.imported, skipped: counts.skipped }),
      );
    } catch (error) {
      Alert.alert(t('restore.failedTitle'), error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppBar title={t('restore.title')} onBack={() => router.back()} />
      <View style={styles.content}>
        <Section title={t('restore.mode')}>
          <View style={styles.chips}>
            {MODES.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={mode === option.value}
                onPress={() => setMode(option.value)}
              />
            ))}
          </View>
          <Row label={selected.label} description={selected.description} />
        </Section>

        <Button
          title={t('restore.choose')}
          icon="document-outline"
          loading={busy}
          onPress={() => void run()}
        />

        <ThemedText type="small" themeColor="textSecondary">
          {t('restore.description')}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
