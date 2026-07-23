import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { formatClock } from '../utils/benchmarks';

export interface RoomPredictionEntry {
  predictionId: string;
  status: 'visible' | 'submitted' | 'revoked';
  predictedReachedTime?: string | null;
  editDeadline?: string | null;
  selectedOptionKey?: string | null;
  isCurrentUser?: boolean;
  // v2 (checkpoint_leaderboard_v2): a guess locked after the 80% checkpoint is
  // Rizz-tier — accepted and shown, but out of the winner / Aura running.
  auraEligible?: boolean;
  lockedCheckpoint?: number | null;
  user?: {
    userId: string;
    name?: string | null;
    prediktHandle?: string | null;
    avatarKey?: string | null;
  } | null;
  checkpointRank?: number;
  checkpointDiffSeconds?: number;
}

interface Props {
  data: RoomPredictionEntry[];
  title?: string;
  checkpointLabel?: string | null;
}

function initials(name?: string | null): string {
  const clean = (name ?? '').replace(/^@/, '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function offBy(diffSeconds: number): string {
  if (diffSeconds < 60) return `${diffSeconds}s off`;
  const mins = Math.round(diffSeconds / 60);
  return `${mins} min off`;
}

export default function RoomPredictionList({ data, title, checkpointLabel }: Props) {
  const { colors } = useTheme();
  if (!data.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.header, { color: colors.textSecondary }]}>
        {title ?? `In this room · ${data.length} ${data.length === 1 ? 'guess' : 'guesses'}`}
      </Text>
      {checkpointLabel ? (
        <Text style={[styles.subheader, { color: colors.textMuted }]}>
          Ranked by closest to the projected ETA at {checkpointLabel}.
        </Text>
      ) : null}
      {data.map((entry) => {
        const isCurrent = !!entry.isCurrentUser;
        const name = entry.user?.name ?? 'My Prediktion user';
        const choiceLabel = entry.selectedOptionKey
          ? String(entry.selectedOptionKey).replace(/_/g, ' ')
          : null;
        return (
          <View
            key={entry.predictionId}
            style={[
              styles.row,
              {
                backgroundColor: isCurrent ? colors.purpleDim : colors.surface,
                borderColor: isCurrent ? colors.purple : colors.border,
              },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.purple + '22', borderColor: colors.purple + '55' }]}>
              <Text style={[styles.avatarText, { color: colors.purple }]}>{initials(name)}</Text>
            </View>

            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {entry.checkpointRank ? <Text style={{ color: colors.textMuted }}>#{entry.checkpointRank} </Text> : null}
                {name}
                {isCurrent ? <Text style={{ color: colors.purple }}> (you)</Text> : null}
              </Text>
              {choiceLabel ? (
                <Text style={[styles.choice, { color: colors.textSecondary }]} numberOfLines={1}>
                  Predicted: <Text style={[styles.choiceValue, { color: colors.textPrimary }]}>{choiceLabel}</Text>
                </Text>
              ) : null}
              {entry.auraEligible === false ? (
                <View style={[styles.rizzTag, { backgroundColor: colors.amber + '22', borderColor: colors.amber + '66' }]}>
                  <Text style={[styles.rizzText, { color: colors.amber }]}>Rizz-tier · no Aura</Text>
                </View>
              ) : null}
              {entry.checkpointDiffSeconds != null ? (
                <Text style={[styles.rankNote, { color: colors.textMuted }]}>
                  {offBy(entry.checkpointDiffSeconds)} vs projected ETA
                </Text>
              ) : null}
            </View>

            {entry.status === 'visible' && entry.predictedReachedTime ? (
              <View style={[styles.chip, { backgroundColor: colors.greenDim }]}>
                <Text style={[styles.chipText, { color: colors.green }]}>
                  {formatClock(new Date(entry.predictedReachedTime), false)}
                </Text>
              </View>
            ) : entry.status === 'visible' && entry.selectedOptionKey ? (
              <View style={[styles.chip, { backgroundColor: colors.greenDim }]}>
                <Text style={[styles.chipText, { color: colors.green }]}>
                  {String(entry.selectedOptionKey).replace(/_/g, ' ')}
                </Text>
              </View>
            ) : entry.status === 'revoked' ? (
              <Text style={[styles.muted, { color: colors.textMuted }]}>Withdrew</Text>
            ) : (
              <Text style={[styles.muted, { color: colors.textMuted }]}>🔒 Locked in</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, marginTop: 8 },
  header: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 },
  subheader: { fontSize: 11, lineHeight: 16, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800' },
  info: { flex: 1, marginLeft: 10 },
  name: { fontWeight: '700', fontSize: 14 },
  choice: { marginTop: 3, fontSize: 12, lineHeight: 17, fontWeight: '600', textTransform: 'capitalize' },
  choiceValue: { fontWeight: '800' },
  rankNote: { marginTop: 3, fontSize: 11, fontWeight: '700' },
  rizzTag: { alignSelf: 'flex-start', marginTop: 3, borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  rizzText: { fontSize: 10, fontWeight: '800' },
  chip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontWeight: '800', fontSize: 14 },
  muted: { fontSize: 13, fontWeight: '700' },
});
