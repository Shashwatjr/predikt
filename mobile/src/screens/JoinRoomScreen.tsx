import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Share, Linking } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import TextInputField from '../components/TextInputField';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage, setAuthToken } from '../services/api';
import { savePendingJoinCode, resolveForwardedBy } from '../utils/inviteIntent';
import { setPostAuthIntent } from '../utils/postAuthIntent';
import { createGuestSession } from '../services/guestSession';
import { getCategoryTheme } from '../config/categoryTheme';
import SectionHeader from '../components/SectionHeader';
import ArrivalPredictionCard from '../components/ArrivalPredictionCard';
import { useArrivalPredictionState } from '../hooks/useArrivalPredictionState';
import { formatClock } from '../utils/benchmarks';
import { buildSharePayload } from '../utils/shareRoom';
import { cardStyle, layout, palette, radius, spacing } from '../theme/designSystem';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'JoinRoom'>;
  route: RouteProp<RootStackParamList, 'JoinRoom'>;
};

export default function JoinRoomScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { isAuthenticated, login, user } = useAuth();
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [guestHandle, setGuestHandle] = useState('');
  const [forwardedBy, setForwardedBy] = useState<string | null>(null);
  // Arrival-call state for the merged "Predict now" path (see showMergedPredict).
  const { benchmarks, predicted, setPredicted, hotTake, setHotTake } = useArrivalPredictionState(room);

  async function handleFind(nextCode?: string) {
    const inviteCode = (nextCode ?? code).trim().toUpperCase();
    if (!inviteCode) return Alert.alert('Enter a code', 'Type the 5-character invite code.');
    setLoading(true);
    try {
      const res = await api.get(`/rooms/invite/${inviteCode}`);
      let preview = res.data;
      // Invite preview is public and user-agnostic — enrich with viewerHasPredicted when authed.
      if (isAuthenticated && preview?.roomId) {
        try {
          const roomRes = await api.get(`/rooms/${preview.roomId}`);
          preview = {
            ...preview,
            ...roomRes.data,
            viewerHasPredicted: !!roomRes.data?.viewerHasPredicted,
            // Keep invite-safe title/question/benchmarks when room detail omits them.
            title: preview.title ?? roomRes.data?.roomTitle,
            question: preview.question ?? roomRes.data?.question,
            benchmarks: preview.benchmarks ?? roomRes.data?.benchmarks,
            canLateJoinPredict: roomRes.data?.canLateJoinPredict ?? preview.canLateJoinPredict,
          };
        } catch {
          // Non-member private rooms may 403; invite preview alone is still usable.
        }
      }
      setRoom(preview);
      setCode(inviteCode);
    } catch (error: unknown) {
      Alert.alert('Room unavailable', getApiErrorMessage(error, 'No room with that invite code. Check it and try again.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Resolve the forwarder (if this invite was forwarded) so join can record the chain.
    resolveForwardedBy().then((value) => value && setForwardedBy(value));
  }, []);

  useEffect(() => {
    const routeCode = route.params?.joinCode?.trim().toUpperCase();
    if (!routeCode) return;
    setCode(routeCode);
    void handleFind(routeCode);
  }, [route.params?.joinCode]);

  // If auth lands after invite preview, refresh viewerHasPredicted so we don't re-prompt.
  useEffect(() => {
    if (!isAuthenticated || !room?.roomId) return;
    if (typeof room.viewerHasPredicted === 'boolean') return;
    let cancelled = false;
    void api
      .get(`/rooms/${room.roomId}`)
      .then((roomRes) => {
        if (cancelled) return;
        setRoom((current: any) =>
          current
            ? {
                ...current,
                ...roomRes.data,
                viewerHasPredicted: !!roomRes.data?.viewerHasPredicted,
                title: current.title ?? roomRes.data?.roomTitle,
                question: current.question ?? roomRes.data?.question,
                benchmarks: current.benchmarks ?? roomRes.data?.benchmarks,
              }
            : current,
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, room?.roomId, room?.viewerHasPredicted]);

  // Resolves which screen the join should land on, from the join response + status.
  function resolveTarget(nextAction?: string) {
    const normalizedStatus = room.status === 'prediction_open' ? 'predictions_open' : room.status;
    const predictionRoom = { ...room, ...(room?.safePreview ?? {}) };
    const toPrediction = { screen: 'Prediction' as const, params: { roomId: room.roomId, room: predictionRoom } };
    const toLive = { screen: 'LiveRoom' as const, params: { roomId: room.roomId, isCreator: false } };
    const alreadyPredicted = !!room?.viewerHasPredicted;

    // nextAction from the join response is user-aware (it already accounts for
    // whether this user has predicted and whether the late window is open), so it
    // wins. canLateJoinPredict is only a fallback when nextAction is absent
    // (e.g. the guest best-effort join failed) — it's user-agnostic and would
    // otherwise send an already-predicted joiner back to re-predict.
    if (nextAction === 'prediction' && !alreadyPredicted) return toPrediction;
    if (nextAction === 'live') return toLive;
    if (alreadyPredicted) return toLive;

    if (normalizedStatus === 'predictions_open' || room?.canLateJoinPredict) return toPrediction;
    if (normalizedStatus === 'live' || normalizedStatus === 'predictions_locked') return toLive;
    return { screen: 'Result' as const, params: { roomId: room.roomId } };
  }

  function goToRoom() {
    if (!room?.roomId) return;
    navigation.navigate('LiveRoom', { roomId: room.roomId, isCreator: false });
  }

  async function submitArrivalPrediction() {
    // Authoritative call — it also ensures room membership server-side even if the
    // best-effort join above did not land.
    await api.post(`/rooms/${room.roomId}/predictions`, {
      predictedArrivalTime: predicted.toISOString(),
      hotTake: hotTake.trim() || undefined,
    });
  }

  async function handleAction() {
    if (!room) return;
    setLoading(true);
    try {
      if (!isAuthenticated) {
        // Guests join first-class: mint a lightweight guest session inline, no account.
        const handle = guestHandle.trim();
        if (!handle) {
          setLoading(false);
          Alert.alert('Add a name', 'Enter a name so friends can see your guess.');
          return;
        }
        const session = await createGuestSession(handle, room.roomId);
        // Authorize the join/prediction before login() remounts the navigator to the auth stack.
        setAuthToken(session.accessToken);
        let nextAction: string | undefined;
        try {
          const joinResponse = await api.post(`/rooms/${room.roomId}/join`, forwardedBy ? { forwardedBy } : {});
          nextAction = joinResponse.data?.nextAction;
        } catch {
          // Best-effort: prediction submission ensures membership server-side anyway.
        }

        if (showMergedPredict) {
          // Merged "Predict now": lock the guess in HERE, before login() unmounts this
          // screen, then hand the authenticated navigator straight to the live room.
          await submitArrivalPrediction();
          setPostAuthIntent({
            screen: 'LiveRoom',
            params: { roomId: room.roomId, isCreator: false, justPredicted: true },
          });
          await login(session);
          return;
        }

        // Two-step fallback: hand the landing to the authenticated navigator — navigating
        // across the auth-stack remount from this (unmounting) screen would be dropped.
        const target = resolveTarget(nextAction);
        setPostAuthIntent(target);
        await login(session);
        return;
      }

      // Authenticated: already on the auth stack, navigate directly (no remount).
      if (showMergedPredict) {
        try {
          await api.post(`/rooms/${room.roomId}/join`, forwardedBy ? { forwardedBy } : {});
        } catch {
          // Best-effort membership; the prediction below is authoritative.
        }
        await submitArrivalPrediction();
        navigation.navigate('LiveRoom', { roomId: room.roomId, isCreator: false, justPredicted: true });
        return;
      }

      const joinResponse = await api.post(`/rooms/${room.roomId}/join`, forwardedBy ? { forwardedBy } : {});
      const target = resolveTarget(joinResponse.data?.nextAction);
      navigation.navigate(target.screen, target.params as never);
    } catch (error: unknown) {
      Alert.alert('Could not lock it in', getApiErrorMessage(error, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  const normalizedStatus = room?.status === 'prediction_open' ? 'predictions_open' : room?.status;
  const alreadyPredicted = !!room?.viewerHasPredicted;
  const canPredictNow =
    !alreadyPredicted && (normalizedStatus === 'predictions_open' || !!room?.canLateJoinPredict);
  const ctaLabel: Record<string, string> = {
    predictions_open: 'Make my prediction',
    predictions_locked: 'Go to room',
    live: 'Go to room',
    completed: 'See the Tea',
  };
  const isJoinable = alreadyPredicted || canPredictNow || !!(normalizedStatus && ctaLabel[normalizedStatus]);

  const categoryTheme = getCategoryTheme(room?.category ?? room?.templateKey);
  const isGenericRoom = (room?.category ?? room?.templateKey) === 'open_prediction';

  // Merged single-screen predict path: only arrival (exact_time) rooms that are
  // predictable now, non-generic, and carry benchmarks. Anything else (non-arrival
  // answer types, missing benchmarks, watch-only) falls back to the two-step flow.
  const answerType = room?.answerType ?? room?.safePreview?.answerType ?? null;
  const showMergedPredict =
    canPredictNow && answerType === 'exact_time' && !isGenericRoom && !!benchmarks?.ordered.length;
  const roomTitle = room?.title ?? room?.roomTitle ?? (isGenericRoom ? 'A Wild Cards room' : 'A prediction room');
  const sharePayload = useMemo(
    () =>
      room
        ? buildSharePayload(
            { ...room, roomTitle, inviteCode: room.inviteCode ?? code },
            // A guest forwarding the invite becomes the forwarder in the chain.
            room.creatorUserId && user?.userId === room.creatorUserId ? undefined : user?.userId,
          )
        : null,
    [room, roomTitle, code, user?.userId],
  );
  const lockLabel = room?.canLateJoinPredict && room?.lateJoinPredictionWindowEndsAt
    ? `Late-join guesses stay open until ${new Date(room.lateJoinPredictionWindowEndsAt).toLocaleString()}`
    : room?.lockTime || room?.predictionCloseTime
    ? `Guesses lock ${new Date(room.lockTime ?? room.predictionCloseTime).toLocaleString()}`
    : 'Lock time set by the host';
  const participantCount = Number(room?.participantCount ?? 0);
  const formatPeopleInRoom = (count: number) => `${count} ${count === 1 ? 'person' : 'people'} in this room`;
  // participantCount is everyone in the room (joined members + anyone who has
  // predicted), which includes the host — so "already predicted" would overcount.
  // Phrase it as room presence instead.
  const socialProof =
    participantCount > 0
      ? formatPeopleInRoom(participantCount)
      : 'Be the first to call it';

  async function handleForwardInvite() {
    if (!sharePayload) return;
    try {
      await Share.share({
        message: sharePayload.shareText,
        title: `Join ${sharePayload.shareTitle}`,
      });
    } catch {
      Alert.alert('Share unavailable', 'Could not open the share sheet right now.');
    }
  }

  async function handleForwardWhatsApp() {
    if (!sharePayload) return;
    try {
      await Linking.openURL(sharePayload.whatsappUrl);
    } catch {
      Alert.alert('WhatsApp unavailable', 'Could not open WhatsApp right now.');
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}
      keyboardShouldPersistTaps="handled"
    >
      {room ? (
        <>
          {/* Category color wash — the striking first impression for a tapped invite. */}
          <LinearGradient
            colors={categoryTheme.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroWash}
          >
            <View style={styles.heroBadgeRow}>
              <Text style={styles.heroIcon}>{categoryTheme.icon}</Text>
              <Text style={styles.heroCategory}>{categoryTheme.label}</Text>
            </View>
            <Text style={styles.heroEyebrow}>
              {alreadyPredicted
                ? "You're already in this room"
                : isGenericRoom
                  ? "You're invited to Wild Cards"
                  : "You're invited to predict"}
            </Text>
            <Text style={styles.heroTitle}>{roomTitle}</Text>
            {room.question ? <Text style={styles.heroQuestion}>{room.question}</Text> : null}
            <View style={styles.socialProofPill}>
              <Text style={styles.socialProofText}>👥 {socialProof}</Text>
            </View>
            <Text style={styles.heroLock}>🔒 {lockLabel}</Text>
          </LinearGradient>

          {/* Standalone benchmark card for watch/non-predict states. When predicting
              inline (showMergedPredict), ArrivalPredictionCard renders its own. */}
          {benchmarks?.ordered.length && !showMergedPredict ? (
            <View style={styles.benchCard}>
              {benchmarks.ordered.map((b) => (
                <View key={b.key} style={styles.benchRow}>
                  <Text style={styles.benchLabel}>
                    {b.key === 'maps' ? (b.verified ? b.label : 'Route estimate') : b.key === 'host' ? 'Host predicts' : 'The bot'}
                  </Text>
                  <Text style={styles.benchTime}>{formatClock(b.date, false)}</Text>
                </View>
              ))}
              {isJoinable && !alreadyPredicted ? <Text style={styles.beatLine}>Think you can beat them?</Text> : null}
            </View>
          ) : null}

          {isGenericRoom && sharePayload ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.shareTitle, { color: colors.textPrimary }]}>Forward this room</Text>
              <Text style={[styles.shareCopy, { color: colors.textSecondary }]}>
                Anyone you forward this to joins the same Wild Cards room with the same countdown and lock time.
              </Text>
              <View style={styles.shareActions}>
                <View style={styles.shareAction}>
                  <PrimaryButton label="Forward on WhatsApp" onPress={handleForwardWhatsApp} icon="💬" />
                </View>
                <View style={styles.shareAction}>
                  <PrimaryButton label="Share Invite" onPress={handleForwardInvite} variant="secondary" icon="📨" />
                </View>
              </View>
            </View>
          ) : null}

          {isJoinable && !isAuthenticated ? (
            <View style={[cardStyle('elevated'), { gap: spacing.sm }]}>
              <TextInputField
                label="Your name"
                value={guestHandle}
                onChangeText={setGuestHandle}
                placeholder="e.g. Sam"
                maxLength={30}
              />
              <Text style={styles.guestPromise}>
                {isGenericRoom
                  ? 'No account needed to play. Your prediction is saved right away. Generic rooms use creator-attest plus challenge flow in MVP.'
                  : 'No account needed to play. Your guess is saved right away — claim your Aura later if you want.'}
              </Text>
            </View>
          ) : null}

          {/* Merged "Predict now": benchmark + time picker + hot take, so the guest
              locks in from this one screen instead of a second Prediction step. */}
          {showMergedPredict ? (
            <ArrivalPredictionCard
              room={room}
              predicted={predicted}
              onPredictedChange={setPredicted}
              hotTake={hotTake}
              onHotTakeChange={setHotTake}
              compact
            />
          ) : null}

          {isJoinable ? (
            alreadyPredicted ? (
              <PrimaryButton
                label="Go to room"
                onPress={goToRoom}
                loading={loading}
                icon="🚪"
              />
            ) : (
              <>
                <PrimaryButton
                  label={showMergedPredict ? 'Lock it in' : canPredictNow ? 'Make my prediction' : ctaLabel[normalizedStatus as string]}
                  onPress={
                    canPredictNow
                      ? handleAction
                      : goToRoom
                  }
                  loading={loading}
                  icon={canPredictNow ? '🎯' : '🚪'}
                />
                {canPredictNow && normalizedStatus !== 'completed' ? (
                  <TouchableOpacity onPress={goToRoom} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                    <Text style={{ color: palette.violetLight, fontWeight: '800', fontSize: 14 }}>Go to room</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )
          ) : (
            <Text style={[styles.statusMsg, { color: colors.textMuted }]}>
              This room is {String(room.status).replace(/_/g, ' ')}.
            </Text>
          )}

          {!isAuthenticated ? (
            <TouchableOpacity
              onPress={async () => {
                await savePendingJoinCode(room.inviteCode ?? code);
                navigation.navigate('Login');
              }}
              style={{ paddingVertical: spacing.md, alignItems: 'center' }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Already have an account? <Text style={{ color: palette.violetLight, fontWeight: '800' }}>Log in</Text>
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity onPress={() => { setRoom(null); setCode(''); }} style={{ paddingVertical: spacing.sm, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Enter a different code</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <SectionHeader title="Join the Challenge" subtitle="Got a room code? Drop it in and prove them wrong." />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInputField
              label="Invite Code"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder="e.g. DEMO1"
              autoCapitalize="characters"
              maxLength={5}
            />
            <View style={{ height: 6 }} />
            <PrimaryButton label="Find Room" onPress={() => handleFind()} loading={loading} icon="🔍" />
          </View>
          <Text style={styles.finderNote}>
            {isGenericRoom
              ? 'No account needed to join Wild Cards. The host attests the result, and challengers can request proof through WhatsApp.'
              : 'No account needed to play. Your guess is saved, and you can claim your Aura later.'}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: 24, gap: 16 },
  card: { borderRadius: 18, padding: 18, borderWidth: 1 },
  heroWash: { borderRadius: radius.xl, padding: 22, gap: 8, overflow: 'hidden' },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroIcon: { fontSize: 20 },
  heroCategory: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginTop: 4, textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900', lineHeight: 33, letterSpacing: -0.4 },
  heroQuestion: { color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  socialProofPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  socialProofText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  heroLock: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', marginTop: 2 },
  guestPromise: { color: palette.textSecondary, fontSize: 13, lineHeight: 19 },
  benchCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  benchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  benchLabel: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
  benchTime: { color: palette.textPrimary, fontSize: 22, fontWeight: '900' },
  beatLine: { color: palette.violetLight, fontSize: 14, fontWeight: '900', marginTop: spacing.xs },
  shareTitle: { fontSize: 16, fontWeight: '900' },
  shareCopy: { fontSize: 13, lineHeight: 19 },
  shareActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  shareAction: { flex: 1 },
  finderNote: { color: palette.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  statusMsg: { textAlign: 'center', fontSize: 14 },
});
