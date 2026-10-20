import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { AppBar } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import type { SourceHealthRow } from '@/db/repositories/source-health';
import { useTheme } from '@/hooks/use-theme';
import { checkSourceHealth, listSourceHealth } from '@/services/source-health';
import { listBuiltInSourceInfos } from '@/services/source-manager';
import { useSettingsStore } from '@/stores/settings';
import type { SourceInfo } from '@/sources';
import { useBackToParent } from '@/navigation/use-parent-back';

const CAPABILITY_KEYS = {
  popular: 'sources.capability.popular',
  latest: 'sources.capability.latest',
  search: 'sources.capability.search',
  tags: 'sources.capability.tags',
  categories: 'sources.capability.categories',
  auth: 'sources.capability.auth',
} as const;

function hostOf(baseUrl: string): string {
  return baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function checkedAt(row: SourceHealthRow): number | null {
  return Math.max(row.lastOkAt ?? 0, row.lastErrorAt ?? 0) || null;
}

function isFailing(row: SourceHealthRow): boolean {
  return row.lastErrorAt != null && (row.lastOkAt == null || row.lastErrorAt > row.lastOkAt);
}

function formatChecked(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

export default function SourcesScreen() {
  const backToParent = useBackToParent();
  const theme = useTheme();
  const offline = useSettingsStore((state) => state.settings.offlineMode);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const [health, setHealth] = useState<Record<string, SourceHealthRow>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const sources = listBuiltInSourceInfos();

  const load = useCallback(async () => {
    try {
      const rows = await listSourceHealth();
      setHealth(Object.fromEntries(rows));
    } catch {
      setHealth({});
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const check = useCallback(
    async (source: SourceInfo) => {
      setChecking(source.id);
      try {
        const result = await checkSourceHealth(source.id);
        if (!result.ok && !result.skipped) {
          Alert.alert(t('sources.checkFailedTitle'), result.error);
        }
        await load();
      } catch (error) {
        Alert.alert(
          t('sources.checkFailedTitle'),
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setChecking(null);
      }
    },
    [load],
  );

  const browse = useCallback(
    (source: SourceInfo) => {
      void setSetting('activeSourceId', source.id);
      router.navigate('/browse');
    },
    [setSetting],
  );

  return (
    <Screen>
      <AppBar
        title={t('sources.title')}
        subtitle={t('sources.subtitle', { count: sources.length })}
        onBack={() => backToParent({ pathname: '/' })}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <OfflineBanner />
        <ThemedText type="small" themeColor="textSecondary">
          {t('sources.intro')}
        </ThemedText>

        {sources.map((source) => {
          const row = health[source.id];
          const failing = row ? isFailing(row) : false;
          const checked = row ? checkedAt(row) : null;
          const status =
            checking === source.id
              ? t('sources.checking')
              : !row
                ? t('sources.neverChecked')
                : failing
                  ? t('sources.unreachable')
                  : t('sources.reachable');
          const statusColor =
            !row || checking === source.id
              ? theme.textMuted
              : failing
                ? theme.danger
                : theme.success;
          const detail = checked
            ? [
                t('sources.lastChecked', { time: formatChecked(checked) }),
                !failing && row?.ewmaLatencyMs != null
                  ? t('sources.latency', { ms: Math.round(row.ewmaLatencyMs) })
                  : null,
                failing && row ? t('sources.failures', { count: row.failCount }) : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : null;

          return (
            <View
              key={source.id}
              style={[
                styles.card,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitle}>
                  <ThemedText type="heading">{source.name}</ThemedText>
                  <ThemedText type="small" themeColor="textMuted">
                    {hostOf(source.baseUrl)} · {source.lang.toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.status}>
                  <View style={[styles.dot, { backgroundColor: statusColor }]} />
                  <ThemedText type="smallBold" style={{ color: statusColor }}>
                    {status}
                  </ThemedText>
                </View>
              </View>

              <ThemedText type="small" themeColor="textSecondary">
                {source.capabilities
                  .map((capability) => t(CAPABILITY_KEYS[capability]))
                  .join(' · ')}
              </ThemedText>
              {detail ? (
                <ThemedText type="small" themeColor="textMuted">
                  {detail}
                </ThemedText>
              ) : null}

              <View style={styles.actions}>
                <Button
                  title={t('sources.browse')}
                  icon="compass-outline"
                  variant="secondary"
                  onPress={() => browse(source)}
                  style={styles.action}
                />
                <Button
                  title={checking === source.id ? t('sources.checking') : t('sources.check')}
                  icon="pulse-outline"
                  variant="ghost"
                  loading={checking === source.id}
                  disabled={offline || checking != null}
                  onPress={() => void check(source)}
                  style={styles.action}
                />
              </View>
            </View>
          );
        })}

        {offline ? (
          <ThemedText type="small" themeColor="warning">
            {t('sources.offlineNote')}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textMuted">
          {t('sources.disclaimer')}
        </ThemedText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  cardTitle: { flex: 1, gap: Spacing.half },
  status: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, paddingTop: 2 },
  dot: { borderRadius: 4, height: 8, width: 8 },
  actions: { flexDirection: 'row', gap: Spacing.two, paddingTop: Spacing.one },
  action: { flex: 1 },
});
