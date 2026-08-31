import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Share,
  Linking,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { appAlert } from '../utils/appAlert';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import InfoTip from '../components/InfoTip';
import SectionHeader from '../components/SectionHeader';
import PredictionInputDuration from '../components/PredictionInputDuration';
import PredictionInputYesNo from '../components/PredictionInputYesNo';
import RoomPredictionList, { RoomPredictionEntry } from '../components/RoomPredictionList';
import { buildSharePayload, openWhatsAppWithText } from '../utils/shareRoom';
import { diffLabel, formatClock, formatDateLabel } from '../utils/benchmarks';
import { useArrivalPredictionState } from '../hooks/useArrivalPredictionState';
import { layout, palette, radius, spacing } from '../theme/designSystem';
import TimePickerSegments from '../components/TimePickerSegments';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Prediction'>;
  route: RouteProp<RootStackParamList, 'Prediction'>;
};

const durationChoices = [20, 30, 45, 60];

function shortenPlaceLabel(label: string | null | undefined): string {
  if (!label) return 'Unknown';
  const firstChunk = label.split(',')[0]?.trim() || label.trim();
  return firstChunk.length > 28 ? `${firstChunk.slice(0, 25).trimEnd()}…` : firstChunk;
}

function buildRouteLabel(room: any) {
  const start = shortenPlaceLabel(room?.startingPointLabel ?? room?.routeSummary?.startLabel);
  const end = shortenPlaceLabel(room?.destinationLabel ?? room?.routeSummary?.destinationLabel);
  return `${start} → ${end}`;
}

function formatFriendlyDiff(prediction: Date, benchmark: Date, label: string) {
  const delta = diffLabel(prediction, benchmark);
  if (delta === 'same') return `Same as ${label}`;
  const direction = delta.startsWith('+') ? 'after' : 'before';
  const clean = delta.replace(/^[+-]/, '').replace(/m/g, ' min').replace(/s/g, ' sec');
  return `${clean} ${direction} ${label}`;
}

