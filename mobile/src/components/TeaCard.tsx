import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CategoryTheme } from '../config/categoryTheme';
import { cardStyle, palette, spacing, typography } from '../theme/designSystem';

type Metric = { label: string; value: string };
type Reward = { label: 'Aura' | 'RIZZ' | 'Gems'; value: string };

type Props = {
  roomTitle: string;
  category: CategoryTheme;
  winnerHandle: string;
  metrics: Metric[];
  rewards: Reward[];
  neutral?: boolean;
};

export default function TeaCard({
  roomTitle,
  category,
  winnerHandle,
  metrics,
  rewards,
  neutral,
}: Props) {
  return (
    <View style={[cardStyle('elevated'), styles.card, { borderColor: `${category.primaryColor}44` }]}>
      <Text style={styles.eyebrow}>THE TEA</Text>
      <Text style={[styles.categoryLabel, { color: category.primaryColor }]}>{category.label}</Text>
      <Text style={styles.hero}>
        {neutral ? 'Journey closed fairly' : `${winnerHandle} takes the Aura`}
      </Text>
      {rewards.length ? (
        <View style={styles.rewardRow}>
          {rewards.map((reward) => (
            <View key={reward.label} style={styles.rewardChip}>
              <Text style={styles.rewardLabel}>{reward.label}</Text>
              <Text style={styles.rewardValue}>{reward.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.metricStack}>
        {metrics.slice(0, 3).map((m) => (
          <View key={m.label} style={styles.metricRow}>
            <Text style={styles.metricLabel}>{m.label}</Text>
            <Text style={styles.metricValue}>{m.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  eyebrow: { color: palette.violetLight, ...typography.label },
  categoryLabel: { ...typography.bodyBold },
  hero: { color: palette.textPrimary, ...typography.h2 },
  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rewardChip: {
    minWidth: 92,
    backgroundColor: palette.surfaceHigh,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 2,
  },
  rewardLabel: { color: palette.textMuted, ...typography.micro },
  rewardValue: { color: palette.textPrimary, ...typography.caption, fontWeight: '900' },
  metricStack: { gap: 8 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  metricLabel: { color: palette.textMuted, ...typography.micro },
  metricValue: { color: palette.textPrimary, ...typography.caption, fontWeight: '800', flex: 1, textAlign: 'right' },
});
