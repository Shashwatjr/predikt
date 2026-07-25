import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import LeaderboardList from '../components/LeaderboardList';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import WebSideWingLayout from '../components/WebSideWingLayout';
import { shareMoment } from '../utils/shareMoment';
import { ResultPayload, RoomBadge } from '../types/engagement';
import RewardChips from '../components/RewardChips';
import SectionHeader from '../components/SectionHeader';
import GuestUpgradePrompt from '../components/GuestUpgradePrompt';
import { getCategoryTheme } from '../config/categoryTheme';
import { featureFlags } from '../config/featureFlags';
import { layout, palette } from '../theme/designSystem';
import RoomPredictionList, { RoomPredictionEntry } from '../components/RoomPredictionList';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Result'>;
  route: RouteProp<RootStackParamList, 'Result'>;
};

type GenericSummaryRow = {
  key: string;
  label: string;
  count: number;
};

export default function ResultScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { roomId, result: initialResult } = route.params;
  const [data, setData] = useState<any[]>(initialResult?.rankings ?? []);
  const [winner, setWinner] = useState<any>(initialResult?.winner ?? null);
  const [room, setRoom] = useState<any>(null);
  const [badges, setBadges] = useState<RoomBadge[]>([]);
  const [predictions, setPredictions] = useState<RoomPredictionEntry[]>(
    (initialResult?.predictionEntries as RoomPredictionEntry[] | undefined) ?? [],
  );

  const [reduceMotion, setReduceMotion] = useState(false);

  const floatY = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const winnerScale = useRef(new Animated.Value(0.94)).current;
  const winnerGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    // Resolve the reduce-motion setting before running the entrance so the
    // async lookup can't race the animation into playing when it shouldn't.
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((rm) => {
        if (!active) return;
        setReduceMotion(rm);
        if (!initialResult) {
          void fetchLeaderboard(rm);
        } else {
          animateAura(rm);
        }
      });
    void fetchRoomAndCommentary();
    void fetchPredictions();
    return () => {
      active = false;
    };
  }, []);

  async function fetchPredictions() {
    try {
      const res = await api.get(`/rooms/${roomId}/predictions`);
      setPredictions((res.data ?? []) as RoomPredictionEntry[]);
    } catch {
      // ignore
    }
  }

  async function fetchRoomAndCommentary() {
    try {
      const [roomRes, badgesRes] = await Promise.allSettled([
        api.get(`/rooms/${roomId}`),
        api.get(`/rooms/${roomId}/badges`),
      ]);

      if (roomRes.status === 'fulfilled') {
        setRoom(roomRes.value.data);
      }
      if (badgesRes.status === 'fulfilled') {
        setBadges(badgesRes.value.data);
      }
    } catch {
      // ignore
    }
  }

  function animateAura(rm = reduceMotion) {
    if (rm) {
      // Reduced motion: snap to the final state, no animation.
      floatOpacity.setValue(0);
      floatY.setValue(0);
      winnerScale.setValue(1);
      winnerGlow.setValue(1);
      return;
    }
    floatOpacity.setValue(1);
    floatY.setValue(0);
    Animated.parallel([
      Animated.timing(floatY, { toValue: -60, duration: 1400, useNativeDriver: true }),
      Animated.timing(floatOpacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
      Animated.timing(winnerScale, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(winnerGlow, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }

  async function fetchLeaderboard(rm = reduceMotion) {
    try {
      const res = await api.get(`/rooms/${roomId}/leaderboard`);
      setData(res.data);
      const top = res.data[0];
      if ((top?.rankInRoom ?? top?.overallRank) === 1) {
        setWinner(top);
        animateAura(rm);
      }
    } catch {
      // ignore
    }
  }

  const podiumTop3 = data.slice(0, 3);
  const winningRow = winner ?? podiumTop3[0];
  const closureState = initialResult?.closureType ?? room?.journeyStatus;
  const isNeutralClosure = ['plan_changed', 'cancelled_by_host', 'auto_closed', 'abandoned'].includes(closureState ?? '');
  const categoryKey = room?.category ?? room?.creationMeta?.category ?? room?.templateKey ?? 'arrival_time';
  const categoryLabel = prettyCategory(categoryKey);
  const actualOutcome = formatActualOutcome(initialResult);
  const winningPrediction = winningRow?.predictedReachedTime
    ? new Date(winningRow.predictedReachedTime).toLocaleString()
    : 'Closest valid guess';
  const winnerHandle = formatWinnerHandle(winningRow);
  const winnerName = winningRow?.name ?? winningRow?.user?.name ?? winnerHandle ?? 'Closest guess';
  const differenceMinutes = winningRow?.differenceFromActualMinutes;
  const differenceLabel = typeof differenceMinutes === 'number' ? `${differenceMinutes.toFixed(1)} min` : 'Closest';
  const auraEarned = winningRow?.totalRoomAura ?? winningRow?.pointsAwarded ?? 0;
  const dotBonus = winningRow?.dotBonus ?? winningRow?.rankBonusAura;
  // The viewer's own reward for this room. Aura is the per-room value we can
  // attribute from the leaderboard; RIZZ/Gems have no per-room source via the
  // Phase 1 endpoints, so only non-zero Aura is surfaced here.
  const myRow = user?.userId
    ? data.find((r: any) => (r.userId ?? r.user?.userId) === user.userId)
    : undefined;
  const myAuraEarned = myRow?.totalRoomAura ?? myRow?.pointsAwarded ?? 0;
  const oracleBotLabel = room?.baselineLabel ?? room?.oracleBotPrediction?.label ?? 'Benchmark only';
  const biggestNearMiss = podiumTop3[1]
    ? `${formatWinnerHandle(podiumTop3[1])} missed by ${
        typeof podiumTop3[1]?.differenceFromActualMinutes === 'number'
          ? `${podiumTop3[1].differenceFromActualMinutes.toFixed(1)} min`
          : 'a little'
      }`
    : 'No near miss this time';
  const momentCard = buildMomentCardFromResult(initialResult as ResultPayload | undefined, categoryKey);
  const badgeUnlocked =
    badges.find((badge) => badge.userId === (winningRow?.userId ?? winningRow?.user?.userId))?.title
    ?? initialResult?.momentCard?.badge
    ?? initialResult?.badges?.[0]?.title
    ?? momentCard.badge;

  async function shareMomentCard() {
    await shareMoment({
      title: `☕ The Tea • ${room?.roomTitle ?? 'My Prediktion'}`,
      subtitle: 'Closest guess wins Aura',
      category: categoryLabel,
      winner: winnerHandle,
      predictionLabel: winningPrediction,
      actualLabel: actualOutcome,
      differenceLabel,
      oracleLabel: oracleBotLabel,
      badge: badgeUnlocked,
      commentary: momentCard.commentary,
      cta: 'Join the next My Prediktion',
      linkLabel: 'Run it back?',
    });
    await api.post('/events', { eventType: 'moment_card_shared', metadata: { roomId, category: categoryKey } }).catch(() => undefined);
  }

  const categoryTheme = getCategoryTheme(categoryKey);
  const genericCategoryKey =
    room?.category ?? room?.creationMeta?.category ?? room?.templateKey ?? categoryKey;
  const isGenericRoom = genericCategoryKey === 'open_prediction';
  const genericOptions =
    Array.isArray(room?.scoringRule?.weatherOptions)
      ? room.scoringRule.weatherOptions.map((option: any) => ({
          key: String(option?.key ?? ''),
          label: String(option?.label ?? option?.key ?? '').replace(/_/g, ' '),
        }))
      : Array.isArray(room?.options)
        ? room.options.map((option: string) => ({
            key: String(option),
            label: String(option).replace(/_/g, ' '),
          }))
      : Array.isArray(room?.creationMeta?.options)
        ? room.creationMeta.options.map((option: string) => ({
            key: String(option),
            label: String(option).replace(/_/g, ' '),
          }))
        : [];
  const genericPredictions = (predictions.length
    ? predictions
    : ((initialResult?.predictionEntries as RoomPredictionEntry[] | undefined) ?? [])
  ).filter(
    (entry) => entry.status !== 'revoked' && !!entry.selectedOptionKey,
  );
  const genericVoteSummary = genericPredictions.reduce<Record<string, number>>((acc, entry) => {
      const key = String(entry.selectedOptionKey);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  const genericSummaryRows: GenericSummaryRow[] =
    Array.isArray(initialResult?.predictionSummary) && initialResult.predictionSummary.length
      ? initialResult.predictionSummary.map((row: { key: string; label: string; count: number }) => ({
          key: String(row.key),
          label: String(row.label),
          count: Number(row.count ?? 0),
        }))
      : genericOptions.length
    ? genericOptions.map((option: { key: string; label: string }) => ({
        key: option.key,
        label: option.label,
        count: genericVoteSummary[option.key] ?? 0,
      }))
    : Object.entries(genericVoteSummary)
        .map(([key, count]) => ({
          key,
          label: key.replace(/_/g, ' '),
          count,
        }))
        .sort((a, b) => b.count - a.count);

  return (
    <WebSideWingLayout rightPlacement="result_side">
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        <SectionHeader title="Results" subtitle={isNeutralClosure ? 'Fair reset — nobody counted as a loss' : categoryTheme.resultTitle} />

        {isGenericRoom ? (
          <View style={[styles.genericTeaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.genericTeaTitle, { color: colors.textPrimary }]}>
              {room?.roomTitle ?? 'Wild Cards'}
            </Text>
            <Text style={[styles.genericTeaSubtitle, { color: colors.textSecondary }]}>
              {room?.question ?? 'Prediction summary'}
            </Text>
            {genericSummaryRows.length ? (
              <View style={styles.genericSummaryWrap}>
                {genericSummaryRows.map((row: GenericSummaryRow) => (
                  <View key={row.key} style={styles.genericSummaryRow}>
                    <Text style={[styles.genericSummaryLabel, { color: colors.textPrimary }]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.genericSummaryCount, { color: colors.purpleLight }]}>
                      {row.count}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <RoomPredictionList data={genericPredictions} title="Prediction board" />
          </View>
        ) : (
          <View style={[styles.genericTeaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.genericTeaTitle, { color: colors.textPrimary }]}>
              {room?.roomTitle ?? 'Result summary'}
            </Text>
            <View style={styles.metricGrid}>
              <MetricCard label="Winner" value={winnerHandle} colors={colors} />
              <MetricCard label="Predicted" value={winningPrediction} colors={colors} />
              <MetricCard label="Actual" value={actualOutcome} colors={colors} />
              <MetricCard label="Difference" value={differenceLabel} colors={colors} />
              <MetricCard label="Near miss" value={biggestNearMiss} colors={colors} />
              <MetricCard label="Badge" value={badgeUnlocked} colors={colors} />
            </View>
            <Text style={[styles.genericTeaSubtitle, { color: colors.textSecondary }]}>
              Benchmark: {oracleBotLabel}
            </Text>
          </View>
        )}

        {!isGenericRoom && dotBonus ? (
          <Text style={[styles.dotBonus, { color: colors.green }]}>Dot Bonus unlocked: {dotBonus}</Text>
        ) : null}

        {!isGenericRoom && winningRow ? (
          <View style={styles.winnerWrapper}>
            <Animated.View style={{ transform: [{ scale: winnerScale }] }}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.winnerGlow,
                  {
                    backgroundColor: colors.amber,
                    shadowColor: colors.amber,
                    opacity: winnerGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
                  },
                ]}
              />
              <LinearGradient colors={colors.gradGold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.winnerCard}>
                <Text style={styles.winnerEmoji}>🏆</Text>
                <Text style={styles.winnerName}>{winnerName}</Text>
                <Text style={styles.winnerDiff}>Closest Guess. Off by {differenceLabel}</Text>
                <View style={styles.xpBadge}>
                  <Text style={styles.xpBadgeText}>+{auraEarned} Aura</Text>
                </View>
              </LinearGradient>
            </Animated.View>
            <Animated.Text style={[styles.floatXp, { transform: [{ translateY: floatY }], opacity: floatOpacity, color: colors.amber }]}>
              +{auraEarned} Aura
            </Animated.Text>
          </View>
        ) : null}

        {myAuraEarned > 0 ? (
          <View style={styles.rewardsEarned}>
            <Text style={[styles.rewardsEarnedLabel, { color: colors.textSecondary }]}>You earned</Text>
            <RewardChips
              aura={myAuraEarned}
              rizz={0}
              gems={0}
              variant="compact"
              onlyNonZero
              showPlus
              animatedStyle={{ opacity: winnerGlow }}
            />
          </View>
        ) : null}

        {!isGenericRoom && podiumTop3.length >= 2 ? (
          <View style={styles.podium}>
            <View style={[styles.podiumCol, { alignSelf: 'flex-end' }]}>
              <Text style={styles.podiumEmoji}>🥈</Text>
              <View style={[styles.podiumBar, { height: 70, backgroundColor: '#94a3b8' }]}>
                <Text style={styles.podiumName} numberOfLines={1}>{podiumTop3[1]?.name ?? podiumTop3[1]?.user?.name}</Text>
                <Text style={styles.podiumXp}>{podiumTop3[1]?.totalRoomAura ?? podiumTop3[1]?.pointsAwarded ?? 0} Aura</Text>
              </View>
            </View>
            <View style={[styles.podiumCol, { alignSelf: 'flex-end' }]}>
              <Text style={styles.podiumEmoji}>🥇</Text>
              <View style={[styles.podiumBar, { height: 100, backgroundColor: colors.amber }]}>
                <Text style={styles.podiumName} numberOfLines={1}>{podiumTop3[0]?.name ?? podiumTop3[0]?.user?.name}</Text>
                <Text style={styles.podiumXp}>{podiumTop3[0]?.totalRoomAura ?? podiumTop3[0]?.pointsAwarded ?? 0} Aura</Text>
              </View>
            </View>
            {podiumTop3[2] ? (
              <View style={[styles.podiumCol, { alignSelf: 'flex-end' }]}>
                <Text style={styles.podiumEmoji}>🥉</Text>
                <View style={[styles.podiumBar, { height: 50, backgroundColor: '#cd7f32' }]}>
                  <Text style={styles.podiumName} numberOfLines={1}>{podiumTop3[2]?.name ?? podiumTop3[2]?.user?.name}</Text>
                  <Text style={styles.podiumXp}>{podiumTop3[2]?.totalRoomAura ?? podiumTop3[2]?.pointsAwarded ?? 0} Aura</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Guest's Tea has resolved — offer to keep their Aura before they bounce. */}
        <GuestUpgradePrompt variant="result" />

        {!isGenericRoom && data.length ? (
          <>
            <Text style={[styles.section, { color: colors.textSecondary }]}>All Rankings</Text>
            <LeaderboardList
              data={data.map((r: any) => ({
                userId: r.userId ?? r.user?.userId,
                name: r.name ?? r.user?.name,
                weeklyAura: r.totalRoomAura ?? r.pointsAwarded,
                winsCount: (r.rankInRoom ?? r.overallRank) === 1 ? 1 : 0,
                rankInRoom: r.rankInRoom ?? r.overallRank,
                differenceFromActualMinutes: r.differenceFromActualMinutes,
                pointsAwarded: r.pointsAwarded,
                totalRoomAura: r.totalRoomAura,
              }))}
              showRoomStats
              currentUserId={user?.userId}
            />
          </>
        ) : null}

        <View style={styles.ctaStack}>
          {featureFlags.momentCardExport ? (
            <PrimaryButton label="Share Moment Card" onPress={shareMomentCard} variant="secondary" icon="✨" />
          ) : null}
          <PrimaryButton label="Back to Home" onPress={() => navigation.navigate('Home')} variant="secondary" icon="🏠" />
        </View>
      </ScrollView>
    </WebSideWingLayout>
  );
}

function MetricCard({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surfaceHigh }]}>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function prettyCategory(category: string) {
  switch (category) {
    case 'weather_rain':
      return 'Weather / Rain';
    case 'food_eta':
      return 'Food ETA';
    case 'whos_late':
      return "Who's Late";
    case 'gym_habit':
      return 'Gym / Habit';
    case 'open_prediction':
      return 'Wild Cards';
    default:
      return 'Arrival Time';
  }
}

function formatWinnerHandle(row: any) {
  const handle = row?.user?.prediktHandle ?? row?.prediktHandle;
  const name = row?.name ?? row?.user?.name ?? 'closest-guess';
  return handle ? `@${String(handle).replace(/^@/, '')}` : `@${String(name).toLowerCase().replace(/\s+/g, '')}`;
}

function formatActualOutcome(result: any) {
  if (!result?.actualOutcome) {
    return 'Result recorded';
  }
  if (result.actualOptionKey) {
    return String(result.actualOutcome).replace(/_/g, ' ');
  }
  return new Date(result.actualOutcome).toLocaleString();
}

function buildMomentCardFromResult(result: ResultPayload | undefined, category: string) {
  if (result?.momentCard?.badge || result?.momentCard?.shareText) {
    return {
      badge: result.momentCard.badge ?? result.momentCard.titles?.[0] ?? 'Closest Guess',
      subtitle: result.momentCard.shareText ?? 'Closest guess wins Aura',
      commentary: 'Result summary is ready to share.',
    };
  }
  return buildFallbackMomentCard(category);
}

function buildFallbackMomentCard(category: string) {
  switch (category) {
    case 'weather_rain':
      return {
        badge: 'Rain Oracle',
        subtitle: 'Forecast Beater',
        commentary: 'Forecast result is ready to share.',
      };
    case 'food_eta':
      return {
        badge: 'Beat the ETA',
        subtitle: 'Delivery Oracle',
        commentary: 'Delivery result is ready to share.',
      };
    case 'whos_late':
      return {
        badge: 'Group Chaos',
        subtitle: 'Time Oracle',
        commentary: 'Group result is ready to share.',
      };
    case 'gym_habit':
      return {
        badge: 'Pattern Breaker',
        subtitle: 'Comeback Solo',
        commentary: 'Progress update is ready to share.',
      };
    case 'open_prediction':
      return {
        badge: 'Wild Cards',
        subtitle: 'Creator-attest MVP lane',
        commentary: 'Creator-attested result is ready to share.',
      };
    default:
      return {
        badge: 'Route Oracle',
        subtitle: 'Closest guess wins Aura',
        commentary: 'Journey result is ready to share.',
      };
  }
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 920, alignSelf: 'center', padding: 20, paddingTop: 28, gap: 16 },
  heading: { fontSize: 26, fontWeight: '800' },
  heroCard: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 12 },
  heroEyebrow: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { fontSize: 24, fontWeight: '900' },
  heroCopy: { fontSize: 14, lineHeight: 20 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { flex: 1, minWidth: 170, borderRadius: 14, padding: 12 },
  metricLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  metricValue: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  dotBonus: { fontSize: 13, lineHeight: 19, fontWeight: '800' },
  genericTeaCard: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12 },
  genericTeaTitle: { fontSize: 20, fontWeight: '900' },
  genericTeaSubtitle: { fontSize: 13, lineHeight: 19 },
  genericSummaryWrap: { gap: 8 },
  genericSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.16)',
  },
  genericSummaryLabel: { fontSize: 14, fontWeight: '800', textTransform: 'capitalize' },
  genericSummaryCount: { fontSize: 16, fontWeight: '900' },
  winnerWrapper: { position: 'relative' },
  rewardsEarned: { alignItems: 'center', gap: 6, marginTop: 6 },
  rewardsEarnedLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  winnerGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 12,
  },
  winnerCard: { borderRadius: 20, padding: 24, alignItems: 'center' },
  winnerEmoji: { fontSize: 52, marginBottom: 8 },
  winnerName: { color: '#fff', fontWeight: '900', fontSize: 24, marginBottom: 4, textAlign: 'center' },
  winnerDiff: { color: 'rgba(255,255,255,0.78)', fontSize: 14 },
  xpBadge: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  xpBadgeText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  floatXp: { position: 'absolute', fontWeight: '900', fontSize: 22, alignSelf: 'center', top: 0 },
  podium: { flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'flex-end' },
  podiumCol: { alignItems: 'center', width: 96 },
  podiumEmoji: { fontSize: 28, marginBottom: 4 },
  podiumBar: { width: '100%', borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 6 },
  podiumName: { color: '#fff', fontWeight: '700', fontSize: 11, textAlign: 'center' },
  podiumXp: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 },
  section: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  ctaStack: { gap: 10, paddingBottom: 24 },
});
