import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import type { ReaderFontFamily, ReaderSettings, ReaderThemeName } from '@/services/settings';
import { readerFontFamilies, type ReaderPalette } from '@/theme/reader';

type Props = {
  visible: boolean;
  reader: ReaderSettings;
  palette: ReaderPalette;
  onChange: (reader: ReaderSettings) => void;
  onClose: () => void;
};

const THEMES: ReaderThemeName[] = ['light', 'sepia', 'dark', 'black'];
const FONTS: { value: ReaderFontFamily; label: string }[] = [
  { value: 'serif', label: 'reader.fontSerif' },
  { value: 'system', label: 'reader.fontSans' },
  { value: 'opendyslexic', label: 'reader.fontDyslexic' },
];

export function DisplaySheet({ visible, reader, palette, onChange, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const previewWidth = Math.min(width - 48, 560);

  const update = (patch: Partial<ReaderSettings>) => onChange({ ...reader, ...patch });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: palette.background }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={styles.handleRow}>
            <Text style={[styles.title, { color: palette.text }]}>{t('reader.display')}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={24} color={palette.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Section label={t('reader.themeLabel')} color={palette.muted}>
              <View style={styles.row}>
                {THEMES.map((theme) => (
                  <Choice
                    key={theme}
                    label={t(`reader.theme${theme[0].toUpperCase()}${theme.slice(1)}`)}
                    selected={reader.theme === theme}
                    palette={palette}
                    onPress={() => update({ theme })}
                    swatch={theme}
                  />
                ))}
              </View>
            </Section>

            <Section label={t('reader.size')} color={palette.muted}>
              <Stepper
                value={String(reader.fontSize)}
                palette={palette}
                onDecrease={() => update({ fontSize: Math.max(14, reader.fontSize - 1) })}
                onIncrease={() => update({ fontSize: Math.min(32, reader.fontSize + 1) })}
                decreaseLabel={t('reader.decreaseFontSize')}
                increaseLabel={t('reader.increaseFontSize')}
              />
            </Section>

            <Section label={t('reader.font')} color={palette.muted}>
              <View style={styles.row}>
                {FONTS.map((font) => (
                  <Choice
                    key={font.value}
                    label={t(font.label)}
                    selected={reader.fontFamily === font.value}
                    palette={palette}
                    onPress={() => update({ fontFamily: font.value })}
                    fontFamily={readerFontFamilies[font.value]}
                  />
                ))}
              </View>
            </Section>

            <Section label={t('reader.lineHeight')} color={palette.muted}>
              <Stepper
                value={reader.lineHeight.toFixed(1)}
                palette={palette}
                onDecrease={() =>
                  update({
                    lineHeight: Math.max(1.2, Math.round((reader.lineHeight - 0.1) * 10) / 10),
                  })
                }
                onIncrease={() =>
                  update({
                    lineHeight: Math.min(2, Math.round((reader.lineHeight + 0.1) * 10) / 10),
                  })
                }
                decreaseLabel={t('reader.decreaseLineHeight')}
                increaseLabel={t('reader.increaseLineHeight')}
              />
            </Section>

            <Section label={t('reader.marginLabel')} color={palette.muted}>
              <Stepper
                value={String(reader.marginHorizontal)}
                palette={palette}
                onDecrease={() =>
                  update({
                    marginHorizontal: Math.max(8, reader.marginHorizontal - 4),
                  })
                }
                onIncrease={() =>
                  update({
                    marginHorizontal: Math.min(40, reader.marginHorizontal + 4),
                  })
                }
                decreaseLabel={t('reader.decreaseMargin')}
                increaseLabel={t('reader.increaseMargin')}
              />
            </Section>

            <Section label={t('reader.alignLabel')} color={palette.muted}>
              <View style={styles.row}>
                <Choice
                  label={t('reader.alignLeft')}
                  selected={reader.textAlign === 'left'}
                  palette={palette}
                  onPress={() => update({ textAlign: 'left' })}
                />
                <Choice
                  label={t('reader.alignJustify')}
                  selected={reader.textAlign === 'justify'}
                  palette={palette}
                  onPress={() => update({ textAlign: 'justify' })}
                />
              </View>
            </Section>

            <View
              style={[
                styles.preview,
                {
                  borderColor: palette.border,
                  maxWidth: previewWidth,
                  paddingHorizontal: Math.min(reader.marginHorizontal, 24),
                },
              ]}
            >
              <Text style={[styles.previewEyebrow, { color: palette.muted }]}>
                {t('reader.preview').toUpperCase()}
              </Text>
              <Text
                style={{
                  color: palette.text,
                  fontFamily: readerFontFamilies[reader.fontFamily],
                  fontSize: reader.fontSize,
                  lineHeight: Math.round(reader.fontSize * reader.lineHeight),
                  textAlign: reader.textAlign,
                }}
              >
                {t('reader.previewText')}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Section({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Choice({
  label,
  selected,
  palette,
  onPress,
  fontFamily,
  swatch,
}: {
  label: string;
  selected: boolean;
  palette: ReaderPalette;
  onPress: () => void;
  fontFamily?: string;
  swatch?: ReaderThemeName;
}) {
  const swatchColor =
    swatch === 'light'
      ? '#FFFFFF'
      : swatch === 'sepia'
        ? '#F4ECD8'
        : swatch === 'dark'
          ? '#14161A'
          : '#000000';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? palette.link : 'transparent',
          borderColor: selected ? palette.link : palette.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {swatch ? (
        <View
          style={[styles.swatch, { backgroundColor: swatchColor, borderColor: palette.border }]}
        />
      ) : null}
      <Text
        style={{
          color: selected ? palette.background : palette.text,
          fontFamily,
          fontSize: 14,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Stepper({
  value,
  palette,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
}: {
  value: string;
  palette: ReaderPalette;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  return (
    <View style={[styles.stepper, { borderColor: palette.border }]}>
      <Pressable
        onPress={onDecrease}
        accessibilityRole="button"
        accessibilityLabel={decreaseLabel}
        style={({ pressed }) => [styles.stepButton, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="remove" size={22} color={palette.text} />
      </Pressable>
      <Text style={[styles.stepValue, { color: palette.text }]}>{value}</Text>
      <Pressable
        onPress={onIncrease}
        accessibilityRole="button"
        accessibilityLabel={increaseLabel}
        style={({ pressed }) => [styles.stepButton, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="add" size={22} color={palette.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { bottom: 0, left: 0, opacity: 0.45, position: 'absolute', right: 0, top: 0 },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '88%',
    paddingTop: 8,
  },
  handleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  title: { fontSize: 20, fontWeight: '700' },
  close: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  body: { gap: 22, padding: 20, paddingBottom: 24 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  swatch: {
    borderWidth: StyleSheet.hairlineWidth,
    height: 14,
    width: 14,
  },
  stepper: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  stepButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 56,
  },
  stepValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'center',
  },
  preview: {
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingVertical: 16,
    width: '100%',
  },
  previewEyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.1 },
});
