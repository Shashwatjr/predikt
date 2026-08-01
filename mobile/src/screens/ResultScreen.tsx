import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
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
import { deriveArrivalBenchmarks, formatClock } from '../utils/benchmarks';

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
  const revealPulse = useRef(new Animated.Value(0)).current;

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
      revealPulse.setValue(1);
      return;
    }
    Animated.timing(revealPulse, { toValue: 1, duration: 450, useNativeDriver: true }).start();
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
  const benchmarks = deriveArrivalBenchmarks(room);
  const actualDate =
    initialResult?.actualOutcome && !initialResult?.actualOptionKey
      ? new Date(initialResult.actualOutcome)
      : null;
  const actualTimeLabel =
    actualDate && !Number.isNaN(actualDate.getTime())
      ? formatClock(actualDate, false)
      : actualOutcome;
  const predictionByUserId = new Map(
    predictions
      .filter((entry) => entry.status !== 'revoked')
      .map((entry) => [entry.user?.userId, entry] as const)
      .filter(([userId]) => !!userId),
  );
  const leaderboardSource =
    data.length > 0
      ? data
      : predictions
          .filter((entry) => entry.status !== 'revoked')
          .map((entry, index) => ({
            userId: entry.user?.userId ?? `prediction-${index}`,
            user: entry.user ?? null,
            name:
              entry.user?.prediktHandle
                ? `@${entry.user.prediktHandle.replace(/^@/, '')}`
                : entry.user?.name ?? (entry.isCurrentUser ? 'You' : 'Guest'),
            prediktHandle: entry.user?.prediktHandle ?? null,
            predictedReachedTime: entry.predictedReachedTime ?? null,
            differenceFromActualMinutes: null,
            totalRoomAura: 0,
            pointsAwarded: 0,
            rankInRoom: index + 1,
            overallRank: index + 1,
            isCurrentUser: !!entry.isCurrentUser,
            auraEligible: entry.auraEligible,
          }));
  const rankingRows = leaderboardSource.map((row: any, index: number) => {
    const userId = row.userId ?? row.user?.userId;
    const prediction = userId ? predictionByUserId.get(userId) : null;
    const predictedAt = prediction?.predictedReachedTime
      ? new Date(prediction.predictedReachedTime)
      : row.predictedReachedTime
        ? new Date(row.predictedReachedTime)
        : null;
    return {
      key: String(userId ?? `rank-${index}`),
      rank: row.rankInRoom ?? row.overallRank ?? index + 1,
      name: formatWinnerHandle(row),
      initials: (row.name ?? row.user?.name ?? row.prediktHandle ?? row.user?.prediktHandle ?? 'P')
        .replace(/^@/, '')
        .trim()
        .charAt(0)
        .toUpperCase(),
      isCurrentUser: row.isCurrentUser || userId === user?.userId,
      predictionLabel:
        predictedAt && !Number.isNaN(predictedAt.getTime())
          ? formatClock(predictedAt, false)
          : 'Prediction hidden',
      differenceLabel: isNeutralClosure
        ? 'Fair reset'
        : formatDifferenceFromActual(predictedAt, actualDate, row.differenceFromActualMinutes),
      auraLabel: `${row.totalRoomAura ?? row.pointsAwarded ?? 0} Aura`,
      rizzLabel: (prediction?.auraEligible ?? row.auraEligible) === false ? 'Rizz-tier' : 'Aura eligible',
      isWinner: !isNeutralClosure && (row.rankInRoom ?? row.overallRank ?? index + 1) === 1,
      medal:
        !isNeutralClosure && (row.rankInRoom ?? row.overallRank ?? index + 1) === 1
          ? '🥇'
          : !isNeutralClosure && (row.rankInRoom ?? row.overallRank ?? index + 1) === 2
            ? '🥈'
            : !isNeutralClosure && (row.rankInRoom ?? row.overallRank ?? index + 1) === 3
              ? '🥉'
              : null,
    };
  });
  const comparisonRows = [
    benchmarks?.maps
      ? {
          key: 'maps',
          title: benchmarks.maps.label || 'Google Maps',
          value: formatClock(benchmarks.maps.date, false),
          difference: formatDifferenceFromActual(benchmarks.maps.date, actualDate, null),
          note: benchmarks.maps.verified ? 'Verified route ETA' : 'Approximate route estimate',
        }
      : null,
    benchmarks?.oracle
      ? {
          key: 'bot',
          title: benchmarks.oracle.label || 'The bot',
          value: formatClock(benchmarks.oracle.date, false),
          difference: formatDifferenceFromActual(benchmarks.oracle.date, actualDate, null),
          note: 'Bot prediction',
        }
      : null,
    benchmarks?.host
      ? {
          key: 'host',
          title: 'Creator call',
          value: formatClock(benchmarks.host.date, false),
          difference: formatDifferenceFromActual(benchmarks.host.date, actualDate, null),
          note: 'Host prediction on record',
        }
      : null,
    winningRow
      ? {
          key: 'winner',
          title: 'Winning guess',
          value:
            predictionByUserId.get(winningRow.userId ?? winningRow.user?.userId)?.predictedReachedTime
              ? formatClock(
                  new Date(
                    predictionByUserId.get(winningRow.userId ?? winningRow.user?.userId)!.predictedReachedTime!,
                  ),
                  false,
                )
              : winningPrediction,
          difference:
            typeof differenceMinutes === 'number'
              ? differenceMinutes === 0
                ? '0 min'
                : `${differenceMinutes.toFixed(1)} min off`
              : differenceLabel,
          note: `by ${winnerHandle}`,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; title: string; value: string; difference: string; note: string }>;
  const currentUserPrediction = user?.userId ? predictionByUserId.get(user.userId) : null;
  const myRizzStatus = currentUserPrediction?.auraEligible === false ? 'Rizz-tier · no Aura' : 'Aura eligible';
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
          <>
            <LinearGradient
              colors={['rgba(124,58,237,0.26)', 'rgba(15,21,39,0.98)', 'rgba(59,130,246,0.16)']}
              style={[styles.resultsHero, { borderColor: colors.border }]}
            >
              <Text style={styles.resultsHeroTitle}>{room?.roomTitle ?? 'Journey results'}</Text>
              <View style={styles.resultsStatGrid}>
                <ResultStatCard
                  eyebrow="Winner"
                  value={winnerHandle}
                  note={isNeutralClosure ? 'Fair reset in effect' : 'Closest valid guess'}
                  accent="#FBBF24"
                />
                <ResultStatCard
                  eyebrow="Actual"
                  value={actualTimeLabel}
                  note="Recorded finish"
                  accent="#8B5CF6"
                />
                <ResultStatCard
                  eyebrow="Difference"
                  value={differenceLabel}
                  note={typeof differenceMinutes === 'number' && differenceMinutes === 0 ? 'Perfect call' : 'Closest margin'}
                  accent="#4ADE80"
                />
                <ResultStatCard
                  eyebrow="Aura"
                  value={`+${auraEarned}`}
                  note="Winner reward"
                  accent="#38BDF8"
                />
                <ResultStatCard
                  eyebrow="RIZZ"
                  value={myRizzStatus}
                  note="Prediction outcomes do not mint RIZZ"
                  accent="#C084FC"
                />
                <ResultStatCard
                  eyebrow="Badge"
                  value={badgeUnlocked}
                  note={biggestNearMiss}
                  accent="#A78BFA"
                />
              </View>
              <Text style={[styles.resultsBenchmarkNote, { color: colors.textSecondary }]}>
                Benchmark: {oracleBotLabel}
              </Text>
            </LinearGradient>

            {comparisonRows.length ? (
              <View style={[styles.comparisonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.comparisonHeader}>
                  <Text style={[styles.comparisonTitle, { color: colors.textPrimary }]}>Compared with Maps, bot and creator</Text>
                  <Text style={[styles.comparisonMeta, { color: colors.textSecondary }]}>Against the final arrival at {actualTimeLabel}</Text>
                </View>
                <View style={styles.comparisonGrid}>
                  {comparisonRows.map((item) => (
                    <View key={item.key} style={[styles.comparisonTile, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                      <Text style={[styles.comparisonTileTitle, { color: colors.textSecondary }]}>{item.title}</Text>
                      <Text style={[styles.comparisonTileValue, { color: colors.textPrimary }]}>{item.value}</Text>
                      <Text style={[styles.comparisonTileDiff, { color: colors.purpleLight }]}>{item.difference}</Text>
                      <Text style={[styles.comparisonTileNote, { color: colors.textSecondary }]}>{item.note}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}

        {!isGenericRoom && dotBonus ? (
          <Text style={[styles.dotBonus, { color: colors.green }]}>Dot Bonus unlocked: {dotBonus}</Text>
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
              animatedStyle={{ opacity: revealPulse }}
            />
          </View>
        ) : null}

        {/* Guest's Tea has resolved — offer to keep their Aura before they bounce. */}
        <GuestUpgradePrompt variant="result" />

        {!isGenericRoom && rankingRows.length ? (
          <View style={[styles.rankingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.rankingsHeader}>
              <Text style={[styles.rankingsTitle, { color: colors.textPrimary }]}>All participants</Text>
              <Text style={[styles.rankingsMeta, { color: colors.textSecondary }]}>
                {rankingRows.length} predictions ranked by closeness to the actual arrival
              </Text>
            </View>
            <View style={[styles.rankingsTableHead, { borderColor: colors.border }]}>
              <Text style={[styles.rankingsHeadCell, styles.rankCol, { color: colors.textSecondary }]}>Rank</Text>
              <Text style={[styles.rankingsHeadCell, styles.playerCol, { color: colors.textSecondary }]}>Participant</Text>
              <Text style={[styles.rankingsHeadCell, styles.predictionCol, { color: colors.textSecondary }]}>Prediction</Text>
              <Text style={[styles.rankingsHeadCell, styles.diffCol, { color: colors.textSecondary }]}>Score</Text>
              <Text style={[styles.rankingsHeadCell, styles.rewardCol, { color: colors.textSecondary }]}>Rewards</Text>
            </View>
            <View style={styles.rankingsBody}>
              {rankingRows.map((row) => (
                <View
                  key={row.key}
                  style={[
                    styles.rankingsRow,
                    {
                      borderColor: row.isWinner ? 'rgba(251,191,36,0.45)' : colors.border,
                      backgroundColor: row.isWinner ? 'rgba(251,191,36,0.08)' : colors.surfaceHigh,
                    },
                  ]}
                >
                  <View style={[styles.rankCol, styles.rankBadgeWrap]}>
                    <Text style={[styles.rankingsRankNumber, { color: row.isWinner ? '#FBBF24' : colors.textPrimary }]}>
                      {row.rank}
                    </Text>
                    {row.medal ? <Text style={styles.rankingsMedal}>{row.medal}</Text> : null}
                  </View>
                  <View style={[styles.playerCol, styles.rankingsPlayerWrap]}>
                    <View style={[styles.rankingsAvatar, { backgroundColor: row.isWinner ? 'rgba(251,191,36,0.18)' : colors.purpleDim }]}>
                      <Text style={styles.rankingsAvatarText}>{row.initials}</Text>
                    </View>
                    <View style={styles.rankingsPlayerCopy}>
                      <Text style={[styles.rankingsPlayer, { color: colors.textPrimary }]} numberOfLines={1}>
                        {row.name}
                        {row.isCurrentUser ? <Text style={{ color: colors.purpleLight }}>  You</Text> : null}
                      </Text>
                      <Text style={[styles.rankingsPlayerSub, { color: colors.textSecondary }]}>
                        {row.isWinner ? 'Top result' : row.rizzLabel === 'Rizz-tier' ? 'Late but counted' : 'Qualified result'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.rankingsCell, styles.predictionCol, { color: colors.textPrimary }]}>{row.predictionLabel}</Text>
                  <View style={styles.diffCol}>
                    <Text style={[styles.rankingsScore, { color: row.isWinner ? colors.green : colors.textPrimary }]}>
                      {row.differenceLabel}
                    </Text>
                    <Text style={[styles.rankingsScoreSub, { color: colors.textSecondary }]}>
                      {row.isWinner ? 'Closest' : 'From actual'}
                    </Text>
                  </View>
                  <View style={[styles.rewardCol, styles.rankingsRewardWrap]}>
                    <Text style={[styles.rankingsReward, { color: colors.textPrimary }]}>{row.auraLabel}</Text>
                    <Text style={[styles.rankingsRewardSub, { color: row.rizzLabel === 'Rizz-tier' ? colors.amber : colors.textSecondary }]}>
                      {row.rizzLabel}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.ctaStack}>
          {featureFlags.momentCardExport ? (
            <PrimaryButton label="Share results" onPress={shareMomentCard} gradientColors={['#8B5CF6', '#3B82F6']} icon="✨" />
          ) : null}
          <PrimaryButton label="Back to Home" onPress={() => navigation.navigate('Home')} variant="secondary" icon="🏠" />
        </View>
      </ScrollView>
    </WebSideWingLayout>
  );
}

function ResultStatCard({
  eyebrow,
  value,
  note,
  accent,
}: {
  eyebrow: string;
  value: string;
  note: string;
  accent: string;
}) {
  return (
    <View style={[styles.resultStatCard, { borderColor: `${accent}33`, backgroundColor: 'rgba(15,21,39,0.72)' }]}>
      <Text style={[styles.resultStatEyebrow, { color: accent }]}>{eyebrow}</Text>
      <Text style={styles.resultStatValue}>{value}</Text>
      <Text style={styles.resultStatNote}>{note}</Text>
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

function formatDifferenceFromActual(
  predictedAt: Date | null,
  actualDate: Date | null,
  fallbackMinutes?: number | null,
) {
  if (predictedAt && actualDate && !Number.isNaN(predictedAt.getTime()) && !Number.isNaN(actualDate.getTime())) {
    const deltaMinutes = Math.round((predictedAt.getTime() - actualDate.getTime()) / 60000);
    if (deltaMinutes === 0) return '0 min';
    return `${Math.abs(deltaMinutes)} min ${deltaMinutes > 0 ? 'late' : 'early'}`;
  }
  if (typeof fallbackMinutes === 'number') {
    return fallbackMinutes === 0 ? '0 min' : `${fallbackMinutes.toFixed(1)} min off`;
  }
  return 'Result recorded';
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
  resultsHero: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  resultsHeroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 32 },
  resultsStatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  resultStatCard: {
    flex: 1,
    minWidth: 180,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  resultStatEyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.9 },
  resultStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', lineHeight: 22 },
  resultStatNote: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 18 },
  resultsBenchmarkNote: { fontSize: 13, fontWeight: '700' },
  comparisonCard: { borderRadius: 22, borderWidth: 1, padding: 18, gap: 14 },
  comparisonHeader: { gap: 4 },
  comparisonTitle: { fontSize: 19, fontWeight: '900' },
  comparisonMeta: { fontSize: 13, lineHeight: 18 },
  comparisonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  comparisonTile: {
    flex: 1,
    minWidth: 170,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 5,
  },
  comparisonTileTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  comparisonTileValue: { fontSize: 22, fontWeight: '900' },
  comparisonTileDiff: { fontSize: 14, fontWeight: '800' },
  comparisonTileNote: { fontSize: 12, lineHeight: 17 },
  rankingsCard: { borderRadius: 22, borderWidth: 1, padding: 18, gap: 14 },
  rankingsHeader: { gap: 4 },
  rankingsTitle: { fontSize: 19, fontWeight: '900' },
  rankingsMeta: { fontSize: 13, lineHeight: 18 },
  rankingsTableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  rankingsHeadCell: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  rankingsBody: { gap: 10 },
  rankingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rankingsCell: { fontSize: 14, fontWeight: '700' },
  rankBadgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankingsRankNumber: { fontSize: 24, fontWeight: '900' },
  rankingsMedal: { fontSize: 18 },
  rankingsPlayerWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankingsAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankingsAvatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  rankingsPlayerCopy: { flex: 1, gap: 2 },
  rankingsPlayer: { fontSize: 15, fontWeight: '800' },
  rankingsPlayerSub: { fontSize: 12, fontWeight: '600' },
  rankingsScore: { fontSize: 16, fontWeight: '900' },
  rankingsScoreSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  rankingsRewardWrap: { gap: 2 },
  rankingsReward: { fontSize: 14, fontWeight: '800' },
  rankingsRewardSub: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  rankCol: { width: 78 },
  playerCol: { flex: 1.25 },
  predictionCol: { width: 120 },
  diffCol: { width: 120 },
  rewardCol: { width: 118 },
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
