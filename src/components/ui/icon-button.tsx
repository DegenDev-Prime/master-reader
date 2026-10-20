import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  label: string;
  color?: string;
  size?: number;
  disabled?: boolean;
};

export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 22,
  disabled = false,
}: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Ionicons
        name={icon}
        size={size}
        color={disabled ? theme.textMuted : (color ?? theme.text)}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
