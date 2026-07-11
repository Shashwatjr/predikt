import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '../theme/designSystem';

type Props = {
  amount: number;
  label?: string;
};

export default function AuraChip({ amount, label = 'Aura' }: Props) {
  return (
    <View style={styles.chip}>
      <Text style={styles.icon}>✨</Text>
      <Text style={styles.amount}>+{amount}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.45)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  icon: { fontSize: 14 },
  amount: { color: palette.amber, ...typography.bodyBold },
  label: { color: palette.textSecondary, ...typography.caption },
});
