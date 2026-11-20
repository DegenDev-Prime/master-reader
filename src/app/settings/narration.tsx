import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { OptionGroup } from '@/components/ui/option-group';
import { Row, Section } from '@/components/ui/section';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getSherpaTtsModule } from '@/narration/native/sherpa-tts';
import { getSystemTtsModule, systemTtsAvailable } from '@/narration/native/system-tts';
import { normalizeSystemVoices, type NormalizedSystemVoice } from '@/narration/system-voice-names';
import { voicePacksForEngine, type VoicePackDef } from '@/narration/voice-packs';
import {
  deleteVoicePack,
  installVoicePack,
  voicePackStatus,
  type PackDownloadProgress,
  type VoicePackStatus,
} from '@/narration/voice-pack-store';
import { useBackToParent } from '@/navigation/use-parent-back';
import type { NarrationEngineId } from '@/services/settings';
import { useSettingsStore } from '@/stores/settings';

const SPEEDS = ['0.75', '1', '1.25', '1.5', '2'];

type PackRow = { def: VoicePackDef; status: VoicePackStatus };

const ENGINES: { value: NarrationEngineId; label: string; description: string }[] = [
  {
    value: 'system',
    label: t('narration.engineSystem'),
    description: t('narration.engineSystemDescription'),
  },
  {
    value: 'piper',
    label: t('narration.enginePiper'),
    description: t('narration.enginePiperDescription'),
  },
  {
    value: 'kokoro',
    label: t('narration.engineKokoro'),
    description: t('narration.engineKokoroDescription'),
  },
];

