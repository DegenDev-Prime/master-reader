import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { Eyebrow } from '@/components/eyebrow';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { LoadingView } from '@/components/ui/loading';
import { OptionGroup } from '@/components/ui/option-group';
import { Screen } from '@/components/ui/screen';
import { Row, Section } from '@/components/ui/section';
import { Stepper } from '@/components/ui/stepper';
import { TextField } from '@/components/ui/text-field';
import { NARRATION_SPEED_VALUES, nearestSpeedOption } from '@/components/ui/transport-state';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { systemEngine } from '@/narration/engines/system';
import { getSherpaTtsModule } from '@/narration/native/sherpa-tts';
import { localeDisplayName } from '@/narration/system-voice-names';
import type { NarrationEngineId, VoiceInfo } from '@/narration/types';
import { filterVoices, groupVoicesByLanguage } from '@/narration/voice-search';
import { speakSample, type SpeechPreview } from '@/narration/voice-preview';
import {
  groupVoicePacksByLanguage,
  voicePackById,
  voicePacksForEngine,
  type VoicePackDef,
} from '@/narration/voice-packs';
import {
  deleteVoicePack,
  installVoicePack,
  voicePackStatus,
  type PackDownloadProgress,
  type VoicePackStatus,
} from '@/narration/voice-pack-store';
import type { NarrationSettings } from '@/services/settings';
import { useNarrationStore } from '@/stores/narration';
import { useSettingsStore } from '@/stores/settings';
import { formatBytes } from '@/utils/format';
import { useBackToParent } from '@/navigation/use-parent-back';

const VOICE_PREVIEW_LIMIT = 10;

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

type PackRow = {
  def: VoicePackDef;
  status: VoicePackStatus;
};

