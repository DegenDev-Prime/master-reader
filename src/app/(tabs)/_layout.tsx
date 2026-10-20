import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme';

const TABS = [
  { name: 'index', title: 'tabs.library', icon: 'library-outline' },
  { name: 'updates', title: 'tabs.updates', icon: 'sync-outline' },
  { name: 'browse', title: 'tabs.browse', icon: 'compass-outline' },
  { name: 'audio', title: 'tabs.audio', icon: 'headset-outline' },
  { name: 'more', title: 'tabs.more', icon: 'ellipsis-horizontal' },
] as const;

export default function TabsLayout() {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: palette.background,
          borderTopColor: palette.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          lineHeight: 16,
        },
        tabBarItemStyle: { minHeight: 48 },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
