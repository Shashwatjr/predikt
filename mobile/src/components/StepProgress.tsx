import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '../theme/designSystem';

type Props = {
  current: number;
  total: number;
  labels?: [string, string, string];
};

export default function StepProgress({ current, total, labels }: Props) {
  const steps = labels ?? ['Category', 'Mode', 'Setup'];
  return (
    <View style={styles.wrap}>
      <Text style={styles.counter}>
        {current} of {total}
      </Text>
      <View style={styles.bar}>
        {steps.map((label, index) => {
          const step = index + 1;
          const active = step <= current;
          const currentStep = step === current;
          return (
            <View key={label} style={styles.step}>
              <View style={[styles.dot, active && styles.dotActive, currentStep && styles.dotCurrent]} />
              <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.md },
  counter: { color: palette.violetLight, ...typography.label },
  bar: { flexDirection: 'row', gap: spacing.sm },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  dotActive: { backgroundColor: 'rgba(139,92,246,0.5)' },
  dotCurrent: { backgroundColor: palette.violet, borderColor: palette.violetLight },
  label: { color: palette.textMuted, ...typography.micro, textAlign: 'center' },
  labelActive: { color: palette.textSecondary },
});
