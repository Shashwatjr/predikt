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

/** One Google Maps duration_in_traffic reading stored on the room as checkpointEtas. */
export interface CheckpointEta {
  checkpoint?: number;
  etaSeconds?: number | null;
  etaMinutes?: number | null;
  durationInTrafficSeconds?: number | null;
  capturedAt?: string | null;
  source?: string | null;
}

export type CheckpointEtaMap = Record<string, CheckpointEta>;

interface Props {
  board?: CheckpointBoard | null;
  /**
   * Per-milestone ETAs from live-state `checkpointEtas`.
   * Keyed by checkpoint percent ("20", "40", …).
   */
  checkpointEtas?: CheckpointEtaMap | null;
  /**
   * Polled live-state `etaMinutes` for this checkpoint.
   * Used only when that milestone has no stored traffic ETA.
   */
  etaMinutes?: number | null;
}

export function milestoneEtaMinutes(
  checkpoint: number,
  checkpointEtas?: CheckpointEtaMap | null,
  etaMinutes?: number | null,
): number | null {
  const entry = checkpointEtas?.[String(checkpoint)];
  if (entry) {
    if (entry.etaMinutes != null && Number.isFinite(entry.etaMinutes)) {
      return Math.max(0, Math.round(entry.etaMinutes));
    }
    const seconds = entry.durationInTrafficSeconds ?? entry.etaSeconds;
    if (seconds != null && Number.isFinite(seconds)) {
      return Math.max(0, Math.ceil(seconds / 60));
    }
  }
  if (etaMinutes != null && Number.isFinite(etaMinutes)) {
    return Math.max(0, Math.round(etaMinutes));
  }
  return null;
}

function projectedFromMilestone(
  board: Extract<CheckpointBoard, { available: true }>,
  checkpointEtas?: CheckpointEtaMap | null,
): Date {
  const entry = checkpointEtas?.[String(board.checkpoint)];
  const seconds = entry?.durationInTrafficSeconds ?? entry?.etaSeconds;
  if (entry?.capturedAt && seconds != null && Number.isFinite(seconds)) {
    const captured = new Date(entry.capturedAt);
    if (!Number.isNaN(captured.getTime())) {
      return new Date(captured.getTime() + seconds * 1000);
    }
  }
  return new Date(board.projectedArrivalAt);
}

const MEDALS = ['🥇', '🥈', '🥉'];

function offBy(diffSeconds: number): string {
  if (diffSeconds < 60) return `${diffSeconds}s off`;
  const mins = Math.round(diffSeconds / 60);
  return `${mins} min off`;
}

export default function CheckpointLeaderboard({ board, checkpointEtas, etaMinutes }: Props) {
  const { colors } = useTheme();
  if (!board || !board.available || !board.standings.length) return null;

  const milestoneMinutes = milestoneEtaMinutes(board.checkpoint, checkpointEtas, etaMinutes);
  const projected = formatClock(projectedFromMilestone(board, checkpointEtas), false);
  const paceNote =
    milestoneMinutes != null
      ? `Google Maps traffic ETA ${milestoneMinutes} min`
      : board.basis === 'eta_reread'
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
                {s.user?.name ?? 'Player'}
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