export default function PredictionScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { roomId, room: roomParam, editPredictionId, returnToRoomCreated } = route.params;
  const isDesktop = width >= layout.breakpoints.tablet;
  const isEditing = !!editPredictionId;
  const [room, setRoom] = useState<any>(roomParam);
  const [loading, setLoading] = useState(false);
  // Late-join context: peers' guesses (already un-hidden once the room is live)
  // and a ticking clock to enforce the "closes 3 min before arrival" cutoff.
  const [others, setOthers] = useState<RoomPredictionEntry[]>([]);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const category = room?.category ?? room?.templateKey ?? roomParam?.category ?? roomParam?.templateKey;
  const isGenericRoom = category === 'open_prediction';
  const isCreator = !!user?.userId && !!(room?.creatorUserId ?? roomParam?.creatorUserId) && user.userId === (room?.creatorUserId ?? roomParam?.creatorUserId);
  const isTrackedJourneyRoom = ['journey', 'milestone_journey', 'travel', 'fitness'].includes(
    String(room?.roomCategory ?? roomParam?.roomCategory ?? ''),
  );

  const answerType = room?.answerType ?? 'exact_time';
  const isArrival = answerType === 'exact_time';
  const alreadyPredicted = !!room?.viewerHasPredicted && !isEditing;
  const { benchmarks, predicted, setPredicted, hotTake, setHotTake } = useArrivalPredictionState(room);
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
        ? buildSharePayload(
            {
              ...room,
              roomTitle: room.roomTitle ?? room.title,
              inviteCode,
            },
            // Tag forwards from a non-creator so the chain is recorded (backend
            // ignores forwardedBy when it equals the creator).
            isCreator ? undefined : user?.userId,
          )
        : null,
    [room, inviteCode, isCreator, user?.userId],
  );
  const confirmScale = useRef(new Animated.Value(1)).current;
  const submittingRef = useRef(false);

  // Navigating forward leaves this screen mounted in the stack, so a submit guard that
  // is never released would strand the button on a spinner if the user comes back.
  // Returning here is also the one moment it is safe to accept a fresh submit again.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      submittingRef.current = false;
      setLoading(false);
    });
    return unsubscribe;
  }, [navigation]);
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

  async function autoStartJourneyIfNeeded() {
    // Creator setup prediction (returnToRoomCreated) must NOT start the journey — the
    // creator lands on RoomCreated to share the invite first, then starts driving later.
    if (isEditing || !isCreator || !isTrackedJourneyRoom || returnToRoomCreated) return false;
    const roomStatus = String(room?.status ?? roomParam?.status ?? '');
    if (roomStatus === 'live') return true;

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      const coords = permission.status === 'granted' ? await Location.getCurrentPositionAsync({}) : null;
      await api.post(`/rooms/${roomId}/journey/start`, {
        startDelayMinutes: 0,
        location: coords
          ? { lat: coords.coords.latitude, lng: coords.coords.longitude }
          : undefined,
      });
      return true;
    } catch (error) {
      appAlert(
        'Prediction saved',
        getApiErrorMessage(error, 'Your prediction is in, but we could not start the journey automatically. You can still start it from the live room.'),
      );
      return false;
    }
  }

  async function handleSubmit() {
    // `loading` alone cannot gate this: it is React state, so a second tap arriving
    // during the confirm animation and journey-start round-trip that follow the save
    // would read a stale value and file a duplicate prediction. The ref closes that
    // window and is released only on failure or when the screen is returned to.
    if (submittingRef.current) return;
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
    submittingRef.current = true;
    setLoading(true);
    try {
      const trimmedHotTake = hotTake.trim();
      if (isEditing) {
        // v2 re-predict: replace the prior guess (reuse the update endpoint). The server
        // enforces the window (allowed through the 80% checkpoint, none after).
        await api.patch(
          `/rooms/${roomId}/${editPredictionId}`,
          answerType === 'multiple_choice'
            ? { selectedOptionKey, hotTake: trimmedHotTake || undefined }
            : { predictedReachedTime, hotTake: trimmedHotTake || undefined },
        );
      } else {
        await api.post(
          `/rooms/${roomId}/predictions`,
          answerType === 'multiple_choice'
            ? { selectedOptionKey, hotTake: trimmedHotTake || undefined }
            : { predictedArrivalTime: predictedReachedTime, hotTake: trimmedHotTake || undefined },
        );
      }
      Animated.sequence([
        Animated.timing(confirmScale, { toValue: 1.05, duration: 120, useNativeDriver: true }),
        Animated.timing(confirmScale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start(async () => {
        const startedJourney = await autoStartJourneyIfNeeded();
        if (startedJourney) {
          navigation.navigate('LiveRoom', { roomId, isCreator: true, justPredicted: true });
          return;
        }
        if (returnToRoomCreated && !isEditing) {
          navigation.navigate('RoomCreated', { room });
          return;
        }
        navigation.navigate('LiveRoom', { roomId, isCreator: false, justPredicted: true });
      });
      // Deliberately no `finally`: on success the button stays busy until this screen
      // is left behind, so the confirm animation and journey-start round-trip cannot be
      // interrupted by a second tap. Only the failure path hands control back.
    } catch (err: unknown) {
      submittingRef.current = false;
      setLoading(false);
      appAlert('Could not lock it in', getApiErrorMessage(err, "Your guess wasn't saved — try again."));
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
      const opened = await openWhatsAppWithText(sharePayload.whatsappText);
      if (!opened) appAlert('WhatsApp unavailable', 'Could not open WhatsApp right now.');
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

  if (alreadyPredicted) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <SectionHeader
          title="You're already in"
          subtitle="Your prediction is saved for this room. Jump back in to follow the live updates."
        />
        {peersList}
        <PrimaryButton
          label="Go to room"
          onPress={() => navigation.navigate('LiveRoom', { roomId, isCreator })}
          icon="🚪"
        />
        {forwardCard}
      </ScrollView>
    );
  }

  // ---- Arrival (benchmark-anchored) experience ----
  if (isArrival) {
    const routeLabel = buildRouteLabel(room);
    const mapsBenchmark = benchmarks?.maps ?? benchmarks?.primary ?? null;
    const botBenchmark = benchmarks?.oracle ?? null;
    const hostBenchmark = benchmarks?.host ?? null;
    const expectedDurationMinutes = Math.max(
      1,
      Math.round(
        (room?.route?.estimatedDurationSeconds ??
          room?.routeSummary?.estimatedDurationSeconds ??
          room?.baselineValue ??
          0) / 60,
      ),
    );
    const travelModeLabel =
      String(room?.route?.travelModeLabel ?? room?.route?.travelMode ?? room?.routeSummary?.travelMode ?? 'Car')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    const participantCount =
      typeof room?.participantCount === 'number'
        ? room.participantCount
        : typeof room?.participantsCount === 'number'
          ? room.participantsCount
          : others.length + (alreadyPredicted ? 1 : 0);
    const countdownCopy = lockedOut
      ? 'Predictions are closed for this journey.'
      : secondsLeft != null
        ? `Predictions close in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
        : room?.predictionCloseTime
          ? `Locks at ${formatClock(new Date(room.predictionCloseTime), false)}`
          : 'Make your prediction before it closes.';
    const comparisonToShow = mapsBenchmark
      ? formatFriendlyDiff(predicted, mapsBenchmark.date, 'Maps')
      : botBenchmark
        ? formatFriendlyDiff(predicted, botBenchmark.date, 'the bot')
        : null;

    return (
      <ScrollView
        contentContainerStyle={[
          styles.container,
          styles.journeyContainer,
          { backgroundColor: palette.bg, maxWidth: layout.maxWideWidth, alignSelf: 'center', width: '100%' },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.journeyTitleRow}>
          <Text style={styles.journeyRouteTitle}>{routeLabel}</Text>
          <View style={styles.journeyStatusPill}>
            <Text style={styles.journeyStatusText}>{lockedOut ? 'Journey locked' : 'Journey open'}</Text>
          </View>
        </View>

        <LinearGradient colors={['rgba(123,63,228,0.18)', 'rgba(59,130,246,0.08)']} style={styles.journeyHeroCard}>
          <View style={styles.journeyHeroTop}>
            <View style={styles.journeyHeroCopy}>
              <Text style={styles.journeyHeroTitle}>{lockedOut ? 'Journey is locked' : 'Journey is open'}</Text>
              <Text style={styles.journeyHeroSubtitle}>
                {lockedOut ? 'Predictions are in. The reveal comes next.' : 'Make your prediction before it closes.'}
              </Text>
            </View>
            {sharePayload ? (
              <View style={styles.heroInviteButton}>
                <PrimaryButton
                  label="Invite friends"
                  onPress={handleForwardInvite}
                  variant="secondary"
                  fullWidth={false}
                />
              </View>
            ) : null}
          </View>
          <View style={styles.journeyHeroBottom}>
            <Text style={styles.journeyCountdown}>{countdownCopy}</Text>
            {room?.predictionCloseTime ? (
              <Text style={styles.journeyCountdownMeta}>
                Locks at {formatClock(new Date(room.predictionCloseTime), false)}
              </Text>
            ) : null}
          </View>
        </LinearGradient>

        <View style={styles.metricStrip}>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Expected duration</Text>
            <Text style={styles.metricValue}>{expectedDurationMinutes} min</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Mode</Text>
            <Text style={styles.metricValue}>{travelModeLabel}</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Privacy</Text>
            <Text style={[styles.metricValue, styles.metricValueSuccess]}>Location hidden</Text>
          </View>
        </View>

        {lateJoinBanner}

        <Text style={styles.routeLine}>{formatDateLabel(predicted)} · {participantCount} {participantCount === 1 ? 'friend' : 'friends'} in the room</Text>

        {journeyStart ? (
          <View style={styles.startCard}>
            <Text style={styles.startLabel}>Journey start</Text>
            <Text style={styles.startTime}>{formatClock(journeyStart, false)}</Text>
            <Text style={styles.startHint}>Use the route estimate, the bot, or your own instinct to make the best call.</Text>
          </View>
        ) : null}

        <View style={styles.predictionJourneyCard}>
          <View style={styles.predictionJourneyHeader}>
            <View>
              <Text style={styles.predictionJourneyTitle}>Make your prediction</Text>
              <Text style={styles.predictionJourneyHelper}>Closest to the actual arrival time wins.</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Help')}>
              <Text style={styles.predictionHowItWorks}>How it works</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.benchmarkCardsRow, !isDesktop && styles.benchmarkCardsColumn]}>
            {mapsBenchmark ? (
              <View style={styles.benchmarkCard}>
                <Text style={styles.benchmarkCardLabel}>Google Maps</Text>
                <Text style={styles.benchmarkCardSub}>Baseline estimate</Text>
                <Text style={styles.benchmarkCardValue}>{formatClock(mapsBenchmark.date, false)}</Text>
              </View>
            ) : null}
            {botBenchmark ? (
              <View style={styles.benchmarkCard}>
                <Text style={styles.benchmarkCardLabel}>The bot</Text>
                <Text style={styles.benchmarkCardSub}>Bot prediction</Text>
                <Text style={styles.benchmarkCardValue}>{formatClock(botBenchmark.date, false)}</Text>
              </View>
            ) : null}
            <View style={[styles.benchmarkCard, styles.predictionCenterCard]}>
              <Text style={styles.predictionCenterLabel}>Your prediction</Text>
              <TimePickerSegments value={predicted} onChange={setPredicted} showSeconds={false} showAmPm />
              {comparisonToShow ? <Text style={styles.predictionCenterHint}>{comparisonToShow}</Text> : null}
            </View>
            {hostBenchmark ? (
              <View style={styles.benchmarkCard}>
                <Text style={styles.benchmarkCardLabel}>Host guess</Text>
                <Text style={styles.benchmarkCardSub}>Host call</Text>
                <Text style={styles.benchmarkCardValue}>{formatClock(hostBenchmark.date, false)}</Text>
              </View>
            ) : null}
          </View>

          <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.predictionShortcutRow}>
            {benchmarks?.ordered.map((benchmark) => (
              <TouchableOpacity
                key={benchmark.key}
                style={[styles.predictionShortcut, styles.predictionShortcutAccent]}
                onPress={() => setPredicted(new Date(benchmark.date))}
              >
                <Text style={styles.predictionShortcutAccentText}>
                  {benchmark.key === 'maps' ? 'Maps ETA' : benchmark.key === 'oracle' ? 'Bot guess' : 'Host guess'}
                </Text>
              </TouchableOpacity>
            ))}
            {[
              { label: '−1 min', seconds: -60 },
              { label: '−30 sec', seconds: -30 },
              { label: '+30 sec', seconds: 30 },
              { label: '+1 min', seconds: 60 },
              { label: '+2 min', seconds: 120 },
              { label: '+5 min', seconds: 300 },
            ].map((chip) => (
              <TouchableOpacity
                key={chip.label}
                style={styles.predictionShortcut}
                onPress={() => setPredicted(new Date(predicted.getTime() + chip.seconds * 1000))}
              >
                <Text style={styles.predictionShortcutText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.tipBanner}>
            <Text style={styles.tipBannerText}>Tip: You can change your prediction any time before it locks.</Text>
          </View>
        </View>

        {forwardCard}

        {peersList}

        <Animated.View style={{ transform: [{ scale: confirmScale }] }}>
          <PrimaryButton
            label={lockedOut ? 'Predictions closed' : 'Lock it in'}
            onPress={handleSubmit}
            loading={loading}
            disabled={lockedOut}
            gradientColors={['#7C3AED', '#2563EB']}
          />
        </Animated.View>
        <PrimaryButton
          label="Go to room"
          onPress={() => navigation.navigate('LiveRoom', { roomId, isCreator })}
          variant="secondary"
          icon="🚪"
        />
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
              Choose the outcome you believe is most likely. The bot is only a benchmark.
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
          label={lockedOut ? 'Predictions closed' : 'Lock it in'}
          onPress={handleSubmit}
          loading={loading}
          disabled={lockedOut}
          icon="🎯"
        />
      </Animated.View>
      <PrimaryButton
        label="Go to room"
        onPress={() => navigation.navigate('LiveRoom', { roomId, isCreator })}
        variant="secondary"
        icon="🚪"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.xl, gap: spacing.md },
  journeyContainer: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  journeyTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  journeyRouteTitle: { flex: 1, color: palette.textPrimary, fontSize: 18, fontWeight: '900', lineHeight: 24 },
  journeyStatusPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.28)',
    backgroundColor: 'rgba(17,94,89,0.28)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  journeyStatusText: { color: '#E5FFF4', fontSize: 12, fontWeight: '800' },
  journeyHeroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(123,63,228,0.35)',
    backgroundColor: 'rgba(15,21,39,0.95)',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  journeyHeroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  journeyHeroCopy: { flex: 1, gap: 4 },
  journeyHeroTitle: { color: palette.textPrimary, fontSize: 17, fontWeight: '900' },
  journeyHeroSubtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20 },
  heroInviteButton: { minWidth: 170 },
  journeyHeroBottom: { gap: 4 },
  journeyCountdown: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  journeyCountdownMeta: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
  metricStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(123,63,228,0.22)',
    backgroundColor: 'rgba(15,21,39,0.92)',
    overflow: 'hidden',
  },
  metricCell: { flex: 1, minWidth: 160, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 4 },
  metricLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '700' },
  metricValue: { color: palette.textPrimary, fontSize: 16, fontWeight: '900' },
  metricValueSuccess: { color: '#4ADE80' },
  routeLine: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
  lateCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(123,63,228,0.4)',
    backgroundColor: 'rgba(91,33,182,0.14)',
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
  predictionJourneyCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(123,63,228,0.28)',
    backgroundColor: 'rgba(12,18,36,0.96)',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  predictionJourneyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  predictionJourneyTitle: { color: palette.textPrimary, fontSize: 18, fontWeight: '900' },
  predictionJourneyHelper: { color: palette.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  predictionHowItWorks: { color: '#67E8F9', fontSize: 14, fontWeight: '800' },
  benchmarkCardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  benchmarkCardsColumn: { flexDirection: 'column' },
  benchmarkCard: {
    flex: 1,
    minWidth: 160,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(123,63,228,0.2)',
    backgroundColor: 'rgba(18,26,47,0.9)',
    padding: spacing.lg,
    gap: 6,
  },
  benchmarkCardLabel: { color: '#7DD3FC', fontSize: 15, fontWeight: '900' },
  benchmarkCardSub: { color: palette.textSecondary, fontSize: 13, lineHeight: 18 },
  benchmarkCardValue: { color: palette.textPrimary, fontSize: 20, fontWeight: '900' },
  predictionCenterCard: { minWidth: 260, alignItems: 'center' },
  predictionCenterLabel: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    alignSelf: 'center',
  },
  predictionCenterHint: { color: '#C4B5FD', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  predictionShortcutRow: { flexDirection: 'row', gap: spacing.sm },
  predictionShortcut: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(123,63,228,0.24)',
    backgroundColor: 'rgba(18,26,47,0.9)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  predictionShortcutAccent: {
    borderColor: 'rgba(103,232,249,0.4)',
    backgroundColor: 'rgba(14,116,144,0.14)',
  },
  predictionShortcutText: { color: palette.textPrimary, fontSize: 13, fontWeight: '800' },
  predictionShortcutAccentText: { color: '#67E8F9', fontSize: 13, fontWeight: '900' },
  tipBanner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(123,63,228,0.16)',
    backgroundColor: 'rgba(30,41,59,0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  tipBannerText: { color: palette.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '600' },
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
  fairnessNote: { color: palette.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  inputCard: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1 },
  helperText: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  optionStack: { marginBottom: 4 },
  optionHelper: { fontSize: 12, lineHeight: 17, marginTop: 6 },
});
