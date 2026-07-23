import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, Alert, Linking } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { RootStackParamList } from '../navigation/types';
import PrimaryButton from '../components/PrimaryButton';
import ArrivalJourneyViz from '../components/ArrivalJourneyViz';
import FoodEtaViz from '../components/FoodEtaViz';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import appAlert from '../utils/appAlert';
import {
  getRoomTheme,
  resolveRoomSubtype,
  getOpenPredictionSubtypeConfig,
} from '../config/categoryTheme';
import LiveStatusCard from '../components/LiveStatusCard';
import CoachMark from '../components/CoachMark';
import ArrivalWaitingRoom from '../components/ArrivalWaitingRoom';
import RoomPredictionList, { RoomPredictionEntry } from '../components/RoomPredictionList';
import CheckpointLeaderboard, { CheckpointBoard } from '../components/CheckpointLeaderboard';
import { deriveArrivalBenchmarks, formatClock } from '../utils/benchmarks';
import { botGuessTeaser, botEtaTeaser } from '../utils/botVoice';
import { layout, palette } from '../theme/designSystem';
import { featureFlags } from '../config/featureFlags';

// v2 (checkpoint_leaderboard_v2): six time-based checkpoints; v1 samples 50/80.
const V2_CHECKPOINTS = [20, 40, 60, 80, 90, 100];
const V1_CHECKPOINTS = [50, 80];
const ETA_MOVE_NOTIFY_THRESHOLD_MS = 20 * 60 * 1000;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LiveRoom'>;
  route: RouteProp<RootStackParamList, 'LiveRoom'>;
};

interface LiveState {
  roomId: string;
  status: string;
  journeyStatus?: string;
  plannedStartTime: string | null;
  startTime: string | null;
  autoCloseAt?: string | null;
  expectedDurationSeconds?: number | null;
  gracePeriodSeconds?: number | null;
  closureReasonCode?: string | null;
  lifecycleMessage?: string | null;
  visibleMovementStartTime: string | null;
  defaultStartDelayMinutes?: number;
  secondsUntilStart: number | null;
  progressPercentage: number | null;
  etaMinutes: number | null;
  locationDisplayMode: string;
  safetyMessage: string;
  waitingForDelayedStart?: boolean;
  milestoneBanner?: { checkpoint: number; message: string } | null;
}

function latestAvailableCheckpointBoard(
  boards: Record<number, CheckpointBoard | undefined>,
): Extract<CheckpointBoard, { available: true }> | null {
  const available = Object.values(boards).filter(
    (board): board is Extract<CheckpointBoard, { available: true }> => !!board && board.available,
  );
  if (!available.length) return null;
  return available.reduce((best, board) => (board.checkpoint > best.checkpoint ? board : best));
}

const startDelayOptions = [3, 5, 10, 15] as const;

