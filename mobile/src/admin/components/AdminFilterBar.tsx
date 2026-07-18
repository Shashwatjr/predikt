import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '../../theme/designSystem';
import type { DatePeriod } from '../types/admin';

type Props = {
  period: DatePeriod;
  onChange: (period: DatePeriod) => void;
};

const OPTIONS: { key: DatePeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
];

export default function AdminFilterBar({ period, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Period</Text>
      {OPTIONS.map((option) => (
        <Pressable
          key={option.key}
          onPress={() => onChange(option.key)}
          style={[styles.pill, period === option.key && styles.pillActive]}
        >
          <Text style={[styles.pillText, period === option.key && styles.pillTextActive]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  label: {
    ...typography.caption,
    color: palette.textMuted,
    marginRight: spacing.xs,
  },
  pill: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: palette.surface,
  },
  pillActive: {
    borderColor: palette.violet,
    backgroundColor: 'rgba(34,211,238,0.15)',
  },
  pillText: {
    ...typography.caption,
    color: palette.textMuted,
  },
  pillTextActive: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
});