export default function NarrationSettingsScreen() {
  const backToParent = useBackToParent();
  const settings = useSettingsStore((state) => state.settings);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const setSpeed = useNarrationStore((state) => state.setSpeed);
  const setVoice = useNarrationStore((state) => state.setVoice);
  const [voices, setVoices] = useState<VoiceInfo[] | null>(null);
  const [voicesError, setVoicesError] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [expandedLanguages, setExpandedLanguages] = useState<Record<string, boolean>>({});
  const [packs, setPacks] = useState<PackRow[] | null>(null);
  const [busyPack, setBusyPack] = useState<string | null>(null);
  const [packProgress, setPackProgress] = useState<PackDownloadProgress | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRef = useRef<SpeechPreview | null>(null);

  const nativeAvailable = getSherpaTtsModule() !== null;
  const engine = settings.narration.engine;

  const refreshPacks = useCallback(async () => {
    const defs = [...voicePacksForEngine('piper'), ...voicePacksForEngine('kokoro')];
    const rows: PackRow[] = [];
    for (const def of defs) {
      rows.push({ def, status: await voicePackStatus(def) });
    }
    setPacks(rows);
  }, []);

  useEffect(() => {
    if (engine !== 'system') return;
    let cancelled = false;
    void systemEngine
      .listVoices()
      .then((list) => {
        if (!cancelled) setVoices(list);
      })
      .catch(() => {
        if (!cancelled) setVoicesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [engine]);

  useFocusEffect(
    useCallback(() => {
      if (engine !== 'system' && nativeAvailable) void refreshPacks();
    }, [engine, nativeAvailable, refreshPacks]),
  );

  const updateNarration = (patch: Partial<NarrationSettings>) => {
    void setSetting('narration', { ...settings.narration, ...patch });
  };

  const downloadPack = async (def: VoicePackDef) => {
    setBusyPack(def.id);
    setPackError(null);
    setPackProgress({ received: 0, total: def.bytes });
    try {
      await installVoicePack(def, (progress) => setPackProgress(progress));
      await setVoice(def.id);
      await refreshPacks();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPackError(message);
      console.warn('Voice pack install failed', error);
    } finally {
      setBusyPack(null);
      setPackProgress(null);
    }
  };

  const removePack = async (def: VoicePackDef) => {
    deleteVoicePack(def.id);
    if (settings.narration.voiceId === def.id) await setVoice(null);
    await refreshPacks();
  };

  // Arc's "cast your narrator" beat: one sample utterance through the
  // installed pack's own engine; a running preview is stopped before another
  // can start, and the guard in speakSample keeps real sessions untouchable.
  const previewPack = (def: VoicePackDef) => {
    if (previewRef.current) void previewRef.current.stop();
    const sample = speakSample({
      text: t('narration.previewSample'),
      voiceId: def.id,
      engine: def.engine,
    });
    if (!sample) return;
    previewRef.current = sample;
    setPreviewId(def.id);
    sample.done
      .then(
        () => undefined,
        () => undefined,
      )
      .finally(() => {
        if (previewRef.current === sample) previewRef.current = null;
        setPreviewId(null);
      });
  };

  useEffect(
    () => () => {
      void previewRef.current?.stop();
      previewRef.current = null;
    },
    [],
  );

  const engineAvailable = (id: NarrationEngineId): boolean => {
    if (id === 'system') return true;
    return nativeAvailable;
  };

  const toggleVoice = (voiceId: string) => {
    // The voice of a running session changes with it, so the player is told
    // about the change instead of waiting for the next session.
    void setVoice(settings.narration.voiceId === voiceId ? null : voiceId);
  };

  const toggleLanguage = (language: string) => {
    setExpandedLanguages((prev) => ({ ...prev, [language]: !prev[language] }));
  };

  const selectedVoiceId = settings.narration.voiceId;
  const selectedSystemVoice = voices?.find((voice) => voice.id === selectedVoiceId) ?? null;
  const selectedPack = selectedVoiceId ? voicePackById(selectedVoiceId) : null;

  const filteredVoices = useMemo(
    () => filterVoices(voices ?? [], voiceQuery),
    [voices, voiceQuery],
  );
  const voiceGroups = useMemo(() => groupVoicesByLanguage(filteredVoices), [filteredVoices]);
  const searching = voiceQuery.trim().length > 0;

  const packStatusById = useMemo(
    () => new Map((packs ?? []).map((row) => [row.def.id, row.status])),
    [packs],
  );
  const packGroups = useMemo(
    () => (engine === 'system' ? [] : groupVoicePacksByLanguage(voicePacksForEngine(engine))),
    [engine],
  );

  // §2.8 stat pair: installed count over the registry + on-device footprint.
  const packStats = useMemo(() => {
    const rows = packs ?? [];
    const ready = rows.filter((row) => row.status.state === 'ready');
    return {
      total: rows.length,
      done: ready.length,
      bytes: ready.reduce(
        (sum, row) => sum + (row.status.state === 'ready' ? row.status.bytes : 0),
        0,
      ),
    };
  }, [packs]);

  const speedOptions = useMemo(
    () =>
      NARRATION_SPEED_VALUES.map((value) => ({
        value: String(value),
        label: t('narration.speedValue', { value }),
      })),
    [],
  );

  return (
    <Screen>
      <AppBar
        title={t('settings.narration')}
        onBack={() => backToParent({ pathname: '/settings' })}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Section title={t('narration.engine')} description={t('narration.engineDescription')}>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('narration.engine')}>
            {ENGINES.map((option) => {
              const available = engineAvailable(option.value);
              return (
                <ChoiceRow
                  key={option.value}
                  label={option.label}
                  description={available ? option.description : t('narration.engineUnavailable')}
                  selected={engine === option.value}
                  disabled={!available}
                  onPress={() => void setVoice(null, option.value)}
                />
              );
            })}
          </View>
        </Section>

        {engine === 'system' ? (
          <Section title={t('narration.voice')} description={t('narration.voiceDescriptionSystem')}>
            <SelectionSummary
              label={t('narration.selectedVoice')}
              value={selectedSystemVoice?.name ?? t('common.notSet')}
              empty={!selectedSystemVoice}
            />
            {voicesError ? (
              <View style={styles.note}>
                <EmptyState
                  icon="alert-circle-outline"
                  title={t('narration.voiceLoadError')}
                  message=""
                />
              </View>
            ) : voices === null ? (
              <LoadingView label={t('narration.loadingVoices')} />
            ) : voices.length === 0 ? (
              <View style={styles.note}>
                <EmptyState icon="mic-outline" title={t('narration.noVoices')} message="" />
              </View>
            ) : (
              <>
                <View style={styles.searchPad}>
                  <TextField
                    icon="search"
                    accessibilityLabel={t('narration.searchVoices')}
                    placeholder={t('narration.searchVoices')}
                    value={voiceQuery}
                    onChangeText={setVoiceQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    right={
                      voiceQuery.length > 0 ? (
                        <IconButton
                          icon="close"
                          label={t('common.clear')}
                          onPress={() => setVoiceQuery('')}
                        />
                      ) : null
                    }
                  />
                </View>
                {filteredVoices.length === 0 ? (
                  <View style={styles.note}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('narration.noVoiceMatches')}
                    </ThemedText>
                  </View>
                ) : (
                  voiceGroups.map((group) => {
                    const expanded = Boolean(expandedLanguages[group.language]);
                    const visible =
                      expanded || searching
                        ? group.voices
                        : group.voices.slice(0, VOICE_PREVIEW_LIMIT);
                    const hiddenCount = group.voices.length - visible.length;
                    return (
                      <View key={group.language} style={styles.group}>
                        <View style={styles.groupHeader}>
                          <ThemedText type="smallBold" themeColor="textSecondary">
                            {group.label.toUpperCase()}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textMuted">
                            {group.voices.length}
                          </ThemedText>
                        </View>
                        <View
                          accessibilityRole="radiogroup"
                          accessibilityLabel={`${t('narration.voice')} · ${group.label}`}
                          style={styles.chips}
                        >
                          {visible.map((voice) => (
                            <Chip
                              key={voice.id}
                              label={voice.name}
                              role="radio"
                              selected={selectedVoiceId === voice.id}
                              onPress={() => toggleVoice(voice.id)}
                            />
                          ))}
                          {hiddenCount > 0 ? (
                            <Chip
                              label={t('narration.showAllVoices', {
                                count: group.voices.length,
                              })}
                              onPress={() => toggleLanguage(group.language)}
                            />
                          ) : null}
                          {expanded && !searching && group.voices.length > VOICE_PREVIEW_LIMIT ? (
                            <Chip
                              label={t('narration.showFewerVoices')}
                              onPress={() => toggleLanguage(group.language)}
                            />
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}
          </Section>
        ) : (
          <Section title={t('narration.voice')} description={t('narration.voiceDescriptionNeural')}>
            {packs !== null && packStats.total > 0 ? (
              <View style={styles.statRow}>
                <ThemedText type="heading">
                  {t('narration.installedStat', { done: packStats.done, total: packStats.total })}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('narration.deviceStat', { size: formatBytes(packStats.bytes) })}
                </ThemedText>
              </View>
            ) : null}
            <SelectionSummary
              label={t('narration.selectedVoice')}
              value={selectedPack?.name ?? t('common.notSet')}
              empty={!selectedPack}
            />
            {packs === null ? (
              nativeAvailable ? (
                <LoadingView label={t('narration.loadingVoices')} />
              ) : (
                <View style={styles.note}>
                  <EmptyState
                    icon="information-circle-outline"
                    title={t('narration.engineUnavailable')}
                    message=""
                  />
                </View>
              )
            ) : (
              packGroups.map((group) => {
                const standard = group.packs.filter((def) => !def.experimental);
                const experimental = group.packs.filter((def) => def.experimental);
                const renderPack = (def: VoicePackDef) => {
                  const status = packStatusById.get(def.id);
                  if (!status) return null;
                  return (
                    <PackItem
                      key={def.id}
                      def={def}
                      status={status}
                      selected={selectedVoiceId === def.id}
                      busy={busyPack === def.id}
                      progress={busyPack === def.id ? packProgress : null}
                      disabled={busyPack !== null && busyPack !== def.id}
                      previewing={previewId === def.id}
                      previewBusy={previewId !== null}
                      onSelect={() => toggleVoice(def.id)}
                      onDownload={() => void downloadPack(def)}
                      onDelete={() => void removePack(def)}
                      onPreview={() => previewPack(def)}
                    />
                  );
                };
                return (
                  <View key={group.language} style={styles.group}>
                    <View style={styles.groupHeader}>
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        {group.label.toUpperCase()}
                      </ThemedText>
                    </View>
                    <View
                      accessibilityRole="radiogroup"
                      accessibilityLabel={`${t('narration.voice')} · ${group.label}`}
                    >
                      {standard.length > 0 ? (
                        <>
                          <Eyebrow style={styles.caption}>{t('narration.sectionStandard')}</Eyebrow>
                          {standard.map(renderPack)}
                        </>
                      ) : null}
                      {experimental.length > 0 ? (
                        <>
                          <Eyebrow style={styles.caption}>
                            {t('narration.sectionExperimental')}
                          </Eyebrow>
                          {experimental.map(renderPack)}
                        </>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
            {packError ? (
              <View style={styles.note}>
                <ThemedText type="small" themeColor="danger">
                  {packError}
                </ThemedText>
              </View>
            ) : null}
          </Section>
        )}

        <Section title={t('narration.playback')} description={t('narration.playbackDescription')}>
          <View style={styles.optionPad}>
            <OptionGroup
              label={t('narration.speed')}
              options={speedOptions}
              value={nearestSpeedOption(settings.narration.speed)}
              onChange={(value) => void setSpeed(Number(value))}
              framed={false}
            />
          </View>
          <NumericRow
            label={t('narration.skip')}
            value={settings.narration.skipSeconds}
            unit={t('narration.secondsShort')}
            step={5}
            min={5}
            max={60}
            onChange={(skipSeconds) => updateNarration({ skipSeconds })}
          />
          <NumericRow
            label={t('narration.rewind')}
            value={settings.narration.autoRewindSeconds}
            unit={t('narration.secondsShort')}
            step={5}
            min={0}
            max={30}
            onChange={(autoRewindSeconds) => updateNarration({ autoRewindSeconds })}
          />
        </Section>

        <Section title={t('narration.sleep')} description={t('narration.sleepDescription')}>
          <NumericRow
            label={t('narration.sleepDuration')}
            value={settings.narration.sleepMinutes}
            unit={t('narration.minutesShort')}
            step={5}
            min={5}
            max={120}
            onChange={(sleepMinutes) => updateNarration({ sleepMinutes })}
          />
        </Section>

        <Section title={t('pronunciation.title')} description={t('pronunciation.appliedIn')}>
          <Row
            label={t('pronunciation.manageRules')}
            right={
              <Button
                variant="ghost"
                title={t('common.open')}
                onPress={() => router.push('/pronunciation')}
              />
            }
          />
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
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.choice,
        { borderBottomColor: theme.border },
        selected && { backgroundColor: theme.backgroundSelected },
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={styles.choiceText}>
        <ThemedText type="default">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? theme.primary : theme.textMuted}
      />
    </Pressable>
  );
}

function SelectionSummary({
  label,
  value,
  empty,
}: {
  label: string;
  value: string;
  empty: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.summary, { backgroundColor: theme.backgroundSelected }]}>
      <Ionicons
        name={empty ? 'ellipse-outline' : 'checkmark-circle'}
        size={18}
        color={empty ? theme.textMuted : theme.primary}
      />
      <View style={styles.summaryText}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="default" numberOfLines={2}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

function PackItem({
  def,
  status,
  selected,
  busy,
  progress,
  disabled,
  previewing,
  previewBusy,
  onSelect,
  onDownload,
  onDelete,
  onPreview,
}: {
  def: VoicePackDef;
  status: VoicePackStatus;
  selected: boolean;
  busy: boolean;
  progress: PackDownloadProgress | null;
  disabled: boolean;
  /** This pack is the one currently speaking its sample. */
  previewing: boolean;
  /** Any preview is running, so other packs' preview buttons wait. */
  previewBusy: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const theme = useTheme();
  const ready = status.state === 'ready';
  const canSelect = ready && !disabled;
  const percent = progress?.total ? Math.round((progress.received / progress.total) * 100) : 0;
  const stateLabel = ready
    ? selected
      ? t('narration.packReadySelected')
      : t('narration.packReady')
    : status.state === 'partial'
      ? t('narration.packIncomplete')
      : t('narration.packNotInstalled');
  const stateColor = ready
    ? theme.success
    : status.state === 'partial'
      ? theme.warning
      : theme.textMuted;

  const previewLabel = previewing ? t('narration.previewBusy') : t('narration.preview');
  const previewDisabled = (previewBusy && !previewing) || disabled || (!ready && !previewing);

  return (
    <View
      style={[
        styles.packItem,
        { borderBottomColor: theme.border },
        selected && { backgroundColor: theme.backgroundSelected },
      ]}
    >
      <Pressable
        onPress={canSelect ? onSelect : undefined}
        disabled={!canSelect}
        accessibilityRole="radio"
        accessibilityLabel={`${def.name}. ${stateLabel}`}
        accessibilityState={{ selected, disabled: !canSelect }}
        style={({ pressed }) => [styles.packPress, pressed && canSelect && { opacity: 0.85 }]}
      >
        <Ionicons
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={selected ? theme.primary : theme.textMuted}
        />
        <View style={styles.packText}>
          <ThemedText type="default" style={styles.packName} numberOfLines={2}>
            {def.name}
          </ThemedText>
          <View style={styles.packChips}>
            <MiniChip label={localeDisplayName(def.language)} />
            <MiniChip label={formatBytes(def.bytes)} />
          </View>
          <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
            {t('narration.packDescription')}
          </ThemedText>
          <ThemedText type="small" style={{ color: stateColor }}>
            {stateLabel}
          </ThemedText>
          {def.experimental ? (
            <ThemedText type="small" themeColor="warning">
              {t('narration.experimentalVoice')}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.packAction}>
        {busy ? (
          <Button
            variant="secondary"
            title={t('narration.downloading', { percent })}
            loading
            disabled
          />
        ) : (
          <View style={styles.packActions}>
            {ready ? (
              <IconButton
                icon="trash-outline"
                label={t('narration.deleteVoice')}
                color={theme.danger}
                onPress={onDelete}
                disabled={disabled}
              />
            ) : (
              <Button
                variant="secondary"
                title={t('narration.downloadVoice')}
                onPress={onDownload}
                disabled={disabled}
              />
            )}
            <Button
              variant="ghost"
              title={previewLabel}
              accessibilityLabel={t('narration.previewVoice')}
              onPress={onPreview}
              disabled={previewDisabled}
            />
          </View>
        )}
      </View>
    </View>
  );
}

/** Flat hairline display chip: locale and size are information, not actions. */
function MiniChip({ label }: { label: string }) {
  return (
    <View style={styles.miniChip}>
      <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

function NumericRow({
  label,
  value,
  unit,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <Row
      label={label}
      right={
        <View style={styles.stepperRow}>
          <Stepper
            value={value}
            step={step}
            label={label}
            onDecrease={() => onChange(Math.max(min, value - step))}
            onIncrease={() => onChange(Math.min(max, value + step))}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.unit}>
            {unit}
          </ThemedText>
        </View>
      }
    />
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
  choiceText: { flex: 1, minWidth: 0, gap: Spacing.half },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  summaryText: { flex: 1, minWidth: 0, gap: Spacing.half },
  searchPad: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  group: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  packItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  packPress: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  packText: { flex: 1, minWidth: 0, gap: Spacing.half },
  packName: { fontWeight: '600' },
  packChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  miniChip: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  caption: { paddingTop: Spacing.half },
  packActions: { alignItems: 'flex-end', gap: Spacing.one },
  packAction: { alignItems: 'flex-end', justifyContent: 'center' },
  statRow: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.half,
  },
  optionPad: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  unit: { minWidth: 24 },
  note: { padding: Spacing.three },
});
