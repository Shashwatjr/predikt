import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { formatClock } from '../utils/benchmarks';

export interface CheckpointStanding {
  rank: number;
  userId: string;
  predictedReachedTime: string;
  diffSeconds: number;
  isCurrentUser?: boolean;
  user?: { userId: string; name?: string | null } | null;
}

export type CheckpointBoard =
  | { available: false; checkpoint: number; reason?: string }
  | {
      available: true;
      checkpoint: number;
      basis: 'eta_reread' | 'gps' | 'pace_fallback' | 'plan_fallback';
      projectedArrivalAt: string;
      capturedAt: string;
      standings: CheckpointStanding[];
    };

interface Props {
  board?: CheckpointBoard | null;
}

const MEDALS = ['🥇', '🥈', '🥉'];

function offBy(diffSeconds: number): string {
  if (diffSeconds < 60) return `${diffSeconds}s off`;
  const mins = Math.round(diffSeconds / 60);
  return `${mins} min off`;
}

export default function CheckpointLeaderboard({ board }: Props) {
  const { colors } = useTheme();
  if (!board || !board.available || !board.standings.length) return null;

  const projected = formatClock(new Date(board.projectedArrivalAt), false);
  const paceNote =
    board.basis === 'eta_reread'
      ? 'based on a live ETA re-read'
      : board.basis === 'gps'
        ? 'based on real pace'
        : 'based on elapsed time';

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {board.checkpoint}% checkpoint leaderboard
      </Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        Provisional · {paceNote}, projected arrival {projected}. Real Aura is awarded at the finish.
      </Text>

      {board.standings.map((s, index) => {
        const isCurrent = !!s.isCurrentUser;
        return (
          <View
            key={s.userId}
            style={[
              styles.row,
              {
                backgroundColor: isCurrent ? colors.purpleDim : 'transparent',
                borderColor: isCurrent ? colors.purple : colors.border,
              },
            ]}
          >
            <View style={styles.rankCol}>
              {index < 3 ? (
                <Text style={styles.medal}>{MEDALS[index]}</Text>
              ) : (
                <Text style={[styles.rankNum, { color: colors.textMuted }]}>#{s.rank}</Text>
              )}
            </View>
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {s.user?.name ?? 'My Prediktion user'}
                {isCurrent ? <Text style={{ color: colors.purple }}> (you)</Text> : null}
              </Text>
              <Text style={[styles.guess, { color: colors.textSecondary }]}>
                Guessed {formatClock(new Date(s.predictedReachedTime), false)}
              </Text>
            </View>
            <Text style={[styles.diff, { color: index === 0 ? colors.green : colors.textMuted }]}>
              {offBy(s.diffSeconds)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12, gap: 2 },
  title: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 12, lineHeight: 16, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  rankCol: { width: 34, alignItems: 'center' },
  medal: { fontSize: 20 },
  rankNum: { fontSize: 14, fontWeight: '700' },
  info: { flex: 1, marginLeft: 4 },
  name: { fontWeight: '700', fontSize: 14 },
  guess: { fontSize: 12, marginTop: 1 },
  diff: { fontSize: 13, fontWeight: '800' },
});
