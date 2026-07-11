import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CategoryTheme } from '../config/categoryTheme';
import { cardStyle, palette, spacing, typography } from '../theme/designSystem';
import BadgeChip from './BadgeChip';
import AuraChip from './AuraChip';

type Metric = { label: string; value: string };

type Props = {
  roomTitle: string;
  category: CategoryTheme;
  winnerHandle: string;
  metrics: Metric[];
  oracleLabel: string;
  badge?: string;
  auraEarned?: number;
  neutral?: boolean;
};

export default function TeaCard({
  roomTitle,
  category,
  winnerHandle,
  metrics,
  oracleLabel,
  badge,
  auraEarned,
  neutral,
}: Props) {
  return (
    <View style={[cardStyle('elevated'), styles.card, { borderColor: `${category.primaryColor}44` }]}>
      <Text style={styles.eyebrow}>☕ THE TEA</Text>
      <Text style={styles.roomTitle}>{roomTitle}</Text>
      <View style={styles.categoryRow}>
        <Text style={styles.categoryIcon}>{category.icon}</Text>
        <Text style={[styles.categoryLabel, { color: category.primaryColor }]}>{category.label}</Text>
      </View>
      <Text style={styles.hero}>
        {neutral ? 'Journey closed fairly' : `${winnerHandle} takes the Aura`}
      </Text>
      <View style={styles.metricGrid}>
        {metrics.map((m) => (
          <View key={m.label} style={styles.metric}>
            <Text style={styles.metricLabel}>{m.label}</Text>
            <Text style={styles.metricValue}>{m.value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.oracle}>Oracle Bot: {oracleLabel}</Text>
      <View style={styles.badges}>
        {badge ? <BadgeChip label={badge} icon="🏅" color={category.primaryColor} /> : null}
        {auraEarned ? <AuraChip amount={auraEarned} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  eyebrow: { color: palette.violetLight, ...typography.label },
  roomTitle: { color: palette.textSecondary, ...typography.caption },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  categoryIcon: { fontSize: 18 },
  categoryLabel: { ...typography.bodyBold },
  hero: { color: palette.textPrimary, ...typography.h2 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: {
    width: '47%',
    backgroundColor: palette.surfaceHigh,
    borderRadius: 12,
    padding: spacing.md,
    gap: 4,
  },
  metricLabel: { color: palette.textMuted, ...typography.micro },
  metricValue: { color: palette.textPrimary, ...typography.caption, fontWeight: '800' },
  oracle: { color: palette.textSecondary, ...typography.caption },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
