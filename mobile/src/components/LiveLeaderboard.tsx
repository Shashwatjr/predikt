import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { formatClock } from '../utils/benchmarks';

export interface LiveLeaderboardStanding {
  rank: number;
  isWinnerSoFar: boolean;
  userId: string;
  prediktHandle?: string | null;
  predictedReachedTime: string;
  deltaFromBestSeconds: number;
  diffFromProjectedSeconds: number;
  hotTake?: string | null;
  auraEligible?: boolean;
  isCurrentUser?: boolean;
  user?: { userId: string; name?: string | null; prediktHandle?: string | null } | null;
}

export type LiveLeaderboardData =
  | { revealed: false; reason?: string; standings: [] }
  | {
      revealed: true;
      basis: 'snapshot_eta' | 'checkpoint' | 'plan';
      projectedArrivalAt: string;
      capturedAt: string;
      standings: LiveLeaderboardStanding[];
    };

interface Props {
  data?: LiveLeaderboardData | null;
  /** Seconds until the room-wide reveal (from the max edit deadline). Null = unknown. */
  unlockInSeconds?: number | null;
  /** "Lock now" — any participant can reveal instantly. */
  onLockNow?: () => void;
  locking?: boolean;
}

const MEDALS = ['🥇', '🥈', '🥉'];

function deltaLabel(seconds: number): string {
  if (seconds <= 0) return 'best';
  if (seconds < 60) return `+${seconds}s`;
  return `+${Math.round(seconds / 60)} min`;
}

function nameFor(s: LiveLeaderboardStanding): string {
  const handle = s.prediktHandle ?? s.user?.prediktHandle;
  if (handle) return `@${handle}`;
  return s.user?.name ?? 'PREDIKT user';
}

export default function LiveLeaderboard({ data, unlockInSeconds, onLockNow, locking }: Props) {
  const { colors } = useTheme();
  if (!data) return null;

  // Pre-lock: predictions are blurred; show the unlock rule + a Lock-now action.
  if (!data.revealed) {
    const countdown =
      unlockInSeconds != null && unlockInSeconds > 0
        ? `Unlocks in ${unlockInSeconds}s`
        : null;
    return (
      <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>🔒 Predictions locked in</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Predictions unlock 1 minute after the last guess or when someone locks in.
          {countdown ? ` ${countdown}.` : ''}
        </Text>
        {onLockNow ? (
          <Pressable
            onPress={onLockNow}
            disabled={locking}
            style={[styles.lockBtn, { borderColor: colors.purple, backgroundColor: colors.purpleDim }]}
          >
            {locking ? (
              <ActivityIndicator color={colors.purple} />
            ) : (
              <Text style={[styles.lockBtnText, { color: colors.purple }]}>Lock now &amp; reveal</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!data.standings.length) return null;
  const projected = formatClock(new Date(data.projectedArrivalAt), false);
  const paceNote =
    data.basis === 'snapshot_eta'
      ? 'based on a live ETA re-read'
      : data.basis === 'checkpoint'
        ? 'based on real pace'
        : 'based on the planned route';

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Live leaderboard</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        Provisional · {paceNote}, projected arrival {projected}. Real Aura is awarded at the finish.
      </Text>

      {data.standings.map((s, index) => {
        const isCurrent = !!s.isCurrentUser;
        const highlight = s.isWinnerSoFar;
        return (
          <View
            key={s.userId}
            style={[
              styles.row,
              {
                backgroundColor: highlight
                  ? colors.greenDim ?? colors.purpleDim
                  : isCurrent
                    ? colors.purpleDim
                    : 'transparent',
                borderColor: highlight ? colors.green : isCurrent ? colors.purple : colors.border,
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
                {nameFor(s)}
                {isCurrent ? <Text style={{ color: colors.purple }}> (you)</Text> : null}
                {highlight ? <Text style={{ color: colors.green }}> · winning</Text> : null}
              </Text>
              <Text style={[styles.guess, { color: colors.textSecondary }]}>
                Guessed {formatClock(new Date(s.predictedReachedTime), false)}
                {s.auraEligible === false ? ' · late' : ''}
              </Text>
              {s.hotTake ? (
                <Text style={[styles.hotTake, { color: colors.textMuted }]} numberOfLines={1}>
                  “{s.hotTake}”
                </Text>
              ) : null}
            </View>
            <Text style={[styles.diff, { color: index === 0 ? colors.green : colors.textMuted }]}>
              {deltaLabel(s.deltaFromBestSeconds)}
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
  lockBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  lockBtnText: { fontWeight: '800', fontSize: 14 },
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
  hotTake: { fontSize: 12, marginTop: 1, fontStyle: 'italic' },
  diff: { fontSize: 13, fontWeight: '800' },
});
