import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

export type StepperProps = {
  value: number;
  step?: number;
  onDecrease: () => void;
  onIncrease: () => void;
  /** Setting name announced alongside the decrease/increase buttons. */
  label?: string;
};

export function Stepper({ value, step = 1, onDecrease, onIncrease, label }: StepperProps) {
  const theme = useTheme();
  const display = step < 1 ? value.toFixed(1) : String(value);
  const decreaseLabel = label ? `${t('common.decrease')} ${label}` : t('common.decrease');
  const increaseLabel = label ? `${t('common.increase')} ${label}` : t('common.increase');

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onDecrease}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={decreaseLabel}
        style={[styles.button, { borderColor: theme.border }]}
      >
        <ThemedText type="smallBold">-</ThemedText>
      </Pressable>
      <ThemedText type="small" style={styles.value}>
        {display}
      </ThemedText>
      <Pressable
        onPress={onIncrease}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={increaseLabel}
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