export default function LiveRoomScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { roomId, isCreator: isCreatorParam, justPredicted } = route.params;
  const [showLockedReassurance, setShowLockedReassurance] = useState(!!justPredicted);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [room, setRoom] = useState<any | null>(null);
  const [actualOptionKey, setActualOptionKey] = useState<string | null>(null);
  const [startDelayMinutes, setStartDelayMinutes] = useState(3);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmingArrival, setConfirmingArrival] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [guessSummary, setGuessSummary] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<RoomPredictionEntry[]>([]);
  const [checkpointBoards, setCheckpointBoards] = useState<Record<number, CheckpointBoard | undefined>>({});
  const [myPredictionDate, setMyPredictionDate] = useState<Date | null>(null);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [etaMovedBanner, setEtaMovedBanner] = useState<string | null>(null);
  const etaMovedShown = useRef<Set<number>>(new Set());
  const [viewerCountdownSeconds, setViewerCountdownSeconds] = useState<number | null>(null);
  const [lockCountdownSeconds, setLockCountdownSeconds] = useState<number | null>(null);
  const [reviewCountdownSeconds, setReviewCountdownSeconds] = useState<number | null>(null);
  const sampledCheckpoints = useRef<Set<number>>(new Set());
  const firedMilestones = useRef<Set<number>>(new Set());
  const viewerCountdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCreator =
    !!isCreatorParam ||
    room?.viewerIsCreator === true ||
    (!!user?.userId &&
      (user.userId === room?.creatorUserId || user.userId === room?.creator?.userId));

  // Pulsing LIVE dot animation
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    fetchLiveState();
    fetchRoom();
    fetchPredictions();
    fetchCheckpointBoards();
    const interval = setInterval(() => {
      fetchLiveState();
      fetchPredictions();
      fetchCheckpointBoards();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (viewerCountdownInterval.current) {
      clearInterval(viewerCountdownInterval.current);
      viewerCountdownInterval.current = null;
    }

    if (
      isCreator ||
      !liveState?.waitingForDelayedStart ||
      !liveState.visibleMovementStartTime
    ) {
      setViewerCountdownSeconds(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(liveState.visibleMovementStartTime as string).getTime() - Date.now()) / 1000),
      );
      setViewerCountdownSeconds(remaining);

      if (remaining <= 0) {
        if (viewerCountdownInterval.current) {
          clearInterval(viewerCountdownInterval.current);
          viewerCountdownInterval.current = null;
        }
        void fetchLiveState();
      }
    };

    updateCountdown();
    viewerCountdownInterval.current = setInterval(updateCountdown, 1000);

    return () => {
      if (viewerCountdownInterval.current) {
        clearInterval(viewerCountdownInterval.current);
        viewerCountdownInterval.current = null;
      }
    };
  }, [isCreator, liveState?.waitingForDelayedStart, liveState?.visibleMovementStartTime]);

  useEffect(() => {
    if (!isCreator || !liveState?.startTime || !liveState?.expectedDurationSeconds) return;
    const v2 = featureFlags.checkpointLeaderboardV2;
    const checkpoints = v2 ? V2_CHECKPOINTS : V1_CHECKPOINTS;
    // One-shot timer per checkpoint at pct × initial ETA. A checkpoint whose target is
    // already in the past fires with delay 0 — that IS the catch-up reconcile when the
    // screen (re)mounts after backgrounding: any missed checkpoint fires once now.
    const timers = checkpoints.map((checkpoint) => {
      if (sampledCheckpoints.current.has(checkpoint)) return null;
      const targetMs =
        new Date(liveState.startTime as string).getTime() +
        (liveState.expectedDurationSeconds ?? 0) * 1000 * (checkpoint / 100);
      const delay = Math.max(0, targetMs - Date.now());
      return setTimeout(async () => {
        try {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (permission.status !== 'granted') return;
          const coords = await Location.getCurrentPositionAsync({});
          if (v2) {
            await api.post(`/rooms/${roomId}/checkpoint`, {
              checkpointPct: checkpoint,
              lat: coords.coords.latitude,
              lng: coords.coords.longitude,
            });
          } else {
            await api.post(`/rooms/${roomId}/location-update`, {
              rawLat: coords.coords.latitude,
              rawLng: coords.coords.longitude,
              progressPercentage: checkpoint,
            });
          }
          sampledCheckpoints.current.add(checkpoint);
        } catch {
          // silent degradation
        }
      }, delay);
    });

    return () => {
      timers.forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [isCreator, liveState?.startTime, liveState?.expectedDurationSeconds, roomId]);

  // v2: surface the >20-min "ETA moved" signal (same threshold the backend notifies on)
  // by comparing the latest checkpoint's projected arrival to the original start ETA.
  useEffect(() => {
    if (!featureFlags.checkpointLeaderboardV2) return;
    if (!liveState?.startTime || !liveState?.expectedDurationSeconds) return;
    const expectedArrival =
      new Date(liveState.startTime).getTime() + liveState.expectedDurationSeconds * 1000;
    const latest = latestAvailableCheckpointBoard(checkpointBoards);
    if (!latest) return;
    const drift = Math.abs(new Date(latest.projectedArrivalAt).getTime() - expectedArrival);
    if (drift > ETA_MOVE_NOTIFY_THRESHOLD_MS && !etaMovedShown.current.has(latest.checkpoint)) {
      etaMovedShown.current.add(latest.checkpoint);
      setEtaMovedBanner(`Heads up — the arrival estimate moved by about ${Math.round(drift / 60000)} min.`);
      setTimeout(() => setEtaMovedBanner(null), 6000);
    }
  }, [checkpointBoards, liveState?.startTime, liveState?.expectedDurationSeconds]);

  // Countdown to the prediction lock, shown only while guessing is still OPEN so the
  // "closes in mm:ss" moment is unmistakable. Presentation only — the server still
  // owns when predictions actually lock.
  useEffect(() => {
    const rawStatus = liveState?.status ?? room?.status;
    const normStatus = rawStatus === 'prediction_open' ? 'predictions_open' : rawStatus;
    const isOpen = normStatus === 'predictions_open' || normStatus === 'created';
    const lockAtRaw = room?.predictionCloseTime ?? room?.lockTime;
    if (!isOpen || !lockAtRaw) {
      setLockCountdownSeconds(null);
      return;
    }
    const target = new Date(lockAtRaw).getTime();
    if (Number.isNaN(target)) {
      setLockCountdownSeconds(null);
      return;
    }
    const tick = () => setLockCountdownSeconds(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [liveState?.status, room?.status, room?.predictionCloseTime, room?.lockTime]);

  useEffect(() => {
    const mine = predictions.find((entry: any) => entry.isCurrentUser && entry.status !== 'revoked');
    const rawDeadline = mine?.editDeadline;
    if (!featureFlags.checkpointLeaderboardV2 || !rawDeadline) {
      setReviewCountdownSeconds(null);
      return;
    }
    const target = new Date(rawDeadline).getTime();
    if (Number.isNaN(target)) {
      setReviewCountdownSeconds(null);
      return;
    }
    const tick = () => setReviewCountdownSeconds(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [predictions]);

  async function fetchRoom() {
    try {
      const res = await api.get(`/rooms/${roomId}`);
      setRoom(res.data);
    } catch {
      // Live state can still render if room details are temporarily unavailable.
    }
  }

  async function fetchLiveState() {
    try {
      const res = await api.get(`/rooms/${roomId}/live-state`);
      setLiveState(res.data);
      if (!res.data.startTime && res.data.defaultStartDelayMinutes) {
        setStartDelayMinutes(res.data.defaultStartDelayMinutes);
      }
      const milestone = res.data.milestoneBanner;
      if (milestone?.message && !firedMilestones.current.has(milestone.checkpoint)) {
        firedMilestones.current.add(milestone.checkpoint);
        setMilestoneBanner(milestone.message);
        setTimeout(() => setMilestoneBanner(null), 6000);
      }
    } catch { /* silently retry */ }
  }

  async function fetchCheckpointBoards() {
    try {
      const res = await api.get(`/rooms/${roomId}/checkpoint-leaderboards`);
      const data = (res.data ?? {}) as Record<string, CheckpointBoard>;
      const boards: Record<number, CheckpointBoard | undefined> = {};
      for (const [key, value] of Object.entries(data)) boards[Number(key)] = value;
      setCheckpointBoards(boards);
    } catch {
      // provisional standings are best-effort
    }
  }

  async function fetchPredictions() {
    try {
      const res = await api.get(`/rooms/${roomId}/predictions`);
      setPredictions((res.data ?? []) as RoomPredictionEntry[]);
      const visible = (res.data ?? []).filter((entry: any) => entry.predictedReachedTime);
      if (!visible.length) return;
      const times = visible.map((entry: any) => new Date(entry.predictedReachedTime).getTime()).sort((a: number, b: number) => a - b);
      const mine = visible.find((entry: any) => entry.isCurrentUser);
      setMyPredictionDate(mine ? new Date(mine.predictedReachedTime) : null);
      const format = (value: number) =>
        new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      setGuessSummary(
        `Guesses so far: ${format(times[0])} to ${format(times[times.length - 1])}${mine ? ` · your guess: ${format(new Date(mine.predictedReachedTime).getTime())}` : ''}`,
      );
    } catch {
      // optional UI
    }
  }

  async function handleStartRoom() {
    setStarting(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      const coords = permission.status === 'granted' ? await Location.getCurrentPositionAsync({}) : null;
      await api.post(`/rooms/${roomId}/journey/start`, {
        startDelayMinutes,
        location: coords
          ? { lat: coords.coords.latitude, lng: coords.coords.longitude }
          : undefined,
      });
      fetchLiveState();
    } catch (err: unknown) {
      Alert.alert('Start failed', getApiErrorMessage(err, 'Could not start this room.'));
    } finally {
      setStarting(false);
    }
  }

  async function handleConfirmArrival() {
    setConfirmingArrival(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      const coords = permission.status === 'granted' ? await Location.getCurrentPositionAsync({}) : null;
      const res = await api.post(`/rooms/${roomId}/journey/confirm-arrival`, {
        location: coords
          ? { lat: coords.coords.latitude, lng: coords.coords.longitude }
          : undefined,
      });
      if (res.data?.requiresConfirmation) {
        setConfirmingArrival(false);
        return appAlert(
          'Almost there?',
          res.data.prompt,
          [
            { text: 'Not yet', style: 'cancel' },
            {
              text: "Yes, I've arrived",
              onPress: async () => {
                setConfirmingArrival(true);
                const finalRes = await api.post(`/rooms/${roomId}/journey/confirm-arrival`, {
                  location: coords
                    ? { lat: coords.coords.latitude, lng: coords.coords.longitude }
                    : undefined,
                  confirmAnyway: true,
                });
                navigation.navigate('Result', { roomId, result: finalRes.data });
                setConfirmingArrival(false);
              },
            },
          ],
        );
      }
      navigation.navigate('Result', { roomId, result: res.data });
    } catch (err: unknown) {
      appAlert('Arrival not confirmed', getApiErrorMessage(err, 'Could not confirm arrival.'));
    } finally {
      setConfirmingArrival(false);
    }
  }

  async function handleCancelJourney() {
    setCancelling(true);
    try {
      const res = await api.post(`/rooms/${roomId}/journey/cancel`, { reasonCode: 'plan_changed' });
      navigation.navigate('Result', { roomId, result: res.data });
    } catch (err: unknown) {
      appAlert('Cancel failed', getApiErrorMessage(err, 'Could not close this journey fairly.'));
    } finally {
      setCancelling(false);
    }
  }

  function handleInviteFriends() {
    if (!room) return;
    // Route to the full share screen (code, invite link, WhatsApp, native share, …)
    // rather than firing a single bare share sheet.
    navigation.navigate('RoomCreated', { room });
  }

  async function handleEndRoom() {
    if (room?.answerType === 'multiple_choice') {
      if (!actualOptionKey) {
        return appAlert('Choose outcome', 'Select the actual outcome before declaring results.');
      }
      setEnding(true);
      try {
        const res = await api.post(`/rooms/${roomId}/end`, {
          actualOptionKey,
          outcomeSource: 'host_declared',
          confidenceLevel: 'medium',
        });
        navigation.navigate('Result', { roomId, result: res.data });
      } catch (err: unknown) {
        appAlert('Failed', getApiErrorMessage(err, 'Could not declare this result.'));
      } finally {
        setEnding(false);
      }
      return;
    }

    appAlert('End Room?', category === 'open_prediction' ? 'This will submit the result for this room. Predictors can challenge it later.' : 'This will calculate the winner and award Aura.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Room',
        style: 'destructive',
        onPress: async () => {
          setEnding(true);
          try {
            const res = await api.post(`/rooms/${roomId}/end`, {});
            navigation.navigate('Result', { roomId, result: res.data });
          } catch (err: unknown) {
            appAlert('Failed', getApiErrorMessage(err, 'Could not end this room.'));
          } finally {
            setEnding(false);
          }
        },
      },
    ]);
  }

  const pct = liveState?.progressPercentage ?? 0;
  const secondsUntilStart = !isCreator && viewerCountdownSeconds != null
    ? viewerCountdownSeconds
    : isCreator && liveState?.startTime
    ? Math.max(0, Math.ceil((new Date(liveState.startTime).getTime() - Date.now()) / 1000))
    : liveState?.secondsUntilStart ?? 0;
  const minutesUntilStart = Math.ceil(secondsUntilStart / 60);
  const trackingCountdownLabel = secondsUntilStart > 0
    ? `⏱ Tracking starts in ${Math.floor(secondsUntilStart / 60)}:${String(secondsUntilStart % 60).padStart(2, '0')}.`
    : null;
  // Friendly, in-voice reassurance for the host near the confirm actions — replaces
  // the raw "Auto-close" timestamp. Uses the viewer's local time.
  const staysOpenUntilLabel = liveState?.autoCloseAt
    ? `Room stays open until ~${new Date(liveState.autoCloseAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} — no rush.`
    : null;
  const creationMeta = room?.scoringRule?.creationMeta ?? room?.creationMeta ?? {};
  const category = room?.category ?? creationMeta.category ?? room?.templateKey;
  const multipleChoiceOptions =
    Array.isArray(room?.scoringRule?.weatherOptions)
      ? room.scoringRule.weatherOptions
      : Array.isArray(creationMeta.options)
        ? creationMeta.options.map((key: string) => ({ key, label: key.replace(/_/g, ' ') }))
        : [
            { key: 'no_rain', label: 'No Rain' },
            { key: 'rain_before_6', label: 'Yes, before 6 PM' },
            { key: 'rain_after_6', label: 'Yes, after 6 PM' },
          ];

  const isGenericRoom = category === 'open_prediction';
  const categoryTheme = getRoomTheme(room ?? { category });
  const openPredictionSubtype = isGenericRoom
    ? resolveRoomSubtype({ category, subtype: room?.subtype, scoringRule: room?.scoringRule })
    : null;
  const openPredictionConfig = openPredictionSubtype
    ? getOpenPredictionSubtypeConfig(openPredictionSubtype)
    : null;

  const visibleOptionPredictions = predictions.filter(
    (entry) => entry.status === 'visible' && !!entry.selectedOptionKey,
  );
  const genericVoteSummary = visibleOptionPredictions.reduce<Record<string, number>>((acc, entry) => {
    const key = String(entry.selectedOptionKey);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const genericSummaryRows = Object.entries(genericVoteSummary).sort((a, b) => b[1] - a[1]);
  const myVisiblePrediction = predictions.find(
    (entry) => entry.isCurrentUser && entry.status !== 'revoked',
  );
  const latestCheckpointBoard = latestAvailableCheckpointBoard(checkpointBoards);
  const checkpointStandingByUserId = new Map(
    latestCheckpointBoard?.available
      ? latestCheckpointBoard.standings.map((standing) => [standing.userId, standing] as const)
      : [],
  );
  const rankedPredictions = [...predictions]
    .map((entry) => {
      const standing = entry.user?.userId ? checkpointStandingByUserId.get(entry.user.userId) : undefined;
      return {
        ...entry,
        checkpointRank: standing?.rank,
        checkpointDiffSeconds: standing?.diffSeconds,
      };
    })
    .sort((a, b) => {
      const aRank = a.checkpointRank ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.checkpointRank ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      if (!!a.isCurrentUser !== !!b.isCurrentUser) return a.isCurrentUser ? -1 : 1;
      return 0;
    });

  const checkpointList = featureFlags.checkpointLeaderboardV2 ? V2_CHECKPOINTS : V1_CHECKPOINTS;
  const anyCheckpointAvailable = checkpointList.some((cp) => checkpointBoards[cp]?.available);

  // ---- The three unmistakable phases: predictions OPEN → LOCKED → journey STARTED ----
  const rawStatus = liveState?.status ?? room?.status ?? 'live';
  const normStatus = rawStatus === 'prediction_open' ? 'predictions_open' : rawStatus;
  const isTerminal = ['completed', 'cancelled'].includes(normStatus);
  const journeyStarted =
    normStatus === 'live' ||
    ['started', 'live', 'inactive', 'overdue', 'arrived_verified', 'completed'].includes(
      liveState?.journeyStatus ?? '',
    );
  const phase: 'open' | 'locked' | 'started' | 'ended' = isTerminal
    ? 'ended'
    : journeyStarted
      ? 'started'
      : normStatus === 'predictions_locked'
        ? 'locked'
        : 'open';
  const isDraw = ['cancelled', 'auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host'].includes(
    liveState?.journeyStatus ?? normStatus,
  );
  const lockCountdownLabel =
    lockCountdownSeconds != null && lockCountdownSeconds > 0
      ? `Locks in ${Math.floor(lockCountdownSeconds / 60)}:${String(lockCountdownSeconds % 60).padStart(2, '0')}`
      : lockCountdownSeconds === 0
        ? 'Locking now…'
        : null;

  // v2 re-predict: a viewer may replace their guess through the 80% checkpoint.
  const myPrediction = predictions.find((p) => p.isCurrentUser && p.status !== 'revoked');
  const reached80 = [80, 90, 100].some((cp) => checkpointBoards[cp]?.available);
  const canRePredict =
    featureFlags.checkpointLeaderboardV2 &&
    !isCreator &&
    !!myPrediction &&
    !reached80 &&
    phase !== 'ended';
  const reviewWindowActive =
    featureFlags.checkpointLeaderboardV2 &&
    !!myPrediction &&
    reviewCountdownSeconds != null &&
    reviewCountdownSeconds > 0;
  const reviewCountdownLabel = reviewWindowActive
    ? `Review & change your prediction for ${Math.floor(reviewCountdownSeconds / 60)}:${String(
        reviewCountdownSeconds % 60,
      ).padStart(2, '0')}`
    : null;

  // During the visibility-delay window (or any moment progress hasn't landed yet), the
  // raw 0% reads as broken. Show plain "it has begun" copy instead. This changes only
  // the presentation of the waiting state — never the delay logic itself.
  const liveProgressPending =
    phase === 'started' &&
    category !== 'weather_rain' &&
    (liveState?.progressPercentage == null || pct <= 0) &&
    liveState?.etaMinutes == null;

  // Live bot voice teaser (a line, not just a number) — existing benchmark/ETA data only.
  const liveOracle = deriveArrivalBenchmarks(room)?.oracle;
  const liveBotTeaser =
    category === 'weather_rain'
      ? null
      : liveState?.etaMinutes != null
        ? botEtaTeaser(`${liveState.etaMinutes} min`)
        : liveOracle
          ? botGuessTeaser(formatClock(liveOracle.date, false))
          : room?.oracleBotPrediction?.label
            ? botEtaTeaser(room.oracleBotPrediction.label)
            : null;

  // ---- Pre-tracking "you're all set" waiting room (arrival only) ----
  const isArrivalCategory = category !== 'weather_rain' && category !== 'food_eta' && !isGenericRoom;
  const trackingCountdownActive =
    secondsUntilStart > 0 && (liveState?.status === 'live' || !!liveState?.waitingForDelayedStart);
  const showArrivalWaitingRoom =
    isArrivalCategory &&
    !!liveState &&
    trackingCountdownActive &&
    !['completed', 'cancelled'].includes(liveState.status);

  const waitingBenchmarks = showArrivalWaitingRoom ? deriveArrivalBenchmarks(room) : null;
  const waitingTargetTime = showArrivalWaitingRoom
    ? !isCreator && liveState?.visibleMovementStartTime
      ? new Date(liveState.visibleMovementStartTime)
      : liveState?.startTime
      ? new Date(liveState.startTime)
      : new Date(Date.now() + secondsUntilStart * 1000)
    : null;
  const waitingCards = showArrivalWaitingRoom
    ? [
        // "You" leads — it's the guess that matters. Maps is the neutral baseline and
        // the bot is flavor, so both sit after it.
        myPredictionDate && {
          key: 'you',
          icon: '',
          name: 'Your guess',
          nameColor: palette.green,
          date: myPredictionDate,
          chipLabel: 'Locked in',
          chipColor: palette.green,
          highlight: true,
        },
        waitingBenchmarks?.maps && {
          key: 'maps',
          icon: '🌍',
          name: 'Google Maps',
          nameColor: palette.cyan,
          date: waitingBenchmarks.maps.date,
          chipLabel: waitingBenchmarks.maps.verified ? 'Neutral baseline' : 'Baseline estimate',
          chipColor: palette.cyan,
        },
        waitingBenchmarks?.oracle && {
          key: 'oracle',
          icon: '🤖',
          name: 'The bot',
          nameColor: palette.violetLight,
          date: waitingBenchmarks.oracle.date,
          chipLabel: 'Just for fun',
          chipColor: palette.violetLight,
        },
        waitingBenchmarks?.host && {
          key: 'host',
          icon: '👑',
          name: 'Host guess',
          nameColor: palette.amber,
          date: waitingBenchmarks.host.date,
          chipLabel: 'Host call',
          chipColor: palette.amber,
        },
      ].filter(Boolean)
    : [];
  const shouldPromptCreatorPredictionInWaitingRoom =
    showArrivalWaitingRoom &&
    phase === 'open' &&
    isCreator &&
    !myPrediction;

  if (showArrivalWaitingRoom) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
        <ArrivalWaitingRoom
          title={room?.roomTitle ?? 'Arrival Prediktion'}
          statusLabel="Started"
          targetTime={waitingTargetTime}
          startLabel={room?.startingPointLabel ?? room?.routeSummary?.startLabel ?? 'Start'}
          destinationLabel={room?.destinationLabel ?? room?.routeSummary?.destinationLabel ?? 'Destination'}
          expectedDurationMinutes={Math.round(
            (liveState?.expectedDurationSeconds ??
              room?.route?.estimatedDurationSeconds ??
              room?.routeSummary?.estimatedDurationSeconds ??
              3600) / 60,
          )}
          modeLabel="Car"
          modeIcon="🚗"
          safetyMessage={liveState?.safetyMessage ?? 'Movement is delayed for safety.'}
          cards={waitingCards as any}
          onHowItWorks={() => navigation.navigate('Help')}
          onGhostModeDetails={() => navigation.navigate('Help')}
          predictionPromptTitle={
            shouldPromptCreatorPredictionInWaitingRoom
              ? 'Make your prediction before tracking begins'
              : null
          }
          predictionPromptCopy={
            shouldPromptCreatorPredictionInWaitingRoom
              ? 'The countdown has already started for everyone. Add your prediction now and it will use the same timer.'
              : null
          }
          predictionCtaLabel={shouldPromptCreatorPredictionInWaitingRoom ? 'Make my prediction' : null}
          onPredictionCta={
            shouldPromptCreatorPredictionInWaitingRoom
              ? () => navigation.navigate('Prediction', { roomId, room })
              : undefined
          }
          onEnableNotifications={() =>
            Alert.alert(
              'Notifications',
              "You're all set — we'll surface the reveal here the moment tracking begins.",
            )
          }
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}>

      {phase === 'ended' ? (
        <View style={styles.terminalBanner}>
          <Text style={styles.terminalTitle}>{isDraw ? '🏁 Called a draw' : "🏁 It's a wrap!"}</Text>
          <Text style={styles.terminalCopy}>
            {isDraw
              ? 'This Prediktion closed neutrally — nobody counted as a loss. Here’s the recap.'
              : 'Predictions are in and the result is ready. See who made the closest guess.'}
          </Text>
          <PrimaryButton
            label={isDraw ? 'See the recap' : 'See who won'}
            onPress={() => navigation.navigate('Result', { roomId })}
            icon="🏆"
          />
        </View>
      ) : (
        <View
          style={[
            styles.phaseBanner,
            phase === 'open' ? styles.phaseOpen : phase === 'locked' ? styles.phaseLocked : styles.phaseStarted,
          ]}
        >
          <Text style={styles.phaseTitle}>
            {phase === 'open'
              ? '⏳ Predictions open'
              : phase === 'locked'
                ? '🔒 Predictions closed'
                : isGenericRoom
                  ? '🎯 Predictions live'
                  : '🚦 Journey started'}
          </Text>
          <Text style={styles.phaseCopy}>
            {phase === 'open'
              ? lockCountdownLabel
                ? `${lockCountdownLabel} — get your guess in before it closes.`
                : 'Lock in your guess before predictions close.'
              : phase === 'locked'
                ? isGenericRoom && openPredictionConfig
                  ? openPredictionConfig.liveCopy
                  : 'Guesses are locked in — no more changes. Now we watch.'
                : isGenericRoom
                  ? 'Voting is live. Make your call before the timer ends.'
                  : 'Guesses are locked. Live progress is rolling in below.'}
          </Text>
        </View>
      )}

      {room && phase !== 'ended' && (isCreator || isGenericRoom) ? (
        <View style={styles.inviteRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inviteTitle}>
              {isCreator || !isGenericRoom ? 'Invite more friends' : 'Pass it on'}
            </Text>
            <Text style={styles.inviteCopy}>
              {phase === 'started'
                ? isGenericRoom
                  ? 'Predictions are live — friends can still join and vote before lock.'
                  : 'The journey is live — friends can still watch it unfold in real time.'
                : isGenericRoom
                  ? isCreator
                    ? 'Send the room around — invitees can forward it too, and the same countdown still applies to everyone.'
                    : 'Forward this room to anyone you want — they can still join and predict before the same timer runs out.'
                  : 'Send the room around — the more guesses, the better the reveal.'}
            </Text>
          </View>
          <View style={styles.inviteActions}>
            {isGenericRoom && phase === 'open' && !myVisiblePrediction ? (
              <PrimaryButton
                label="Make my prediction"
                onPress={() => navigation.navigate('Prediction', { roomId, room })}
                icon="🎯"
                fullWidth={false}
              />
            ) : null}
            {!isGenericRoom && phase === 'open' && !myPrediction ? (
              <PrimaryButton
                label={isCreator ? 'Make my prediction' : 'Predict now'}
                onPress={() => navigation.navigate('Prediction', { roomId, room })}
                icon="🎯"
                fullWidth={false}
              />
            ) : null}
            <PrimaryButton
              label={isCreator || !isGenericRoom ? 'Invite' : 'Forward'}
              onPress={handleInviteFriends}
              icon="📨"
              variant="secondary"
              fullWidth={false}
            />
          </View>
        </View>
      ) : null}

      {showLockedReassurance ? (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedBannerIcon}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.lockedBannerTitle}>Nice — you're in.</Text>
            <Text style={styles.lockedBannerCopy}>
              {user?.isGuest
                ? "Now let's see who's closest. We'll show you the Tea the moment the result lands — no account needed, and you can claim your Aura anytime."
                : "Now let's see who's closest. We'll show you the Tea the moment the result lands."}
            </Text>
          </View>
          <Text onPress={() => setShowLockedReassurance(false)} style={styles.lockedBannerDismiss}>
            ✕
          </Text>
        </View>
      ) : null}

      {reviewCountdownLabel ? (
        <View style={styles.reviewBanner}>
          <Text style={styles.reviewBannerTitle}>✏️ Two-minute review window</Text>
          <Text style={styles.reviewBannerCopy}>
            {reviewCountdownLabel}. Human times stay blurred until your own prediction locks.
          </Text>
        </View>
      ) : null}

      {isGenericRoom ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {openPredictionConfig ? (
            <View
              style={[
                styles.subtypeChip,
                {
                  backgroundColor: openPredictionConfig.theme.badgeStyle.bg,
                  borderColor: openPredictionConfig.theme.badgeStyle.border,
                },
              ]}
            >
              <Text style={[styles.subtypeChipText, { color: openPredictionConfig.theme.badgeStyle.text }]}>
                {openPredictionConfig.theme.icon} {openPredictionConfig.theme.label}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>{room?.roomTitle ?? categoryTheme.label}</Text>
          {room?.question ? (
            <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
              {room.question}
            </Text>
          ) : null}
          <Text style={[styles.statusLine, { color: colors.purpleLight }]}>
            {(room?.status ?? 'predictions_open').replace(/_/g, ' ')}
          </Text>
          <Text style={[styles.statusMeta, { color: colors.textSecondary }]}>
            {lockCountdownLabel
              ? `${lockCountdownLabel} until votes lock.`
              : room?.predictionCloseTime
                ? `Voting closes ${new Date(room.predictionCloseTime).toLocaleString()}.`
                : 'Voting is open.'}
          </Text>
        </View>
      ) : (
        <LiveStatusCard
          theme={categoryTheme}
          title={room?.roomTitle ?? (category === 'weather_rain' ? 'Weather Room' : 'Live Prediktion')}
          statusLabel={(liveState?.journeyStatus ?? liveState?.status ?? 'live').replace(/_/g, ' ')}
          statusTone="live"
          progress={category !== 'weather_rain' ? pct : undefined}
          etaLabel={liveState?.etaMinutes != null ? `${liveState.etaMinutes} min` : trackingCountdownLabel ?? (minutesUntilStart > 0 ? `Starts in ${minutesUntilStart} min` : undefined)}
          oracleLabel={room?.baselineLabel ?? room?.oracleBotPrediction?.label}
          lifecycleNote={liveState?.waitingForDelayedStart && !isCreator ? (trackingCountdownLabel ?? 'Waiting to start.') : (liveState?.lifecycleMessage ?? liveState?.safetyMessage)}
        />
      )}

      {milestoneBanner ? (
        <View style={[styles.milestoneBanner, { borderColor: colors.amber, backgroundColor: colors.surfaceHigh }]}>
          <Text style={[styles.milestoneBannerText, { color: colors.textPrimary }]}>{milestoneBanner}</Text>
        </View>
      ) : null}

      {etaMovedBanner ? (
        <View style={[styles.milestoneBanner, { borderColor: colors.amber, backgroundColor: colors.surfaceHigh }]}>
          <Text style={[styles.milestoneBannerText, { color: colors.textPrimary }]}>⏱ {etaMovedBanner}</Text>
        </View>
      ) : null}

      {!isGenericRoom ? (
        <View style={[styles.privacyPill, { backgroundColor: colors.purpleDim }]}>
          <Text style={[styles.privacyText, { color: colors.purpleLight }]}>
            🔒 Ghost Mode on · exact GPS and raw movement are hidden · {liveState?.safetyMessage ?? 'Only approximate progress is shown.'}
          </Text>
        </View>
      ) : null}

      {liveState && !isGenericRoom ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <CoachMark
            storageKey="coachmark:live:route_oracle"
            title="Route Oracle"
            body="A neutral estimate to guess against. Not the winner — that's whoever's closest."
          />
          <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>
            {category === 'weather_rain' ? 'Weather Room Status' : 'Journey Status'}
          </Text>
          <Text style={[styles.statusLine, { color: colors.purpleLight }]}>{(liveState.journeyStatus ?? liveState.status).replace(/_/g, ' ')}</Text>
          <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
            {category === 'weather_rain'
              ? 'Declare the actual rain outcome when the time window ends. Oracle Bot is a benchmark, not a guarantee.'
              : (!isCreator && liveState.waitingForDelayedStart && trackingCountdownLabel)
                ? trackingCountdownLabel
                : liveState.lifecycleMessage ?? 'Approx. journey progress is shown with privacy-safe timing.'}
          </Text>
          {category !== 'weather_rain' ? (
            <>
              {guessSummary ? <Text style={[styles.statusMeta, { color: colors.textPrimary }]}>{guessSummary}</Text> : null}
              {liveBotTeaser ? <Text style={styles.botTeaser}>🤖 {liveBotTeaser}</Text> : null}
              <Text style={[styles.statusMeta, { color: colors.textSecondary }]}>
                Expected duration: {Math.round((liveState.expectedDurationSeconds ?? 3600) / 60)} min
              </Text>
              {/* Auto-close time and grace buffer are internal lifecycle accounting —
                  not user-facing. The host sees a friendly "stays open until" line near
                  the confirm actions instead. */}
            </>
          ) : null}
        </View>
      ) : null}

      {(isGenericRoom ? predictions.length > 0 : !!liveState && (predictions.length || anyCheckpointAvailable)) ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {isGenericRoom && genericSummaryRows.length > 0 ? (
            <View style={styles.genericSummaryWrap}>
              <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>The Tea</Text>
              {genericSummaryRows.map(([key, count]) => (
                <View key={key} style={styles.genericSummaryRow}>
                  <Text style={[styles.genericSummaryLabel, { color: colors.textPrimary }]}>
                    {key.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.genericSummaryCount, { color: colors.purpleLight }]}>
                    {count} vote{count === 1 ? '' : 's'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <RoomPredictionList
            data={rankedPredictions}
            title={isGenericRoom ? 'Prediction board' : undefined}
            checkpointLabel={latestCheckpointBoard ? `${latestCheckpointBoard.checkpoint}%` : null}
          />
          {!isGenericRoom
            ? checkpointList.map((cp) => (
                <CheckpointLeaderboard key={cp} board={checkpointBoards[cp]} />
              ))
            : null}
          {canRePredict ? (
            <PrimaryButton
              label="Change my guess"
              onPress={() => navigation.navigate('Prediction', { roomId, room, editPredictionId: myPrediction!.predictionId })}
              variant="secondary"
              icon="✏️"
            />
          ) : null}
        </View>
      ) : null}

      {isCreator && liveState && !isGenericRoom && category !== 'weather_rain' && (secondsUntilStart > 0 || liveState.status !== 'live') ? (
        <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={[colors.purple + '30', 'transparent']} style={styles.creatorHeader}>
            <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>Start Journey</Text>
          </LinearGradient>
          <View style={styles.creatorBody}>
            {liveState.status === 'live' && secondsUntilStart > 0 ? (
              <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
                {isCreator ? `Journey timer starts in ${minutesUntilStart} min.` : `Friends will see this flip live in about ${minutesUntilStart} min.`}
              </Text>
            ) : (
              <>
                <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
                  For safety, the visible journey starts after a delay. Friends see progress, never exact live GPS.
                </Text>
                <View style={styles.delayRow}>
                  {startDelayOptions.map((minutes) => (
                    <Text
                      key={minutes}
                      onPress={() => setStartDelayMinutes(minutes)}
                      style={[
                        styles.delayChip,
                        {
                          color: colors.textPrimary,
                          borderColor: startDelayMinutes === minutes ? colors.purple : colors.border,
                          backgroundColor: startDelayMinutes === minutes ? colors.purpleDim : colors.surfaceHigh,
                        },
                      ]}
                    >
                      {minutes} min
                    </Text>
                  ))}
                </View>
                <PrimaryButton label="Start Journey" onPress={handleStartRoom} loading={starting} icon="▶️" />
              </>
            )}
          </View>
        </View>
      ) : null}

      {!isCreator && liveState?.waitingForDelayedStart && trackingCountdownLabel && !isGenericRoom && category !== 'weather_rain' ? (
        <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={[colors.purple + '30', 'transparent']} style={styles.creatorHeader}>
            <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>Start Journey</Text>
          </LinearGradient>
          <View style={styles.creatorBody}>
            <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
              {trackingCountdownLabel}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Live visualization — SVG only, never a map */}
      {!isGenericRoom && liveProgressPending ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>🚦 The journey has begun</Text>
          <Text style={[styles.startDelayCopy, { color: colors.textSecondary, marginBottom: 0 }]}>
            Live progress will appear here shortly — hang tight. Guesses are already locked, so
            there's nothing to do but watch.
          </Text>
        </View>
      ) : !isGenericRoom && liveState && category === 'food_eta' ? (
        <FoodEtaViz
          progressPercentage={pct}
          etaMinutes={liveState.etaMinutes}
          status={liveState.journeyStatus ?? liveState.status}
        />
      ) : !isGenericRoom && liveState && category !== 'weather_rain' ? (
        <ArrivalJourneyViz
          progressPercentage={pct}
          etaMinutes={liveState.etaMinutes}
          status={liveState.journeyStatus ?? liveState.status}
          startLabel={room?.startingPointLabel ?? room?.routeSummary?.startLabel ?? 'Start'}
          destinationLabel={room?.destinationLabel ?? room?.routeSummary?.destinationLabel ?? 'Destination'}
          safetyMessage={liveState.safetyMessage}
          primaryColor={categoryTheme.primaryColor}
          secondaryColor={categoryTheme.secondaryColor}
        />
      ) : !isGenericRoom ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.waiting, { color: colors.textMuted }]}>Waiting for live updates…</Text>
        </View>
      ) : null}

      {/* Creator controls */}
      {isCreator && room?.answerType === 'multiple_choice' ? (
        <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={[colors.purple + '30', 'transparent']} style={styles.creatorHeader}>
            <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>{category === 'open_prediction' ? 'Creator Attest Result' : 'Declare Result'}</Text>
          </LinearGradient>
          <View style={styles.creatorBody}>
            <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
              {category === 'open_prediction'
                ? 'Choose the actual outcome from the original options. MVP rule: creator-attest only, no screenshot upload. Predictors can challenge afterward.'
                : 'Choose the actual outcome from the original options. Predictions stay hidden until lock.'}
            </Text>
            <View style={styles.resultOptionStack}>
              {multipleChoiceOptions.map((option: any) => (
                <PrimaryButton
                  key={option.key}
                  label={option.label}
                  onPress={() => setActualOptionKey(option.key)}
                  variant={actualOptionKey === option.key ? 'primary' : 'secondary'}
                />
              ))}
            </View>
            <PrimaryButton label={category === 'open_prediction' ? 'Submit' : 'Declare Result & See Winners'} onPress={handleEndRoom} loading={ending} icon="🏁" />
          </View>
        </View>
      ) : null}

      {isCreator && room?.answerType !== 'multiple_choice' ? (
        <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={[colors.purple + '30', 'transparent']} style={styles.creatorHeader}>
            <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>⚙️  Creator Controls</Text>
          </LinearGradient>
          <View style={styles.creatorBody}>
            <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
              {featureFlags.checkpointLeaderboardV2
                ? 'Progress runs on the route timer with private checkpoints at 20/40/60/80/90% and arrival, each doing one GPS + ETA read.'
                : 'Progress now runs on the route timer with private checkpoints at 0%, 50%, 80%, and arrival.'}
            </Text>
            {staysOpenUntilLabel ? (
              <Text style={[styles.startDelayCopy, { color: colors.purpleLight }]}>{staysOpenUntilLabel}</Text>
            ) : null}
            <PrimaryButton label="Confirm Arrival" onPress={handleConfirmArrival} loading={confirmingArrival} icon="✅" />
            <PrimaryButton label="Cancel / Plan Changed" onPress={handleCancelJourney} loading={cancelling} variant="secondary" icon="🛑" />
            <PrimaryButton label="End Room & See Results" onPress={handleEndRoom} loading={ending} variant="danger" icon="🏁" />
          </View>
        </View>
      ) : null}

      {['completed', 'cancelled'].includes(liveState?.status ?? room?.status ?? 'live') ? (
        <PrimaryButton
          label="View Results"
          onPress={() => navigation.navigate('Result', { roomId })}
          variant="secondary"
          icon="🏆"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 880, alignSelf: 'center', padding: 20, paddingTop: 28 },
  liveHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  subtypeChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  subtypeChipText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  liveText: { fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  heading: { fontWeight: '700', fontSize: 18 },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
    backgroundColor: 'rgba(34,197,94,0.12)',
    padding: 14,
    marginBottom: 16,
  },
  lockedBannerIcon: { fontSize: 20, marginTop: 1 },
  lockedBannerTitle: { color: '#86efac', fontSize: 15, fontWeight: '900', marginBottom: 3 },
  lockedBannerCopy: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 19 },
  lockedBannerDismiss: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '800', paddingHorizontal: 4 },
  reviewBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
    backgroundColor: 'rgba(34,211,238,0.10)',
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  reviewBannerTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
  reviewBannerCopy: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  privacyPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16, alignSelf: 'flex-start' },
  privacyText: { fontSize: 12, fontWeight: '600' },
  phaseBanner: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16, gap: 4 },
  phaseOpen: { borderColor: 'rgba(34,211,238,0.45)', backgroundColor: 'rgba(34,211,238,0.10)' },
  phaseLocked: { borderColor: 'rgba(251,191,36,0.45)', backgroundColor: 'rgba(251,191,36,0.10)' },
  phaseStarted: { borderColor: 'rgba(34,211,238,0.5)', backgroundColor: 'rgba(34,211,238,0.12)' },
  phaseTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  phaseCopy: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  terminalBanner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.45)',
    backgroundColor: 'rgba(34,197,94,0.12)',
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  terminalTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  terminalCopy: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 19 },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    backgroundColor: 'rgba(34,211,238,0.08)',
    padding: 14,
    marginBottom: 16,
  },
  inviteActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteTitle: { color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 2 },
  inviteCopy: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 17 },
  botTeaser: { color: palette.violetLight, fontSize: 13, fontWeight: '800', fontStyle: 'italic', lineHeight: 18 },
  milestoneBanner: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  milestoneBannerText: { fontSize: 14, fontWeight: '800', lineHeight: 20 },
  genericSummaryWrap: { gap: 8, marginBottom: 14 },
  genericSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.16)',
  },
  genericSummaryLabel: { fontSize: 14, fontWeight: '800', textTransform: 'capitalize' },
  genericSummaryCount: { fontSize: 13, fontWeight: '900' },
  card: { borderRadius: 18, padding: 20, borderWidth: 1, marginBottom: 16 },
  etaBlock: { alignItems: 'center', marginBottom: 16 },
  etaNum: { fontSize: 68, fontWeight: '900', lineHeight: 72 },
  etaUnit: { fontSize: 14, marginTop: -4 },
  track: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 },
  trackLabel: { fontSize: 12, width: 48, textAlign: 'center' },
  trackLine: { flex: 1, height: 8, borderRadius: 4, overflow: 'visible', position: 'relative' },
  trackFill: { height: '100%', borderRadius: 4 },
  trackDot: { position: 'absolute', top: -10, fontSize: 20 },
  waiting: { textAlign: 'center', padding: 20, fontSize: 15 },
  creatorCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  creatorHeader: { padding: 16, paddingBottom: 12 },
  creatorTitle: { fontWeight: '800', fontSize: 17 },
  creatorBody: { padding: 16, paddingTop: 8 },
  startDelayCopy: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  statusLine: { fontSize: 16, fontWeight: '900', marginTop: 6, marginBottom: 8, textTransform: 'capitalize' },
  statusMeta: { fontSize: 12, lineHeight: 18 },
  delayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  resultOptionStack: { gap: 10, marginBottom: 12 },
  delayChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '800',
  },
});
