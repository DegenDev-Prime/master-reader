import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function Cover({
  uri,
  title,
  width,
  radius = 0,
}: {
  uri?: string | null;
  title: string;
  width: number;
  radius?: number;
}) {
  const theme = useTheme();
  const height = Math.round(width * 1.5);

  return (
    <View
      style={[
        styles.frame,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          height,
          width,
          borderRadius: radius,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name="book-outline" size={Math.round(width * 0.3)} color={theme.textMuted} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  fallback: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