export default function NarrationSettingsScreen() {
  const backToParent = useBackToParent();
  const narration = useSettingsStore((state) => state.settings.narration);
  const setSetting = useSettingsStore((state) => state.setSetting);

  const [voices, setVoices] = useState<NormalizedSystemVoice[] | null>(null);
  const [packs, setPacks] = useState<PackRow[] | null>(null);
  const [busyPack, setBusyPack] = useState<string | null>(null);
  const [progress, setProgress] = useState<PackDownloadProgress | null>(null);
  const [packError, setPackError] = useState<string | null>(null);

  const systemAvailable = systemTtsAvailable();
  const neuralAvailable = getSherpaTtsModule() !== null;

  const update = (patch: Partial<typeof narration>) => {
    void setSetting('narration', { ...narration, ...patch });
  };

  useEffect(() => {
    if (narration.engine !== 'system') return;
    const module = getSystemTtsModule();
    if (!systemTtsAvailable() || !module) return;
    let cancelled = false;
    void module
      .warmup()
      .then(() => module.getVoices())
      .then((list) => {
        if (cancelled) return;
        setVoices(normalizeSystemVoices(list));
      })
      .catch(() => {
        if (!cancelled) setVoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [narration.engine]);

  const refreshPacks = useCallback(async () => {
    if (narration.engine === 'system') return;
    const rows: PackRow[] = [];
    for (const def of voicePacksForEngine(narration.engine)) {
      rows.push({ def, status: await voicePackStatus(def) });
    }
    setPacks(rows);
  }, [narration.engine]);

  useFocusEffect(
    useCallback(() => {
      void refreshPacks();
    }, [refreshPacks]),
  );

  const pickEngine = (engine: NarrationEngineId) => {
    update({ engine, voiceId: null });
  };

  const download = async (def: VoicePackDef) => {
    setBusyPack(def.id);
    setPackError(null);
    setProgress({ received: 0, total: def.bytes });
    try {
      await installVoicePack(def, setProgress);
      update({ engine: def.engine, voiceId: def.id });
      await refreshPacks();
    } catch (error) {
      setPackError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyPack(null);
      setProgress(null);
    }
  };

  const remove = (def: VoicePackDef) => {
    deleteVoicePack(def.id);
    if (narration.voiceId === def.id) update({ voiceId: null });
    void refreshPacks();
  };

  const availableSystemVoices = useMemo(
    () => (systemAvailable ? (voices ?? []) : []),
    [systemAvailable, voices],
  );
  const systemVoiceOptions = useMemo(
    () => [
      { value: '', label: t('narration.voiceDefault') },
      ...availableSystemVoices.map((voice) => ({ value: voice.id, label: voice.label })),
    ],
    [availableSystemVoices],
  );

  const ready = packs?.filter((row) => row.status.state === 'ready').length ?? 0;

  return (
    <Screen>
      <AppBar
        title={t('settings.narration')}
        onBack={() => backToParent({ pathname: '/settings' })}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('narration.engine')} description={t('narration.engineDescription')}>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('narration.engine')}>
            {ENGINES.map((option) => {
              const available = option.value === 'system' ? systemAvailable : neuralAvailable;
              return (
                <ChoiceRow
                  key={option.value}
                  label={option.label}
                  description={available ? option.description : t('narration.engineUnavailable')}
                  selected={narration.engine === option.value}
                  disabled={!available}
                  onPress={() => pickEngine(option.value)}
                />
              );
            })}
          </View>
        </Section>

        {narration.engine === 'system' ? (
          <Section title={t('narration.voice')} description={t('narration.voiceDescriptionSystem')}>
            {systemAvailable && voices === null ? (
              <Row label={t('narration.loadingVoices')} />
            ) : availableSystemVoices.length === 0 ? (
              <Row label={t('narration.noVoices')} />
            ) : (
              <View style={styles.options}>
                <OptionGroup
                  label={t('narration.voice')}
                  options={systemVoiceOptions}
                  value={narration.voiceId ?? ''}
                  onChange={(voiceId) => update({ voiceId: voiceId || null })}
                  framed={false}
                />
              </View>
            )}
          </Section>
        ) : (
          <Section title={t('narration.voice')} description={t('narration.voiceDescriptionNeural')}>
            {packs === null ? (
              <Row label={t('narration.loadingVoices')} />
            ) : (
              <>
                {packs.map(({ def, status }) => {
                  const isReady = status.state === 'ready';
                  const selected = narration.voiceId === def.id;
                  const busy = busyPack === def.id;
                  return (
                    <Row
                      key={def.id}
                      label={def.name}
                      description={
                        busy && progress
                          ? t('narration.downloading', {
                              percent: progress.total
                                ? Math.min(
                                    100,
                                    Math.round((progress.received / progress.total) * 100),
                                  )
                                : 0,
                            })
                          : isReady
                            ? selected
                              ? t('narration.packReadySelected')
                              : t('narration.packReady')
                            : status.state === 'partial'
                              ? t('narration.packIncomplete')
                              : t('narration.packNotInstalled')
                      }
                      right={
                        <View style={styles.packActions}>
                          {isReady ? (
                            <Button
                              variant={selected ? 'secondary' : 'primary'}
                              title={selected ? t('narration.selectedVoice') : t('common.choose')}
                              disabled={selected}
                              onPress={() => update({ engine: def.engine, voiceId: def.id })}
                            />
                          ) : (
                            <Button
                              title={t('narration.downloadVoice')}
                              loading={busy}
                              disabled={busyPack !== null || !neuralAvailable}
                              onPress={() => void download(def)}
                            />
                          )}
                          {isReady ? (
                            <IconButton
                              icon="trash-outline"
                              label={t('narration.deleteVoice')}
                              onPress={() => remove(def)}
                            />
                          ) : null}
                        </View>
                      }
                    />
                  );
                })}
                <Row label={t('narration.installedStat', { done: ready, total: packs.length })} />
              </>
            )}
            {packError ? (
              <ThemedText type="small" themeColor="danger" style={styles.error}>
                {packError}
              </ThemedText>
            ) : null}
          </Section>
        )}

        <Section title={t('narration.playback')} description={t('narration.playbackDescription')}>
          <View style={styles.options}>
            <OptionGroup
              label={t('narration.speed')}
              options={SPEEDS.map((value) => ({
                value,
                label: t('narration.speedValue', { value: Number(value) }),
              }))}
              value={String(narration.speed)}
              onChange={(value) => update({ speed: Number(value) })}
              framed={false}
            />
          </View>
          <Row label={t('narration.nextChapterHint')} />
        </Section>
      </ScrollView>
    </Screen>
  );
}

function ChoiceRow({
  label,
  description,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderBottomColor: theme.border,
          backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <View style={styles.choiceText}>
        <ThemedText type="default">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={20} color={theme.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  choiceText: { flex: 1, gap: Spacing.half },
  options: { padding: Spacing.three },
  packActions: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  error: { padding: Spacing.three },
});
