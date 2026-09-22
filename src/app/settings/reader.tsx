import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { AppBar } from '@/components/ui/app-bar';
import { Chip } from '@/components/ui/chip';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Stepper } from '@/components/ui/stepper';
import { Spacing } from '@/constants/theme';
import type { ReaderFontFamily, ReaderPagination, ReaderSettings, ReaderThemeName } from '@/services/settings';
import { useSettingsStore } from '@/stores/settings';

const READER_THEMES: { value: ReaderThemeName; label: string }[] = [
  { value: 'light', label: t('settings.readerTheme.light') },
  { value: 'sepia', label: t('settings.readerTheme.sepia') },
  { value: 'dark', label: t('settings.readerTheme.dark') },
  { value: 'black', label: t('settings.readerTheme.black') },
];

const READER_FONTS: { value: ReaderFontFamily; label: string }[] = [
  { value: 'system', label: t('settings.font.system') },
  { value: 'serif', label: t('settings.font.serif') },
  { value: 'opendyslexic', label: t('settings.font.opendyslexic') },
];

const ALIGNMENTS: { value: ReaderSettings['textAlign']; label: string }[] = [
  { value: 'left', label: t('settings.alignment.left') },
  { value: 'justify', label: t('settings.alignment.justify') },
];

const PAGINATION: { value: ReaderPagination; label: string }[] = [
  { value: 'horizontal', label: t('settings.paginationStyle.horizontal') },
  { value: 'vertical', label: t('settings.paginationStyle.vertical') },
];

export default function ReaderSettingsScreen() {
  const settings = useSettingsStore((state) => state.settings);
  const setSetting = useSettingsStore((state) => state.setSetting);

  const updateReader = (patch: Partial<ReaderSettings>) => {
    void setSetting('reader', { ...settings.reader, ...patch });
  };

  return (
    <Screen>
      <AppBar title={t('settings.reader')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('settings.readerTheme.light') + ' / ' + t('settings.readerTheme.dark')}>
          <View style={styles.chips}>
            {READER_THEMES.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={settings.reader.theme === option.value}
                onPress={() => updateReader({ theme: option.value })}
              />
            ))}
          </View>
          <View style={styles.chips}>
            {READER_FONTS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={settings.reader.fontFamily === option.value}
                onPress={() => updateReader({ fontFamily: option.value })}
              />
            ))}
          </View>
          <Row
            label={t('settings.fontSize')}
            right={
              <Stepper
                value={settings.reader.fontSize}
                onDecrease={() =>
                  updateReader({ fontSize: Math.max(12, settings.reader.fontSize - 1) })
                }
                onIncrease={() =>
                  updateReader({ fontSize: Math.min(32, settings.reader.fontSize + 1) })
                }
              />
            }
          />
          <Row
            label={t('settings.lineHeight')}
            right={
              <Stepper
                value={settings.reader.lineHeight}
                step={0.1}
                onDecrease={() =>
                  updateReader({
                    lineHeight: Math.max(1.2, Math.round((settings.reader.lineHeight - 0.1) * 10) / 10),
                  })
                }
                onIncrease={() =>
                  updateReader({
                    lineHeight: Math.min(2.4, Math.round((settings.reader.lineHeight + 0.1) * 10) / 10),
                  })
                }
              />
            }
          />
          <View style={styles.chips}>
            {ALIGNMENTS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={settings.reader.textAlign === option.value}
                onPress={() => updateReader({ textAlign: option.value })}
              />
            ))}
          </View>
          <Row
            label={t('settings.pagination')}
            right={
              <View style={styles.chipsInline}>
                {PAGINATION.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={settings.reader.pagination === option.value}
                    onPress={() => updateReader({ pagination: option.value })}
                  />
                ))}
              </View>
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
  chipsInline: { flexDirection: 'row', gap: Spacing.two },
});
