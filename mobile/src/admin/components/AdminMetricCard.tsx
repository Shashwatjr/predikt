import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '../../theme/designSystem';

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'warning' | 'success';
};

export default function AdminMetricCard({ label, value, hint, tone = 'default' }: Props) {
  const toneColor =
    tone === 'warning' ? '#f59e0b' : tone === 'success' ? '#22c55e' : palette.textPrimary;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: toneColor }]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minWidth: 140,
    flex: 1,
  },
  label: {
    ...typography.caption,
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  hint: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
});
