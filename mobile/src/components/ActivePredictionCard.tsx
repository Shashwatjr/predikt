import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ProgressBar from './ProgressBar';
import { botEtaTeaser } from '../utils/botVoice';
import { palette, radius, spacing, typography } from '../theme/designSystem';

type ActivePrediction = {
  roomId: string;
  title: string;
  status: string;
  participantCount: number;
  hasSubmittedPrediction: boolean;
  routeSummary?: {
    startLabel?: string | null;
    destinationLabel?: string | null;
    travelMode?: string | null;
  } | null;
  liveProgress: {
    statusLabel: string;
    progressPercentApprox: number;
    etaLabel: string;
    etaTime?: string | null;
    etaVsMyPredictionLabel?: string | null;
    timeToDestinationLabel?: string | null;
    lifecycleLabel?: string | null;
  };
  quickAction: {
    label: string;
  };
  pinned: boolean;
};

type Props = {
  item: ActivePrediction;
  onOpen: () => void;
  onTogglePin: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
};

export default function ActivePredictionCard({
  item,
  onOpen,
  onTogglePin,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
}: Props) {
  const { colors } = useTheme();
  // Live-Now cards speak in the bot's voice instead of dropping a bare ETA number,
  // so a first-timer instantly reads it as "the mark to beat".
  const botLine =
    item.status === 'live'
      ? botEtaTeaser(item.liveProgress.etaTime ?? item.liveProgress.etaLabel)
      : null;

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={[styles.meta, { color: 'rgba(255,255,255,0.68)' }]}>
            {item.liveProgress.statusLabel} • {item.participantCount} participants
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.purpleDim }]}>
          <Text style={[styles.badgeText, { color: colors.purpleLight }]}>{item.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      <Text style={[styles.route, { color: 'rgba(255,255,255,0.82)' }]}>
        {item.routeSummary?.startLabel ?? 'Start'} → {item.routeSummary?.destinationLabel ?? 'Destination'}
      </Text>

      <ProgressBar percentage={item.liveProgress.progressPercentApprox} label="Approximate progress" />

      <View style={styles.infoRow}>
        <Text style={[styles.infoText, { color: 'rgba(255,255,255,0.72)' }]}>
          {item.liveProgress.etaLabel}{item.liveProgress.etaTime ? `: ${item.liveProgress.etaTime}` : ''}
        </Text>
        <Text style={[styles.infoText, { color: 'rgba(255,255,255,0.58)' }]}>
          {item.liveProgress.timeToDestinationLabel ?? (item.hasSubmittedPrediction ? 'Prediction submitted' : 'Needs your prediction')}
        </Text>
      </View>

      <Text style={[styles.predictionLabel, { color: item.hasSubmittedPrediction ? colors.green : '#fbbf24' }]}>
        {item.liveProgress.etaVsMyPredictionLabel ?? (item.hasSubmittedPrediction ? 'Prediction submitted' : 'Needs your prediction')}
      </Text>

      {botLine ? (
        <Text style={styles.botLine}>🤖 {botLine}</Text>
      ) : null}

      {item.liveProgress.lifecycleLabel ? (
        <Text style={[styles.lifecycleLabel, { color: '#A5F3FC' }]}>{item.liveProgress.lifecycleLabel}</Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.purple }]} onPress={onOpen}>
          <Text style={styles.primaryActionText}>{item.quickAction.label}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconAction} onPress={onTogglePin}>
          <Text style={styles.iconActionText}>{item.pinned ? 'Unpin' : 'Pin'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconAction, disableMoveUp && styles.iconActionDisabled]} onPress={onMoveUp} disabled={disableMoveUp}>
          <Text style={styles.iconActionText}>Up</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconAction, disableMoveDown && styles.iconActionDisabled]} onPress={onMoveDown} disabled={disableMoveDown}>
          <Text style={styles.iconActionText}>Down</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  headerText: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '900' },
  meta: { fontSize: 11, marginTop: 3, fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: '900', textTransform: 'capitalize' },
  route: { fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  infoText: { fontSize: 11, flex: 1 },
  predictionLabel: { fontSize: 12, fontWeight: '800' },
  botLine: { color: palette.violetLight, fontSize: 12, fontWeight: '800', fontStyle: 'italic' },
  lifecycleLabel: { fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  primaryAction: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  primaryActionText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  iconAction: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconActionText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  iconActionDisabled: { opacity: 0.45 },
});
