import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Slot rendered after the input, e.g. a clear button. */
  right?: ReactNode;
};

export function TextField({ icon, right, style, ...rest }: TextFieldProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={theme.textMuted} /> : null}
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { color: theme.text }, style]}
        {...rest}
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: MinTouchTarget,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
  },
});
