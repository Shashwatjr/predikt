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
import { savePendingJoinCode } from '../utils/inviteIntent';
import { setPostAuthIntent } from '../utils/postAuthIntent';
import { createGuestSession } from '../services/guestSession';
import { getCategoryTheme } from '../config/categoryTheme';
import SectionHeader from '../components/SectionHeader';
import { deriveArrivalBenchmarks, formatClock } from '../utils/benchmarks';
import { buildSharePayload } from '../utils/shareRoom';
import { cardStyle, layout, palette, radius, spacing } from '../theme/designSystem';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'JoinRoom'>;
  route: RouteProp<RootStackParamList, 'JoinRoom'>;
};

export default function JoinRoomScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { isAuthenticated, login } = useAuth();
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [guestHandle, setGuestHandle] = useState('');

  async function handleFind(nextCode?: string) {
    const inviteCode = (nextCode ?? code).trim().toUpperCase();
    if (!inviteCode) return Alert.alert('Enter a code', 'Type the 5-character invite code.');
    setLoading(true);
    try {
      const res = await api.get(`/rooms/invite/${inviteCode}`);
      setRoom(res.data);
      setCode(inviteCode);
    } catch (error: unknown) {
      Alert.alert('Room unavailable', getApiErrorMessage(error, 'No room with that invite code. Check it and try again.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const routeCode = route.params?.joinCode?.trim().toUpperCase();
    if (!routeCode) return;
    setCode(routeCode);
    void handleFind(routeCode);
  }, [route.params?.joinCode]);

  // Resolves which screen the join should land on, from the join response + status.
  function resolveTarget(nextAction?: string) {
    const normalizedStatus = room.status === 'prediction_open' ? 'predictions_open' : room.status;
    const predictionRoom = { ...room, ...(room?.safePreview ?? {}) };
    const toPrediction = { screen: 'Prediction' as const, params: { roomId: room.roomId, room: predictionRoom } };
    const toLive = { screen: 'LiveRoom' as const, params: { roomId: room.roomId, isCreator: false } };

    // nextAction from the join response is user-aware (it already accounts for
    // whether this user has predicted and whether the late window is open), so it
    // wins. canLateJoinPredict is only a fallback when nextAction is absent
    // (e.g. the guest best-effort join failed) — it's user-agnostic and would
    // otherwise send an already-predicted joiner back to re-predict.
    if (nextAction === 'prediction') return toPrediction;
    if (nextAction === 'live') return toLive;

    if (normalizedStatus === 'predictions_open' || room?.canLateJoinPredict) return toPrediction;
    if (normalizedStatus === 'live' || normalizedStatus === 'predictions_locked') return toLive;
    return { screen: 'Result' as const, params: { roomId: room.roomId } };
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
        // Authorize the join before login() remounts the navigator to the auth stack.
        setAuthToken(session.accessToken);
        let nextAction: string | undefined;
        try {
          const joinResponse = await api.post(`/rooms/${room.roomId}/join`);
          nextAction = joinResponse.data?.nextAction;
        } catch {
          // Best-effort: prediction submission ensures membership server-side anyway.
        }
        // Hand the landing to the authenticated navigator — navigating across the
        // auth-stack remount from this (unmounting) screen would be dropped.
        const target = resolveTarget(nextAction);
        setPostAuthIntent(target);
        await login(session);
        return;
      }

      const joinResponse = await api.post(`/rooms/${room.roomId}/join`);
      const target = resolveTarget(joinResponse.data?.nextAction);
      navigation.navigate(target.screen, target.params as never);
    } catch (error: unknown) {
      Alert.alert('Could not join', getApiErrorMessage(error, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  const normalizedStatus = room?.status === 'prediction_open' ? 'predictions_open' : room?.status;
  const canPredictNow = normalizedStatus === 'predictions_open' || !!room?.canLateJoinPredict;
  const ctaLabel: Record<string, string> = {
    predictions_open: 'Make my prediction',
    predictions_locked: 'Watch it live',
    live: 'Watch it live',
    completed: 'See the Tea',
  };
  const isJoinable = canPredictNow || !!(normalizedStatus && ctaLabel[normalizedStatus]);

  const benchmarks = deriveArrivalBenchmarks(room);
  const categoryTheme = getCategoryTheme(room?.category ?? room?.templateKey);
  const isGenericRoom = (room?.category ?? room?.templateKey) === 'open_prediction';
  const roomTitle = room?.title ?? room?.roomTitle ?? (isGenericRoom ? 'A Wild Cards room' : 'A PREDIKT challenge');
  const sharePayload = useMemo(
    () => (room ? buildSharePayload({ ...room, roomTitle, inviteCode: room.inviteCode ?? code }) : null),
    [room, roomTitle, code],
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
            <Text style={styles.heroEyebrow}>{isGenericRoom ? "You're invited to Wild Cards" : "You're invited to predict"}</Text>
            <Text style={styles.heroTitle}>{roomTitle}</Text>
            {room.question ? <Text style={styles.heroQuestion}>{room.question}</Text> : null}
            <View style={styles.socialProofPill}>
              <Text style={styles.socialProofText}>👥 {socialProof}</Text>
            </View>
            <Text style={styles.heroLock}>🔒 {lockLabel}</Text>
          </LinearGradient>

          {benchmarks?.ordered.length ? (
            <View style={styles.benchCard}>
              {benchmarks.ordered.map((b) => (
                <View key={b.key} style={styles.benchRow}>
                  <Text style={styles.benchLabel}>
                    {b.key === 'maps' ? (b.verified ? b.label : 'Route estimate') : b.key === 'host' ? 'Host predicts' : 'Oracle Bot'}
                  </Text>
                  <Text style={styles.benchTime}>{formatClock(b.date, false)}</Text>
                </View>
              ))}
              {isJoinable ? <Text style={styles.beatLine}>Think you can beat them?</Text> : null}
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

          {isJoinable ? (
            <PrimaryButton
              label={canPredictNow ? 'Make my prediction' : ctaLabel[normalizedStatus as string]}
              onPress={handleAction}
              loading={loading}
              icon="🎯"
            />
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
