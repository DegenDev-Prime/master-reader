import 'react-native-url-polyfill/auto';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AgeGate } from '@/components/age-gate';
import { BrowserHost } from '@/components/browser-host';
import { DatabaseGate } from '@/db/provider';
import { useSettingsStore } from '@/stores/settings';
import { recoverInterruptedDownloads } from '@/services/downloads';
import { syncLibraryUpdateTask } from '@/tasks/library-update';
import { AppThemeProvider, useAppTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

/** Keeps the status bar and Android navigation bar in sync with the active theme. */
function AppChrome() {
  const { themeName } = useAppTheme();

  return (
    <>
      <StatusBar style={themeName === 'light' ? 'dark' : 'light'} />
      {Platform.OS === 'android' ? (
        <NavigationBar style={themeName === 'light' ? 'light' : 'dark'} />
      ) : null}
    </>
  );
}

function RootNavigator() {
  const { palette, themeName } = useAppTheme();

  const navigationTheme = useMemo(() => {
    const base = themeName === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.primary,
        background: palette.background,
        card: palette.backgroundElement,
        text: palette.text,
        border: palette.border,
        notification: palette.danger,
      },
    };
  }, [palette, themeName]);

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" />
        <Stack.Screen name="story/[sourceId]/[id]" />
        <Stack.Screen name="chapters/[sourceId]/[id]" />
        <Stack.Screen
          name="reader/[sourceId]/[novelId]/[chapterId]"
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name="reader/[sourceId]/[id]" options={{ animation: 'fade' }} />
        <Stack.Screen name="downloads/index" />
        <Stack.Screen name="history" />
        <Stack.Screen name="sources" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/appearance" />
        <Stack.Screen name="settings/reader" />
        <Stack.Screen name="settings/advanced" />
        <Stack.Screen name="settings/sources" />
        <Stack.Screen name="settings/narration" />
        <Stack.Screen name="settings/storage" />
        <Stack.Screen name="settings/backup" />
        <Stack.Screen name="settings/about" />
        <Stack.Screen name="restore" />
        <Stack.Screen name="sources" />
        <Stack.Screen name="pronunciation" />
        <Stack.Screen name="export" />
      </Stack>
    </ThemeProvider>
  );
}

function ThemedRoot() {
  const preference = useSettingsStore((state) => state.settings.theme);
  const ageConfirmed = useSettingsStore((state) => state.settings.ageConfirmed);
  const checkForLibraryUpdates = useSettingsStore((state) => state.settings.checkForLibraryUpdates);
  const setSetting = useSettingsStore((state) => state.setSetting);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    void syncLibraryUpdateTask(checkForLibraryUpdates);
  }, [checkForLibraryUpdates]);

  // Runs once, before any download worker can start, so no in-flight run is
  // ever clobbered by the re-queue.
  useEffect(() => {
    void recoverInterruptedDownloads();
  }, []);

  return (
    <AppThemeProvider
      preference={preference}
      onPreferenceChange={(next) => {
        void setSetting('theme', next);
      }}
    >
      <AppChrome />
      <BrowserHost />
      {ageConfirmed ? (
        <RootNavigator />
      ) : (
        <AgeGate onConfirm={() => void setSetting('ageConfirmed', true)} />
      )}
    </AppThemeProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <DatabaseGate>
            <ThemedRoot />
          </DatabaseGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
