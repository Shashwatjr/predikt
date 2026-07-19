import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import LeaderboardList from '../components/LeaderboardList';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import WebSideWingLayout from '../components/WebSideWingLayout';
import MomentCard from '../components/MomentCard';
import { shareMoment } from '../utils/shareMoment';
import { CommentaryResponse, ResultPayload, RoomBadge } from '../types/engagement';
import TeaCard from '../components/TeaCard';
import CommentaryBubble from '../components/CommentaryBubble';
import ReactionStrip from '../components/ReactionStrip';
import SectionHeader from '../components/SectionHeader';
import GuestUpgradePrompt from '../components/GuestUpgradePrompt';
import { getCategoryTheme } from '../config/categoryTheme';
import { featureFlags } from '../config/featureFlags';
import { copyToClipboard, formatLineForShare } from '../utils/shareLine';
import { layout, palette } from '../theme/designSystem';
import CoachMark from '../components/CoachMark';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Result'>;
  route: RouteProp<RootStackParamList, 'Result'>;
};

const REACTIONS = ['🔥', '🎯', '👑', '😂', '😭', '🤝', '⚡', '🌧️', '🍕', '💪'];

export default function ResultScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { roomId, result: initialResult } = route.params;
  const [data, setData] = useState<any[]>(initialResult?.rankings ?? []);
  const [winner, setWinner] = useState<any>(initialResult?.winner ?? null);
  const [room, setRoom] = useState<any>(null);
  const [commentary, setCommentary] = useState<CommentaryResponse | null>(null);
  const [badges, setBadges] = useState<RoomBadge[]>([]);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [isRematching, setIsRematching] = useState(false);
  const [lineCopied, setLineCopied] = useState(false);

  const [reduceMotion, setReduceMotion] = useState(false);

  const floatY = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const winnerScale = useRef(new Animated.Value(0.94)).current;
  const winnerGlow = useRef(new Animated.Value(0)).current;
  const commentaryRise = useRef(new Animated.Value(8)).current;
  const commentaryOpacity = useRef(new Animated.Value(0)).current;

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
    return () => {
      active = false;
    };
  }, []);

  async function fetchRoomAndCommentary() {
    try {
      const [roomRes, commentaryRes, badgesRes] = await Promise.allSettled([
        api.get(`/rooms/${roomId}`),
        api.get(`/rooms/${roomId}/commentary`),
        api.get(`/rooms/${roomId}/badges`),
      ]);

      if (roomRes.status === 'fulfilled') {
        setRoom(roomRes.value.data);
      }
      if (commentaryRes.status === 'fulfilled') {
        setCommentary(commentaryRes.value.data);
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
      commentaryRise.setValue(0);
      commentaryOpacity.setValue(1);
      return;
    }
    floatOpacity.setValue(1);
    floatY.setValue(0);
    Animated.parallel([
      Animated.timing(floatY, { toValue: -60, duration: 1400, useNativeDriver: true }),
      Animated.timing(floatOpacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
      Animated.timing(winnerScale, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(winnerGlow, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(commentaryRise, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(commentaryOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
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

  async function sendReaction(emoji: string) {
    try {
      await api.post(`/rooms/${roomId}/reactions`, { emoji });
      setSelectedReaction(emoji);
    } catch {
      Alert.alert('Reaction not saved', 'Only participants in completed rooms can react to The Tea.');
    }
  }

  async function regenerateCommentary() {
    try {
      const res = await api.post(`/rooms/${roomId}/commentary/regenerate`);
      setCommentary(res.data);
    } catch {
      Alert.alert('Commentary unavailable', 'This room is using safe deterministic commentary right now.');
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
  const oracleBotLabel = room?.baselineLabel ?? room?.oracleBotPrediction?.label ?? 'Benchmark only';
  const biggestNearMiss = podiumTop3[1]
    ? `${formatWinnerHandle(podiumTop3[1])} missed by ${
        typeof podiumTop3[1]?.differenceFromActualMinutes === 'number'
          ? `${podiumTop3[1].differenceFromActualMinutes.toFixed(1)} min`
          : 'a little'
      }`
    : 'No near miss this time';
  const momentCard = buildMomentCardFromResult(initialResult as ResultPayload | undefined, categoryKey, commentary?.personality);
  const badgeUnlocked =
    badges.find((badge) => badge.userId === (winningRow?.userId ?? winningRow?.user?.userId))?.title
    ?? initialResult?.momentCard?.badge
    ?? initialResult?.badges?.[0]?.title
    ?? momentCard.badge;
  const comebackCopy = winningRow && user && (winningRow.userId ?? winningRow.user?.userId) !== user.userId
    ? 'Comeback unlocked.'
    : 'Run it back?';

  async function shareMomentCard() {
    await shareMoment({
      title: `☕ The Tea • ${room?.roomTitle ?? 'PREDIKT'}`,
      subtitle: 'Closest guess wins Aura',
      category: categoryLabel,
      winner: winnerHandle,
      predictionLabel: winningPrediction,
      actualLabel: actualOutcome,
      differenceLabel,
      oracleLabel: oracleBotLabel,
      badge: badgeUnlocked,
      commentary: commentary?.punchline ?? momentCard.commentary,
      cta: 'Join the next PREDIKT',
      linkLabel: 'Run it back?',
    });
    await api.post('/events', { eventType: 'moment_card_shared', metadata: { roomId, category: categoryKey } }).catch(() => undefined);
  }

  async function shareCommentaryLine() {
    const line = commentary?.punchline;
    if (!line) return;
    const text = formatLineForShare(line, commentary?.personality);
    const ok = await copyToClipboard(text);
    if (ok) {
      setLineCopied(true);
      setTimeout(() => setLineCopied(false), 2000);
    } else {
      // Native/no-clipboard fallback: surface the exact text to copy by hand.
      Alert.alert('Copy this line', text);
    }
  }

  async function handleRematch() {
    if (isRematching) return;

    setIsRematching(true);
    try {
      const res = await api.post(`/rooms/${roomId}/rematch`);
      const createdRoom = res.data;
      await api.post('/events', { eventType: 'rematch_created', metadata: { sourceRoomId: roomId, category: categoryKey, targetRoomId: createdRoom?.roomId } }).catch(() => undefined);
      navigation.navigate('Prediction', { roomId: createdRoom?.roomId ?? roomId, room: createdRoom ?? { roomId } });
    } catch (error) {
      Alert.alert('Rematch unavailable', getApiErrorMessage(error, 'This room cannot be rematched right now.'));
    } finally {
      setIsRematching(false);
    }
  }

  async function handleComeback() {
    await api.post('/events', { eventType: 'comeback_started', metadata: { sourceRoomId: roomId, category: categoryKey } }).catch(() => undefined);
    navigation.navigate('CreateRoom');
  }

  async function handleChallengeResult() {
    try {
      const response = await api.post(`/rooms/${roomId}/disputes`, {
        reason: 'Predictor challenge: please review this creator-attested generic-room result.',
      });
      const proofWaMeLink = response.data?.proofWaMeLink;
      Alert.alert(
        'Challenge submitted',
        proofWaMeLink
          ? 'The creator and challenger were notified. We can open the WhatsApp proof link now.'
          : 'The creator and challenger were notified in-app.',
        proofWaMeLink
          ? [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Open WhatsApp link',
                onPress: () => {
                  void Linking.openURL(proofWaMeLink);
                },
              },
            ]
          : undefined,
      );
    } catch (error) {
      Alert.alert('Challenge unavailable', getApiErrorMessage(error, 'We could not submit the challenge right now.'));
    }
  }

  const categoryTheme = getCategoryTheme(categoryKey);
  const isGenericRoom = categoryKey === 'open_prediction';
  const isCreator = !!user?.userId && !!room?.creatorUserId && user.userId === room.creatorUserId;

  return (
    <WebSideWingLayout rightPlacement="result_side">
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        <SectionHeader title="☕ The Tea" subtitle={isNeutralClosure ? 'Fair reset — nobody counted as a loss' : categoryTheme.resultTitle} />
        <CoachMark
          storageKey="coachmark:result:the_tea"
          title="The Tea"
          body="The reveal. See who nailed it and what Chaos Bot said."
        />

        {/* The reward: the Chaos Bot punchline leads, oversized, with the copy/share
            affordance attached — above the shareable screenshot below. */}
        {commentary ? (
          <Animated.View style={{ opacity: commentaryOpacity, transform: [{ translateY: commentaryRise }] }}>
            <CommentaryBubble
              hero
              personality={commentary.personality}
              headline={commentary.headline}
              punchline={commentary.punchline}
              onShareLine={shareCommentaryLine}
              shareCopied={lineCopied}
            />
            <PrimaryButton
              label={commentary?.canRegenerate === false ? 'Commentary Locked' : 'Refresh Commentary'}
              onPress={regenerateCommentary}
              variant="secondary"
              icon="🌀"
              disabled={commentary?.canRegenerate === false}
            />
          </Animated.View>
        ) : null}

        <TeaCard
          roomTitle={room?.roomTitle ?? 'PREDIKT Moment'}
          category={categoryTheme}
          winnerHandle={winnerHandle}
          neutral={isNeutralClosure}
          metrics={[
            { label: 'Winner', value: winnerHandle },
            { label: 'Predicted', value: winningPrediction },
            { label: 'Actual', value: actualOutcome },
            { label: 'Difference', value: differenceLabel },
            { label: 'Near miss', value: biggestNearMiss },
            { label: 'Badge', value: badgeUnlocked },
          ]}
          oracleLabel={oracleBotLabel}
          badge={badgeUnlocked}
          auraEarned={dotBonus ? undefined : auraEarned}
        />

        {dotBonus ? (
          <Text style={[styles.dotBonus, { color: colors.green }]}>Dot Bonus unlocked: {dotBonus}</Text>
        ) : null}

        <MomentCard
          title={room?.roomTitle ?? 'PREDIKT Moment'}
          subtitle={momentCard.subtitle}
          badge={badgeUnlocked}
          category={categoryLabel}
          handle={winnerHandle}
          predictionLabel={winningPrediction}
          actualLabel={actualOutcome}
          differenceLabel={differenceLabel}
          oracleLabel={oracleBotLabel}
          commentary={commentary?.punchline ?? momentCard.commentary}
          cta="Join the next PREDIKT"
        />

        {winningRow ? (
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

        {podiumTop3.length >= 2 ? (
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

        <SectionHeader title="React + Rematch" subtitle={comebackCopy} />
        <ReactionStrip reactions={REACTIONS} onReact={sendReaction} selected={selectedReaction} />

        {isGenericRoom && !isCreator ? (
          <PrimaryButton
            label="Challenge Creator-Attest"
            onPress={handleChallengeResult}
            variant="secondary"
            icon="⚖️"
          />
        ) : null}

        {data.length ? (
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
          <PrimaryButton label={isRematching ? 'Running it back…' : 'Run it back'} onPress={handleRematch} icon="🔁" disabled={isRematching} />
          <PrimaryButton label="Start a Comeback" onPress={handleComeback} variant="secondary" icon="⚡" />
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

function buildMomentCardFromResult(result: ResultPayload | undefined, category: string, personality?: string | null) {
  if (result?.momentCard?.badge || result?.momentCard?.shareText) {
    return {
      badge: result.momentCard.badge ?? result.momentCard.titles?.[0] ?? 'Closest Guess',
      subtitle: result.momentCard.shareText ?? 'Closest guess wins Aura',
      commentary: `${personality ?? 'Oracle'} energy says the result is ready to share.`,
    };
  }
  return buildFallbackMomentCard(category, personality);
}

function buildFallbackMomentCard(category: string, personality?: string | null) {
  switch (category) {
    case 'weather_rain':
      return {
        badge: 'Rain Oracle',
        subtitle: 'Forecast Beater',
        commentary: `${personality ?? 'Oracle'} energy says the forecast was beat fairly.`,
      };
    case 'food_eta':
      return {
        badge: 'Beat the ETA',
        subtitle: 'Delivery Oracle',
        commentary: `${personality ?? 'Chaos'} energy says the delivery arc stayed dramatic.`,
      };
    case 'whos_late':
      return {
        badge: 'Group Chaos',
        subtitle: 'Time Oracle',
        commentary: `${personality ?? 'Best Friend'} energy says tradition was respectfully maintained.`,
      };
    case 'gym_habit':
      return {
        badge: 'Pattern Breaker',
        subtitle: 'Comeback Solo',
        commentary: `${personality ?? 'Best Friend'} energy says progress still deserves a screenshot.`,
      };
    case 'open_prediction':
      return {
        badge: 'Wild Cards',
        subtitle: 'Creator-attest MVP lane',
        commentary: `${personality ?? 'Oracle'} energy says the call is in, and challengers still have a route to contest it.`,
      };
    default:
      return {
        badge: 'Route Oracle',
        subtitle: 'Closest guess wins Aura',
        commentary: `${personality ?? 'Chaos'} energy says the route had opinions and the winner had receipts.`,
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
  storyCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 8 },
  storyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  storyTitle: { fontSize: 16, fontWeight: '900' },
  storyBadge: { fontSize: 12, fontWeight: '800' },
  storyHeadline: { fontSize: 18, fontWeight: '900' },
  storyQuote: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  storySupport: { fontSize: 13, lineHeight: 19 },
  winnerWrapper: { position: 'relative' },
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
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  reaction: { fontSize: 22, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  ctaStack: { gap: 10, paddingBottom: 24 },
});
