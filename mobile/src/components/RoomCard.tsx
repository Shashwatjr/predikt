import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  roomTitle: string;
  status: string;
  startingPointLabel: string;
  destinationLabel: string;
  inviteCode: string;
  predictionCloseTime?: string;
  onPress?: () => void;
}

function getStatusMeta(status: string, colors: any) {
  const map: Record<string, { color: string; label: string; icon: string }> = {
    predictions_open: { color: colors.green, label: 'Open', icon: '🟢' },
    predictions_locked: { color: colors.amber, label: 'Locked', icon: '🔒' },
    live: { color: colors.red, label: 'LIVE', icon: '🔴' },
    completed: { color: colors.textMuted, label: 'Ended', icon: '✅' },
    cancelled: { color: colors.textMuted, label: 'Cancelled', icon: '✖' },
    created: { color: '#3b82f6', label: 'Created', icon: '📋' },
  };
  return map[status] ?? { color: colors.textMuted, label: status, icon: '•' };
}

function timeRemaining(closeTime?: string): string | null {
  if (!closeTime) return null;
  const diff = new Date(closeTime).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `Closes in ${m}m`;
  const h = Math.floor(m / 60);
  return `Closes in ${h}h ${m % 60}m`;
}

export default function RoomCard({
  roomTitle,
  status,
  startingPointLabel,
  destinationLabel,
  inviteCode,
  predictionCloseTime,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const meta = getStatusMeta(status, colors);
  const countdown = timeRemaining(predictionCloseTime);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Left accent strip */}
      <View style={[styles.accent, { backgroundColor: meta.color }]} />

      <View style={styles.body}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {roomTitle}
          </Text>
          <View style={[styles.badge, { backgroundColor: meta.color + '20', borderColor: meta.color + '60' }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>
              {meta.icon} {meta.label}
            </Text>
          </View>
        </View>

        {/* Route pill */}
        <View style={styles.routeRow}>
          <Text style={[styles.routeDot, { color: colors.green }]}>📍</Text>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>
            {startingPointLabel}
          </Text>
          <Text style={[styles.arrow, { color: colors.textMuted }]}>  →  </Text>
          <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>
            {destinationLabel}
          </Text>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <Text style={{ fontSize: 14 }}>🏁</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={[styles.codePill, { backgroundColor: colors.purpleDim }]}>
            <Text style={[styles.codeText, { color: colors.purple }]}>#{inviteCode}</Text>
          </View>
          {countdown && status === 'predictions_open' && (
            <Text style={[styles.countdown, { color: colors.amber }]}>{countdown}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginVertical: 7,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accent: { width: 4 },
  body: { flex: 1, padding: 14 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontWeight: '700', fontSize: 15, flex: 1, marginRight: 8 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  routeDot: { fontSize: 13 },
  routeLine: { height: 1, width: 6, marginHorizontal: 3 },
  routeLabel: { fontSize: 13, fontWeight: '500' },
  arrow: { fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codePill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  codeText: { fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  countdown: { fontSize: 12, fontWeight: '600' },
});
