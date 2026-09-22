import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Row, Section } from '@/components/ui/section';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { useExtensionsStore } from '@/stores/extensions';

export default function SourcesScreen() {
  const theme = useTheme();
  const records = useExtensionsStore((state) => state.records);
  const isBusy = useExtensionsStore((state) => state.isBusy);
  const installFromUrl = useExtensionsStore((state) => state.installFromUrl);
  const installFromCode = useExtensionsStore((state) => state.installFromCode);
  const remove = useExtensionsStore((state) => state.remove);
  const setEnabled = useExtensionsStore((state) => state.setEnabled);

  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');

  const runInstall = async (task: () => Promise<void>, success: string) => {
    try {
      await task();
      Alert.alert(t('extensions.title'), success);
    } catch (error) {
      Alert.alert(
        t('extensions.installFailed'),
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const confirmRemove = (id: string, name: string) => {
    Alert.alert(t('extensions.removeTitle'), t('extensions.removeMessage', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: () => void remove(id) },
    ]);
  };

  return (
    <Screen>
      <AppBar title={t('extensions.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('extensions.add')}>
          <View style={styles.field}>
            <TextField
              icon="link"
              placeholder={t('extensions.urlPlaceholder')}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
          <Row
            label={t('extensions.installFromUrl')}
            description={t('extensions.installFromUrlDescription')}
            right={
              <Button
                variant="secondary"
                title={t('common.install')}
                loading={isBusy}
                onPress={() =>
                  void runInstall(async () => {
                    await installFromUrl(url.trim());
                    setUrl('');
                  }, t('extensions.installedMessage'))
                }
              />
            }
          />
          <View style={styles.field}>
            <TextField
              placeholder={t('extensions.codePlaceholder')}
              value={code}
              onChangeText={setCode}
              multiline
              numberOfLines={6}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Row
            label={t('extensions.installFromCode')}
            right={
              <Button
                variant="secondary"
                title={t('common.install')}
                loading={isBusy}
                onPress={() =>
                  void runInstall(async () => {
                    await installFromCode(code);
                    setCode('');
                  }, t('extensions.installedMessage'))
                }
              />
            }
          />
        </Section>

        <Section title={t('extensions.installed')}>
          {records.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('extensions.empty')}
              </ThemedText>
            </View>
          ) : (
            records.map((record) => (
              <Row
                key={record.id}
                label={record.manifest.name}
                description={`${t('extensions.version')} ${record.manifest.version} · ${record.id}`}
                right={
                  <View style={styles.actions}>
                    <Switch
                      value={record.enabled}
                      onValueChange={(value) => void setEnabled(record.id, value)}
                      trackColor={{ true: theme.primary, false: theme.border }}
                    />
                    <Button
                      variant="ghost"
                      title={t('common.remove')}
                      onPress={() => confirmRemove(record.id, record.manifest.name)}
                    />
                  </View>
                }
              />
            ))
          )}
        </Section>

        <ThemedText type="small" themeColor="textSecondary">
          {t('extensions.disclaimer')}
        </ThemedText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  field: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  empty: { padding: Spacing.three },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
