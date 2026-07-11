import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CategoryTheme } from '../config/categoryTheme';
import { cardStyle, palette, spacing, typography } from '../theme/designSystem';
import StatusPill from './StatusPill';
import ProgressBar from './ProgressBar';

type Props = {
  theme: CategoryTheme;
  title: string;
  statusLabel: string;
  statusTone?: 'live' | 'success' | 'warning' | 'default';
  etaLabel?: string;
  myPredictionLabel?: string;
  progress?: number;
  oracleLabel?: string;
  participantCount?: number;
  lifecycleNote?: string;
};

export default function LiveStatusCard({
  theme,
  title,
  statusLabel,
  statusTone = 'live',
  etaLabel,
  myPredictionLabel,
  progress,
  oracleLabel,
  participantCount,
  lifecycleNote,
}: Props) {
  return (
    <View style={[cardStyle('elevated'), styles.card, { borderColor: `${theme.primaryColor}33` }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{theme.icon}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <StatusPill label={statusLabel} tone={statusTone} />
      </View>
      {typeof progress === 'number' ? <ProgressBar percentage={progress} label="Approximate progress" /> : null}
      {etaLabel ? <Text style={styles.meta}>ETA: {etaLabel}</Text> : null}
      {myPredictionLabel ? <Text style={[styles.prediction, { color: theme.primaryColor }]}>My prediction: {myPredictionLabel}</Text> : null}
      {oracleLabel ? <Text style={styles.meta}>Oracle Bot: {oracleLabel}</Text> : null}
      {typeof participantCount === 'number' ? <Text style={styles.meta}>{participantCount} participants</Text> : null}
      {lifecycleNote ? <Text style={styles.note}>{lifecycleNote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { fontSize: 22 },
  title: { color: palette.textPrimary, ...typography.bodyBold, flex: 1 },
  meta: { color: palette.textSecondary, ...typography.caption },
  prediction: { ...typography.bodyBold },
  note: { color: palette.violetLight, ...typography.caption },
});
