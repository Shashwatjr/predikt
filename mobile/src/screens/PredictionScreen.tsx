import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking } from 'react-native';
import * as Location from 'expo-location';
import { appAlert } from '../utils/appAlert';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import api, { getApiErrorMessage } from '../services/api';
import InfoTip from '../components/InfoTip';
import SectionHeader from '../components/SectionHeader';
import TimePickerSegments from '../components/TimePickerSegments';
import PredictionInputDuration from '../components/PredictionInputDuration';
import PredictionInputYesNo from '../components/PredictionInputYesNo';
import RoomPredictionList, { RoomPredictionEntry } from '../components/RoomPredictionList';
import { buildSharePayload } from '../utils/shareRoom';
import {
  Benchmark,
  deriveArrivalBenchmarks,
  diffLabel,
  formatClock,
  formatDateLabel,
} from '../utils/benchmarks';
import { botGuessTeaser } from '../utils/botVoice';
import { layout, palette, radius, spacing } from '../theme/designSystem';
import { useAuth } from '../context/AuthContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Prediction'>;
  route: RouteProp<RootStackParamList, 'Prediction'>;
};

const durationChoices = [20, 30, 45, 60];
const ADJUSTMENTS: Array<{ label: string; seconds: number }> = [
  { label: '−1m', seconds: -60 },
  { label: '−30s', seconds: -30 },
  { label: '+30s', seconds: 30 },
  { label: '+1m', seconds: 60 },
  { label: '+2m', seconds: 120 },
  { label: '+5m', seconds: 300 },
];

function benchmarkChipLabel(b: Benchmark): string {
  if (b.key === 'maps') return b.verified ? b.label : 'Estimate';
  if (b.key === 'host') return 'Host';
  return 'Oracle';
}

