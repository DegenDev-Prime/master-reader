import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StepperProps = {
  value: number;
  step?: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function Stepper({ value, step = 1, onDecrease, onIncrease }: StepperProps) {
  const theme = useTheme();
  const display = step < 1 ? value.toFixed(1) : String(value);

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onDecrease}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        style={[styles.button, { borderColor: theme.border }]}
      >
        <ThemedText type="smallBold">-</ThemedText>
      </Pressable>
      <ThemedText type="small" style={styles.value}>
        {display}
      </ThemedText>
      <Pressable
        onPress={onIncrease}
        accessibilityRole="button"
        accessibilityLabel="Increase"
        style={[styles.button, { borderColor: theme.border }]}
      >
        <ThemedText type="smallBold">+</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  button: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
  value: { minWidth: 32, textAlign: 'center' },
});
