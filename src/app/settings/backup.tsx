import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { t } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Stepper } from '@/components/ui/stepper';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { backupNow, exportBackupFile, exportLibraryCsv, pickBackupFolder } from '@/services/backup';
import type { BackupLevel, BackupSettings } from '@/services/settings';
import { useSettingsStore } from '@/stores/settings';

const LEVELS: { value: BackupLevel; label: string }[] = [
  { value: 'meta', label: t('settings.backupLevel.meta') },
  { value: 'stories', label: t('settings.backupLevel.stories') },
  { value: 'history', label: t('settings.backupLevel.history') },
  { value: 'downloads', label: t('settings.backupLevel.downloads') },
];

export default function BackupSettingsScreen() {
  const theme = useTheme();
  const settings = useSettingsStore((state) => state.settings);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const [isBusy, setIsBusy] = useState(false);

  const updateBackup = (patch: Partial<BackupSettings>) => {
    void setSetting('backup', { ...settings.backup, ...patch });
  };

  const toggleLevel = (level: BackupLevel) => {
    const current = settings.backup.levels;
    const next = current.includes(level)
      ? current.filter((item) => item !== level)
      : [...current, level];
    updateBackup({ levels: next.length > 0 ? next : ['meta'] });
  };

  const runTask = async (task: () => Promise<unknown>, success: string) => {
    setIsBusy(true);
    try {
      await task();
      Alert.alert(t('backup.doneTitle'), success);
    } catch (error) {
      Alert.alert(t('backup.failedTitle'), error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  };

  const chooseFolder = async () => {
    try {
      const uri = await pickBackupFolder();
      if (uri) updateBackup({ folderUri: uri });
    } catch (error) {
      Alert.alert(
        t('backup.folderErrorTitle'),
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const folderLabel = settings.backup.folderUri
    ? decodeURIComponent(settings.backup.folderUri.split('/').filter(Boolean).pop() ?? 'Folder')
    : t('common.notSet');

  return (
    <Screen>
      <AppBar title={t('settings.backup')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('settings.backupLevels')}>
          <View style={styles.hint}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('settings.backupLevelHint')}
            </ThemedText>
          </View>
          <View style={styles.chips}>
            {LEVELS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={settings.backup.levels.includes(option.value)}
                onPress={() => toggleLevel(option.value)}
              />
            ))}
          </View>
        </Section>

        <Section title={t('settings.backup')}>
          <Row
            label={t('settings.autoBackup')}
            description={t('settings.autoBackupDescription')}
            right={
              <Switch
                value={settings.backup.autoBackup}
                onValueChange={(value) => updateBackup({ autoBackup: value })}
                trackColor={{ true: theme.primary, false: theme.border }}
              />
            }
          />
          <Row
            label={t('settings.backupFolder')}
            description={folderLabel}
            right={
              <Button
                variant="secondary"
                title={t('common.choose')}
                onPress={() => void chooseFolder()}
              />
            }
          />
          <Row
            label={t('settings.intervalHours')}
            right={
              <Stepper
                value={settings.backup.intervalHours}
                onDecrease={() =>
                  updateBackup({ intervalHours: Math.max(1, settings.backup.intervalHours - 1) })
                }
                onIncrease={() =>
                  updateBackup({ intervalHours: Math.min(168, settings.backup.intervalHours + 1) })
                }
              />
            }
          />
          <Row
            label={t('settings.keepBackups')}
            right={
              <Stepper
                value={settings.backup.keepCount}
                onDecrease={() =>
                  updateBackup({ keepCount: Math.max(1, settings.backup.keepCount - 1) })
                }
                onIncrease={() =>
                  updateBackup({ keepCount: Math.min(20, settings.backup.keepCount + 1) })
                }
              />
            }
          />
          <Row
            label={t('settings.backupNow')}
            right={
              <Button
                variant="secondary"
                title={t('common.run')}
                loading={isBusy}
                onPress={() => void runTask(backupNow, t('backup.done'))}
              />
            }
          />
          <Row
            label={t('settings.exportBackup')}
            description={t('settings.exportBackupDescription')}
            right={
              <Button
                variant="secondary"
                title={t('common.export')}
                onPress={() => void runTask(exportBackupFile, t('backup.exported'))}
              />
            }
          />
          <Row
            label={t('settings.exportCsv')}
            right={
              <Button
                variant="secondary"
                title={t('common.export')}
                onPress={() => void runTask(exportLibraryCsv, t('backup.csvExported'))}
              />
            }
          />
          <Row
            label={t('settings.restore')}
            description={t('settings.restoreDescription')}
            right={
              <Button
                variant="secondary"
                title={t('common.restore')}
                onPress={() => router.push('/restore')}
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  hint: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
});
