import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface LeaderboardEntry {
  userId: string;
  name: string;
  prediktHandle?: string | null;
  weeklyAura?: number;
  totalAura?: number;
  winsCount?: number;
  rankInRoom?: number;
  differenceFromActualMinutes?: number;
  pointsAwarded?: number;
  totalRoomAura?: number;
  totalRoomClout?: number;
}

interface Props {
  data: LeaderboardEntry[];
  showRoomStats?: boolean;
  currentUserId?: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const RANK_BORDER = (colors: any) => ['#f59e0b', '#94a3b8', '#cd7f32'];

export default function LeaderboardList({ data, showRoomStats = false, currentUserId }: Props) {
  const { colors } = useTheme();

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.userId}
      scrollEnabled={false}
      renderItem={({ item, index }) => {
        const isTop3 = index < 3;
        const isCurrent = item.userId === currentUserId;
        const rankColor = isTop3 ? RANK_BORDER(colors)[index] : colors.textMuted;

        return (
          <View
            style={[
              styles.row,
              {
                backgroundColor: isCurrent ? colors.purpleDim : colors.surface,
                borderColor: isCurrent ? colors.purple : colors.border,
                borderLeftColor: rankColor,
              },
            ]}
          >
            {/* Rank medal / number */}
            <View style={styles.rankCol}>
              {isTop3 ? (
                <Text style={styles.medal}>{MEDALS[index]}</Text>
              ) : (
                <Text style={[styles.rankNum, { color: colors.textMuted }]}>#{index + 1}</Text>
              )}
            </View>

            {/* Info */}
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.textPrimary }]}>
                {item.name}
                {isCurrent && (
                  <Text style={{ color: colors.purple }}> (you)</Text>
                )}
              </Text>
              {showRoomStats ? (
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  Off by {item.differenceFromActualMinutes?.toFixed(1) ?? '—'} min
                </Text>
              ) : (
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  {item.winsCount ?? 0} win{(item.winsCount ?? 0) !== 1 ? 's' : ''}
                </Text>
              )}
            </View>

            <View style={[styles.xpChip, { backgroundColor: isTop3 ? colors.gradGold[0] + '20' : colors.greenDim }]}>
              <Text style={[styles.xpText, { color: isTop3 ? colors.amber : colors.green }]}>
                {showRoomStats
                  ? `${item.totalRoomAura ?? item.pointsAwarded ?? 0} Aura`
                  : `${item.weeklyAura ?? 0} Aura`}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  rankCol: { width: 40, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { fontSize: 15, fontWeight: '700' },
  info: { flex: 1, marginLeft: 4 },
  name: { fontWeight: '700', fontSize: 15 },
  sub: { fontSize: 12, marginTop: 2 },
  xpChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  xpText: { fontWeight: '800', fontSize: 14 },
});
