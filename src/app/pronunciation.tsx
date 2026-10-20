import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { Eyebrow } from '@/components/eyebrow';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { LoadingView } from '@/components/ui/loading';
import { OptionSheet, type OptionSheetOption } from '@/components/ui/option-sheet';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isPreviewStopped, speakSample, type SpeechPreview } from '@/narration/voice-preview';
import { getCachedStory } from '@/services/catalog';
import {
  GLOBAL_SCOPE,
  applyPronunciation,
  rulesForStory,
  type PronunciationRule,
  type PronunciationScope,
} from '@/services/pronunciation';
import { usePronunciationStore } from '@/stores/pronunciation';
import { useNarrationStore } from '@/stores/narration';
import { useBackToParent } from '@/navigation/use-parent-back';

/** Scope keys look like "global" or "sourceId:storyId"; story ids may hold ":". */
function parseStoryScope(scope: PronunciationScope): { sourceId: string; storyId: string } | null {
  const separator = scope.indexOf(':');
  if (separator <= 0) return null;
  return { sourceId: scope.slice(0, separator), storyId: scope.slice(separator + 1) };
}

/** Story-scoped rule scopes, deduplicated, registry order preserved. */
function storyScopeKeys(rules: readonly PronunciationRule[]): PronunciationScope[] {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (rule.scope !== GLOBAL_SCOPE) seen.add(rule.scope);
  }
  return [...seen];
}