export default function PredictionScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const {
    roomId,
    room: roomParam,
    editPredictionId,
    startJourneyAfterSubmit,
    startDelayMinutes,
    navigateToRoomCreatedAfterSubmit,
  } = route.params;
  const [room, setRoom] = useState<any>(roomParam);
  const [loading, setLoading] = useState(false);
  // Late-join context: peers' guesses (already un-hidden once the room is live)
  // and a ticking clock to enforce the "closes 3 min before arrival" cutoff.
  const [others, setOthers] = useState<RoomPredictionEntry[]>([]);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const category = room?.category ?? room?.templateKey ?? roomParam?.category ?? roomParam?.templateKey;
  const isGenericRoom = category === 'open_prediction';
  const isCreator =
    room?.viewerIsCreator === true ||
    (!!user?.userId &&
      (user.userId === room?.creatorUserId || user.userId === room?.creator?.userId));

  const answerType = room?.answerType ?? 'exact_time';
  // Open-prediction rooms are never the arrival/travel experience, even if the
  // room payload hasn't loaded answerType yet (default would be 'exact_time').
  const isArrival = !isGenericRoom && answerType === 'exact_time';
  const benchmarks = useMemo(() => deriveArrivalBenchmarks(room), [room]);
  const journeyStart =
    room?.journeyStartedAt || room?.journeyScheduledStartAt || room?.startTime || room?.plannedStartTime
      ? new Date(room.journeyStartedAt ?? room.journeyScheduledStartAt ?? room.startTime ?? room.plannedStartTime)
      : null;

  // Enrich from the server: always refresh the room (to pick up predictionWindow /
  // status for late joiners) and pull peers' predictions to show alongside.
  useEffect(() => {
    void api
      .get(`/rooms/${roomId}`)
      .then((res) => setRoom((current: any) => ({ ...current, ...res.data })))
      .catch(() => undefined);
    void api
      .get(`/rooms/${roomId}/predictions`)
      .then((res) => setOthers((res.data ?? []) as RoomPredictionEntry[]))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live pace-projected arrival window (present once the journey is live).
  const predictionWindow = room?.predictionWindow ?? null;
  const isLive = room?.status === 'live';
  const deadlineAt = predictionWindow?.deadlineAt ? new Date(predictionWindow.deadlineAt) : null;
  const projectedArrival = predictionWindow?.projectedArrivalAt
    ? new Date(predictionWindow.projectedArrivalAt)
    : null;
  const lockedOut = !!(isLive && deadlineAt && nowTick >= deadlineAt.getTime());
  const secondsLeft = deadlineAt ? Math.max(0, Math.ceil((deadlineAt.getTime() - nowTick) / 1000)) : null;

  // Tick every second while live so the cutoff disables the button in real time.
  useEffect(() => {
    if (!isLive || !deadlineAt) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, deadlineAt?.getTime()]);

  // Arrival state — the picker is pre-populated from the primary benchmark.
  const [predicted, setPredicted] = useState<Date>(
    () => benchmarks?.primary.date ?? new Date(Date.now() + 30 * 60 * 1000),
  );
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && benchmarks?.primary) {
      setPredicted(new Date(benchmarks.primary.date));
      seededRef.current = true;
    }
  }, [benchmarks]);

  // Non-arrival answer types keep their existing inputs.
  const routeEtaSeconds = room?.route?.estimatedDurationSeconds ?? 1800;
  const [durationMinutes, setDurationMinutes] = useState(
    Math.max(1, Math.round(routeEtaSeconds / 60)).toString(),
  );
  const [yesNoChoice, setYesNoChoice] = useState<'yes' | 'no' | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const inviteCode = room?.inviteCode ?? roomParam?.inviteCode ?? '';
  const sharePayload = useMemo(
    () =>
      room
        ? buildSharePayload({
            ...room,
            roomTitle: room.roomTitle ?? room.title,
            inviteCode,
          })
        : null,
    [room, inviteCode],
  );
  const confirmScale = useRef(new Animated.Value(1)).current;
  const foodEtaBenchmarkLabel =
    room?.category === 'food_eta' || room?.templateKey === 'food_eta'
      ? room?.baselineLabel ?? room?.oracleBotPrediction?.label ?? null
      : null;
  const multipleChoiceOptions = useMemo(() => {
    const scoringRule = room?.scoringRule;
    if (Array.isArray(scoringRule?.weatherOptions)) return scoringRule.weatherOptions;
    if (Array.isArray(room?.options)) {
      return room.options.map((key: string) => ({
        key,
        label: key.replace(/_/g, ' '),
        helper: 'Choose the outcome you think is most likely.',
      }));
    }
    if (Array.isArray(room?.creationMeta?.options)) {
      return room.creationMeta.options.map((key: string) => ({
        key,
        label: key.replace(/_/g, ' '),
        helper: 'Choose the outcome you think is most likely.',
      }));
    }
    if (Array.isArray(scoringRule?.creationMeta?.options)) {
      return scoringRule.creationMeta.options.map((key: string) => ({
        key,
        label: key.replace(/_/g, ' '),
        helper: 'Choose the outcome you think is most likely.',
      }));
    }
    return [
      { key: 'no_rain', label: 'No Rain', helper: 'No rain during the window.' },
      { key: 'rain_before_6', label: 'Yes, before 6 PM', helper: 'Rain arrives before 6 PM.' },
      { key: 'rain_after_6', label: 'Yes, after 6 PM', helper: 'Rain arrives after 6 PM.' },
    ];
  }, [room]);

  const ownActivePrediction = useMemo(
    () => others.find((entry) => entry.isCurrentUser && entry.status !== 'revoked') ?? null,
    [others],
  );
  const effectiveEditPredictionId = editPredictionId ?? ownActivePrediction?.predictionId ?? null;
  const isEditing = !!effectiveEditPredictionId;

  useEffect(() => {
    if (answerType === 'multiple_choice' && ownActivePrediction?.selectedOptionKey) {
      setSelectedOptionKey(ownActivePrediction.selectedOptionKey);
    }
  }, [answerType, ownActivePrediction?.selectedOptionKey]);

  function adjust(seconds: number) {
    setPredicted((current) => new Date(current.getTime() + seconds * 1000));
  }

  function buildPredictedReachedTime(): string {
    if (answerType === 'duration') {
      const parsed = Number(durationMinutes);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Enter a valid duration in minutes.');
      return new Date(Date.now() + parsed * 60 * 1000).toISOString();
    }
    if (answerType === 'yes_no') {
      if (!yesNoChoice) throw new Error('Choose Yes or No first.');
      const etaMs = (benchmarks?.primary.date ?? new Date(Date.now() + routeEtaSeconds * 1000)).getTime();
      return new Date(etaMs + (yesNoChoice === 'yes' ? -60_000 : 60_000)).toISOString();
    }
    if (answerType === 'multiple_choice') {
      if (!selectedOptionKey) throw new Error('Choose an option first.');
      return new Date().toISOString();
    }
    // exact_time (arrival)
    return predicted.toISOString();
  }

  async function handleSubmit() {
    if (lockedOut) {
      return appAlert(
        'Predictions closed',
        "The traveller is almost there — guesses lock for the final 3 minutes before arrival.",
      );
    }
    let predictedReachedTime: string;
    try {
      predictedReachedTime = buildPredictedReachedTime();
    } catch (error: any) {
      return appAlert('One more thing', error.message);
    }
    setLoading(true);
    try {
      if (isEditing) {
        // v2 re-predict: replace the prior guess (reuse the update endpoint). The server
        // enforces the window (allowed through the 80% checkpoint, none after).
        await api.patch(
          `/predictions/${effectiveEditPredictionId}`,
          answerType === 'multiple_choice'
            ? { selectedOptionKey }
            : { predictedReachedTime },
        );
      } else {
        await api.post(
          `/rooms/${roomId}/predictions`,
          answerType === 'multiple_choice'
            ? { selectedOptionKey }
            : { predictedArrivalTime: predictedReachedTime },
        );
      }

      const finishNavigation = () => {
        if (navigateToRoomCreatedAfterSubmit && startJourneyAfterSubmit && isCreator && !isEditing) {
          navigation.navigate('RoomCreated', { room: { ...room, status: 'live' } });
          return;
        }
        navigation.navigate('LiveRoom', { roomId, isCreator, justPredicted: true });
      };

      if (startJourneyAfterSubmit && isCreator && !isEditing) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Location permission is needed to start the journey after your prediction.');
        }
        const coords = await Location.getCurrentPositionAsync({});
        await api.post(`/rooms/${roomId}/journey/start`, {
          startDelayMinutes: startDelayMinutes ?? 3,
          location: {
            lat: coords.coords.latitude,
            lng: coords.coords.longitude,
          },
        });
      }

      Animated.sequence([
        Animated.timing(confirmScale, { toValue: 1.05, duration: 120, useNativeDriver: true }),
        Animated.timing(confirmScale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start(() => {
        finishNavigation();
      });
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Your guess wasn't saved — try again.");
      if (startJourneyAfterSubmit && isCreator && !isEditing) {
        appAlert('Could not complete setup', message);
      } else {
        appAlert('Could not lock it in', message);
      }
    } finally {
      setLoading(false);
    }
  }

  // Late-join banner + peers' guesses — shown in both arrival and non-arrival flows.
  const lateJoinBanner = isLive ? (
    <View style={[styles.lateCard, lockedOut && styles.lateCardClosed]}>
      <Text style={styles.lateTitle}>
        {lockedOut ? '⏳ Predictions closed' : '🏁 Join the live journey'}
      </Text>
      {journeyStart ? (
        <Text style={styles.lateLine}>
          {journeyStart.getTime() > nowTick ? 'Journey starts' : 'Journey started'}{' '}
          {formatClock(journeyStart, false)}
        </Text>
      ) : null}
      {projectedArrival ? (
        <Text style={styles.lateLine}>
          Projected arrival {formatClock(projectedArrival, false)} · Oracle + route pace
        </Text>
      ) : null}
      <Text style={styles.lateNote}>
        {lockedOut
          ? 'The traveller is almost there — guesses lock for the final 3 minutes.'
          : `Predictions close ~3 min before arrival${
              secondsLeft != null && secondsLeft <= 600
                ? ` · about ${Math.max(1, Math.ceil(secondsLeft / 60))} min left`
                : ''
            }.`}
      </Text>
    </View>
  ) : null;

  const peersList =
    others.length > 0 ? (
      <View style={styles.peersWrap}>
        <RoomPredictionList data={others} />
      </View>
    ) : null;

  async function handleForwardInvite() {
    if (!sharePayload) return;
    try {
      await Share.share({
        message: sharePayload.shareText,
        title: `Join ${sharePayload.shareTitle}`,
      });
    } catch {
      appAlert('Share unavailable', 'Could not open the share sheet right now.');
    }
  }

  async function handleForwardWhatsApp() {
    if (!sharePayload) return;
    try {
      await Linking.openURL(sharePayload.whatsappUrl);
    } catch {
      appAlert('WhatsApp unavailable', 'Could not open WhatsApp right now.');
    }
  }

  const forwardCard =
    isGenericRoom && sharePayload ? (
      <View style={[styles.forwardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.forwardTitle, { color: colors.textPrimary }]}>Pass it on</Text>
        <Text style={[styles.forwardCopy, { color: colors.textSecondary }]}>
          Forward this room to others. Anyone who joins uses the same countdown and lock time.
        </Text>
        <View style={styles.forwardActions}>
          <View style={styles.forwardAction}>
            <PrimaryButton label="Forward on WhatsApp" onPress={handleForwardWhatsApp} icon="💬" />
          </View>
          <View style={styles.forwardAction}>
            <PrimaryButton label="Share Invite" onPress={handleForwardInvite} variant="secondary" icon="📨" />
          </View>
        </View>
      </View>
    ) : null;

  // ---- Arrival (benchmark-anchored) experience ----
  if (isArrival) {
    const ordered = benchmarks?.ordered ?? [];
    return (
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <SectionHeader
          title="What's your call?"
          subtitle="Line up your guess against the benchmarks below. Closest to the real arrival wins."
        />

        {lateJoinBanner}

        <Text style={styles.routeLine}>
          {room?.startingPointLabel ?? room?.routeSummary?.startLabel ?? 'Start'} →{' '}
          {room?.destinationLabel ?? room?.routeSummary?.destinationLabel ?? 'Destination'} ·{' '}
          {formatDateLabel(predicted)}
        </Text>

        {journeyStart ? (
          <View style={styles.startCard}>
            <Text style={styles.startLabel}>Journey start</Text>
            <Text style={styles.startTime}>{formatClock(journeyStart, false)}</Text>
            <Text style={styles.startHint}>Use the actual start time plus the benchmark end times below to make your call.</Text>
          </View>
        ) : null}

        {ordered.length ? (
          <View style={styles.benchPanel}>
            <Text style={styles.benchLegend}>
              Maps is the neutral baseline. The bot's guess is just for fun. Closest to the real
              arrival wins — that's the number to beat.
            </Text>
            {benchmarks?.maps ? (
              <View style={styles.benchRow}>
                <View style={styles.benchLabelWrap}>
                  <Text style={styles.benchLabel}>🌍 Maps baseline</Text>
                  <Text style={styles.benchSub}>{benchmarks.maps.verified ? 'Verified estimate' : 'Neutral estimate'}</Text>
                </View>
                <Text style={styles.benchTimeSmall}>{formatClock(benchmarks.maps.date, false)}</Text>
              </View>
            ) : null}
            {benchmarks?.host ? (
              <View style={styles.benchRow}>
                <Text style={styles.benchLabel}>👑 Host's call</Text>
                <Text style={styles.benchTimeSmall}>{formatClock(benchmarks.host.date, false)}</Text>
              </View>
            ) : null}
            {benchmarks?.oracle ? (
              <Text style={styles.botLine}>🤖 {botGuessTeaser(formatClock(benchmarks.oracle.date, false))}</Text>
            ) : null}
          </View>
        ) : (
          <InfoTip
            title="Heads up"
            body="This room has no benchmark yet, so use your best judgement — arrival time only."
          />
        )}

        {/* Snap-to-benchmark + nudge chips */}
        <View style={styles.chipsWrap}>
          {ordered.map((b) => (
            <TouchableOpacity
              key={`snap-${b.key}`}
              style={[styles.chip, styles.chipAnchor]}
              onPress={() => setPredicted(new Date(b.date))}
            >
              <Text style={styles.chipAnchorText}>{benchmarkChipLabel(b)}</Text>
            </TouchableOpacity>
          ))}
          {ADJUSTMENTS.map((a) => (
            <TouchableOpacity key={a.label} style={styles.chip} onPress={() => adjust(a.seconds)}>
              <Text style={styles.chipText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TimePickerSegments value={predicted} onChange={setPredicted} showSeconds />

        {/* Live "your call" + diffs vs each benchmark */}
        <View style={styles.callCard}>
          <Text style={styles.callLabel}>Your call · the one that counts</Text>
          <Text style={styles.callTime}>{formatClock(predicted, true)}</Text>
          {ordered.length ? (
            <View style={styles.diffRows}>
              {ordered.map((b) => {
                const d = diffLabel(predicted, b.date);
                const tone = d === 'same' ? colors.textSecondary : d.startsWith('+') ? colors.amber : colors.green;
                return (
                  <Text key={`diff-${b.key}`} style={[styles.diffText, { color: tone }]}>
                    {d} vs {benchmarkChipLabel(b)}
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>

        {forwardCard}

        {peersList}

        <Animated.View style={{ transform: [{ scale: confirmScale }] }}>
          <PrimaryButton
            label={lockedOut ? 'Predictions closed' : isEditing ? 'Update prediction' : 'Lock it in'}
            onPress={handleSubmit}
            loading={loading}
            disabled={lockedOut}
            icon="🎯"
          />
        </Animated.View>
        <Text style={styles.fairnessNote}>
          Benchmarks just help you decide — only the real arrival time decides the winner.
        </Text>
      </ScrollView>
    );
  }

  // ---- Non-arrival answer types (duration / yes-no / multiple choice) ----
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <SectionHeader title="What's your call?" subtitle="Make a hidden, privacy-safe guess. Closest wins Aura." />

      {lateJoinBanner}

      <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {answerType === 'duration' ? (
          <PredictionInputDuration value={durationMinutes} onChange={setDurationMinutes} durationChoices={durationChoices} />
        ) : null}

        {answerType === 'yes_no' ? (
          <>
            {foodEtaBenchmarkLabel ? (
              <InfoTip
                title="Delivery app benchmark"
                body={`${foodEtaBenchmarkLabel}. Your call is judged against that ETA.`}
              />
            ) : null}
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Choose Yes or No. This stays hidden until lock.
            </Text>
            <PredictionInputYesNo
              value={yesNoChoice}
              onChange={setYesNoChoice}
              title={room?.question ?? 'Will it happen?'}
              helper={
                foodEtaBenchmarkLabel
                  ? 'Pick Yes if you think it beats the benchmark. Pick No if you think it misses.'
                  : 'Choose the side you believe is most likely.'
              }
              yesSubLabel={foodEtaBenchmarkLabel ? 'Beats it' : 'Yes side'}
              noSubLabel={foodEtaBenchmarkLabel ? 'Misses it' : 'No side'}
            />
          </>
        ) : null}

        {answerType === 'multiple_choice' ? (
          <>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Choose the outcome you believe is most likely. Oracle Bot is only a benchmark.
            </Text>
            <View style={styles.optionStack}>
              {multipleChoiceOptions.map((option: any) => (
                <View key={option.key} style={{ marginBottom: 10 }}>
                  <PrimaryButton
                    label={option.label}
                    onPress={() => setSelectedOptionKey(option.key)}
                    variant={selectedOptionKey === option.key ? 'primary' : 'secondary'}
                  />
                  <Text style={[styles.optionHelper, { color: colors.textSecondary }]}>{option.helper}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>

      {forwardCard}

      {peersList}

      <Animated.View style={{ transform: [{ scale: confirmScale }] }}>
        <PrimaryButton
          label={lockedOut ? 'Predictions closed' : isEditing ? 'Update prediction' : 'Lock it in'}
          onPress={handleSubmit}
          loading={loading}
          disabled={lockedOut}
          icon="🎯"
        />
      </Animated.View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.xl, gap: spacing.md },
  routeLine: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
  lateCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
    backgroundColor: 'rgba(34,211,238,0.10)',
    padding: spacing.md,
    gap: 3,
  },
  lateCardClosed: {
    borderColor: 'rgba(245,158,11,0.5)',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  lateTitle: { color: palette.textPrimary, fontSize: 15, fontWeight: '900' },
  lateLine: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
  lateNote: { color: palette.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  peersWrap: { marginTop: spacing.xs },
  forwardCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  forwardTitle: { fontSize: 16, fontWeight: '900' },
  forwardCopy: { fontSize: 13, lineHeight: 19 },
  forwardActions: { flexDirection: 'row', gap: spacing.sm },
  forwardAction: { flex: 1 },
  startCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#f6efe6',
    padding: spacing.md,
    gap: 4,
  },
  startLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  startTime: { color: palette.textPrimary, fontSize: 22, fontWeight: '900' },
  startHint: { color: palette.textSecondary, fontSize: 12, lineHeight: 17 },
  benchPanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  benchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  benchLabelWrap: { gap: 1 },
  benchLabel: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
  benchSub: { color: palette.textMuted, fontSize: 11, fontWeight: '600' },
  benchLegend: { color: palette.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.xs },
  // Maps/host are small neutral baselines; the winner is the closest guess (your call).
  benchTime: { color: palette.textPrimary, fontSize: 18, fontWeight: '900' },
  benchTimeSmall: { color: palette.textSecondary, fontSize: 16, fontWeight: '800' },
  botLine: { color: palette.violetLight, fontSize: 13, fontWeight: '800', fontStyle: 'italic' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceHigh,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { color: palette.textPrimary, fontSize: 13, fontWeight: '800' },
  chipAnchor: { borderColor: 'rgba(34,211,238,0.5)', backgroundColor: 'rgba(34,211,238,0.16)' },
  chipAnchorText: { color: palette.violetLight, fontSize: 13, fontWeight: '900' },
  callCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    backgroundColor: 'rgba(34,211,238,0.08)',
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  callLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  callTime: { color: palette.textPrimary, fontSize: 32, fontWeight: '900' },
  diffRows: { alignItems: 'center', gap: 2, marginTop: spacing.xs },
  diffText: { fontSize: 13, fontWeight: '800' },
  fairnessNote: { color: palette.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  inputCard: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1 },
  helperText: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  optionStack: { marginBottom: 4 },
  optionHelper: { fontSize: 12, lineHeight: 17, marginTop: 6 },
});