export default function PronunciationScreen() {
  const backToParent = useBackToParent();
  const theme = useTheme();
  const params = useLocalSearchParams<{ sourceId?: string; storyId?: string }>();

  const rules = usePronunciationStore((state) => state.rules);
  const scope = usePronunciationStore((state) => state.scope);
  const isHydrated = usePronunciationStore((state) => state.isHydrated);
  const hydrate = usePronunciationStore((state) => state.hydrate);
  const setScope = usePronunciationStore((state) => state.setScope);
  const addRule = usePronunciationStore((state) => state.addRule);
  const removeRule = usePronunciationStore((state) => state.removeRule);

  const narrating = useNarrationStore((state) => state.status === 'playing');

  const [adding, setAdding] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [scopeSheet, setScopeSheet] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const previewRef = useRef<SpeechPreview | null>(null);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
    }, [hydrate]),
  );

  // Reader-hub entry point: preselect the story scope passed via route params.
  useEffect(() => {
    if (params.sourceId && params.storyId) setScope(`${params.sourceId}:${params.storyId}`);
  }, [params.sourceId, params.storyId, setScope]);

  // One title lookup per story with rules; raw scope keys stay the fallback.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries: Record<string, string> = {};
      for (const key of storyScopeKeys(rules)) {
        const story = parseStoryScope(key);
        if (!story) continue;
        let label = key;
        try {
          label = (await getCachedStory(story.sourceId, story.storyId))?.title ?? key;
        } catch {
          // Story metadata may be absent offline; the scope key remains readable.
        }
        if (cancelled) return;
        entries[key] = label;
      }
      if (!cancelled) setTitles(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [rules]);

  const scopedRules = useMemo(() => rules.filter((rule) => rule.scope === scope), [rules, scope]);
  const scopeLabel =
    scope === GLOBAL_SCOPE ? t('pronunciation.globalScope') : (titles[scope] ?? scope);

  const scopeOptions = useMemo<OptionSheetOption<string>[]>(() => {
    const options: OptionSheetOption<string>[] = [
      { value: GLOBAL_SCOPE, label: t('pronunciation.globalScope') },
    ];
    for (const key of storyScopeKeys(rules)) {
      options.push({
        value: key,
        label: t('pronunciation.storyScope', { title: titles[key] ?? key }),
      });
    }
    return options;
  }, [rules, titles]);

  const stopPreview = useCallback(() => {
    const handle = previewRef.current;
    previewRef.current = null;
    void handle?.stop().catch(() => undefined);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const testVoice = useCallback(() => {
    if (previewRef.current) return;
    const story = scope === GLOBAL_SCOPE ? null : parseStoryScope(scope);
    const effective = rulesForStory(rules, story?.sourceId ?? '', story?.storyId ?? '');
    const text = applyPronunciation(t('narration.previewSample'), effective);
    setPreviewing(true);
    const handle = speakSample({ text, voiceId: null });
    if (!handle) {
      setPreviewing(false);
      return;
    }
    previewRef.current = handle;
    handle.done
      .then(() => undefined)
      .catch((error) => {
        if (!isPreviewStopped(error)) console.warn('Voice test failed', error);
      })
      .finally(() => {
        previewRef.current = null;
        setPreviewing(false);
      });
  }, [rules, scope]);

  const saveRule = useCallback(() => {
    void (async () => {
      const saved = await addRule(findText, replaceText);
      if (saved) {
        setAdding(false);
        setFindText('');
        setReplaceText('');
      }
    })();
  }, [addRule, findText, replaceText]);

  return (
    <Screen>
      <AppBar
        title={t('pronunciation.title')}
        onBack={() => backToParent({ pathname: '/settings/narration' })}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Eyebrow>{t('pronunciation.appliedIn')}</Eyebrow>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('pronunciation.title')}: ${scopeLabel}`}
          onPress={() => setScopeSheet(true)}
          style={({ pressed }) => [
            styles.scopeRow,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={styles.scopeText}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('pronunciation.title')}
            </ThemedText>
            <ThemedText type="default" numberOfLines={1}>
              {scopeLabel}
            </ThemedText>
          </View>
          <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
        </Pressable>

        {scopedRules.length > 0 ? (
          <Section title={scopeLabel}>
            {scopedRules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onDelete={() => void removeRule(rule.id)} />
            ))}
          </Section>
        ) : isHydrated ? (
          <EmptyState
            icon="copy-outline"
            title={t('pronunciation.emptyTitle')}
            message={t('pronunciation.emptyMessage')}
          />
        ) : (
          <LoadingView label={t('common.loading')} />
        )}

        {adding ? (
          <Section title={t('pronunciation.addRule')}>
            <View style={styles.form}>
              <TextField
                accessibilityLabel={t('pronunciation.writtenAs')}
                placeholder={t('pronunciation.writtenAs')}
                value={findText}
                onChangeText={setFindText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextField
                accessibilityLabel={t('pronunciation.readsAs')}
                placeholder={t('pronunciation.readsAs')}
                value={replaceText}
                onChangeText={setReplaceText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.formActions}>
                <Button
                  variant="secondary"
                  title={t('common.cancel')}
                  onPress={() => {
                    setAdding(false);
                    setFindText('');
                    setReplaceText('');
                  }}
                />
                <Button title={t('pronunciation.save')} onPress={saveRule} />
              </View>
            </View>
          </Section>
        ) : (
          <Button
            variant="secondary"
            icon="add"
            title={t('pronunciation.addRule')}
            onPress={() => setAdding(true)}
          />
        )}

        <Button
          variant="ghost"
          icon="volume-high-outline"
          title={previewing ? t('narration.previewBusy') : t('pronunciation.test')}
          onPress={testVoice}
          disabled={previewing || narrating}
          accessibilityLabel={`${t('pronunciation.test')}. ${t('narration.previewSample')}`}
        />

        <OptionSheet
          visible={scopeSheet}
          title={t('pronunciation.title')}
          options={scopeOptions}
          value={scope}
          onSelect={(next) => {
            if (next) setScope(next);
            setScopeSheet(false);
          }}
          onClose={() => setScopeSheet(false)}
        />
      </ScrollView>
    </Screen>
  );
}

function RuleRow({ rule, onDelete }: { rule: PronunciationRule; onDelete: () => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.ruleRow, { borderBottomColor: theme.border }]}>
      <View style={styles.ruleText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {rule.find}
        </ThemedText>
        <View style={styles.replacement}>
          <Ionicons name="arrow-forward" size={14} color={theme.textMuted} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {rule.replace}
          </ThemedText>
        </View>
      </View>
      <IconButton
        icon="trash-outline"
        label={t('pronunciation.deleteRule')}
        color={theme.danger}
        onPress={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    minHeight: 56,
  },
  scopeText: { flex: 1, minWidth: 0, gap: Spacing.half },
  form: { gap: Spacing.two, padding: Spacing.three },
  formActions: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ruleText: { flex: 1, minWidth: 0, gap: Spacing.half },
  replacement: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
