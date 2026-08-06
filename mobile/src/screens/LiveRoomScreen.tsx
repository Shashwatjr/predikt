import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, Alert, Linking, Platform, Share, useWindowDimensions } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { RootStackParamList } from '../navigation/types';
import PrimaryButton from '../components/PrimaryButton';
import ArrivalJourneyViz from '../components/ArrivalJourneyViz';
import BrandLogo from '../components/BrandLogo';
import FoodEtaViz from '../components/FoodEtaViz';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import appAlert from '../utils/appAlert';
import { getCategoryTheme } from '../config/categoryTheme';
import LiveStatusCard from '../components/LiveStatusCard';
import CoachMark from '../components/CoachMark';
import ArrivalWaitingRoom from '../components/ArrivalWaitingRoom';
import RoomPredictionList, { RoomPredictionEntry } from '../components/RoomPredictionList';
import CheckpointLeaderboard, { CheckpointBoard } from '../components/CheckpointLeaderboard';
import LiveLeaderboard, { LiveLeaderboardData } from '../components/LiveLeaderboard';
import { deriveArrivalBenchmarks, formatClock } from '../utils/benchmarks';
import { botGuessTeaser, botEtaTeaser, botEtaRead } from '../utils/botVoice';
import { layout, palette } from '../theme/designSystem';
import { featureFlags } from '../config/featureFlags';
import { formatTravelStatusWithPercent, getTravelStageFromProgress } from '../utils/travelProgress';
import { buildSharePayload, shareViaWebShareApi } from '../utils/shareRoom';
import { copyToClipboard } from '../utils/shareLine';

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

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const startDelayOptions = [3, 5, 10, 15] as const;

function shortenPlaceLabel(label: string | null | undefined): string {
  if (!label) return 'Unknown';
  const firstChunk = label.split(',')[0]?.trim() || label.trim();
  return firstChunk.length > 26 ? `${firstChunk.slice(0, 23).trimEnd()}…` : firstChunk;
}

function normalizeRoomStatus(status?: string | null) {
  if (!status) return '';
  return status === 'prediction_open' ? 'predictions_open' : status;
}

function isTerminalJourneyState(status?: string | null, journeyStatus?: string | null) {
  const normalizedStatus = normalizeRoomStatus(status);
  return (
    ['completed', 'cancelled', 'result_ready'].includes(normalizedStatus) ||
    ['completed', 'arrived_verified', 'auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host'].includes(
      String(journeyStatus ?? ''),
    )
  );
}

export default function LiveRoomScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { roomId, isCreator, justPredicted } = route.params;
  const isDesktop = width >= layout.breakpoints.desktop;
  const [showLockedReassurance, setShowLockedReassurance] = useState(!!justPredicted);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
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
  const [liveLeaderboard, setLiveLeaderboard] = useState<LiveLeaderboardData | null>(null);
  const [locking, setLocking] = useState(false);
  const [unlockInSeconds, setUnlockInSeconds] = useState<number | null>(null);
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
  const safePredictions = toArray<RoomPredictionEntry>(predictions);

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
    fetchLiveLeaderboard();
    const interval = setInterval(() => {
      fetchLiveState();
      fetchPredictions();
      fetchCheckpointBoards();
      fetchLiveLeaderboard();
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
    const available = Object.values(checkpointBoards).filter(
      (b): b is Extract<CheckpointBoard, { available: true }> => !!b && b.available,
    );
    if (!available.length) return;
    const latest = available.reduce((a, b) => (b.checkpoint > a.checkpoint ? b : a));
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
    const mine = safePredictions.find((entry: any) => entry.isCurrentUser && entry.status !== 'revoked');
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
  }, [safePredictions]);

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

  async function fetchLiveLeaderboard() {
    try {
      const res = await api.get(`/rooms/${roomId}/live-leaderboard`);
      const payload = res.data as Partial<LiveLeaderboardData> | null;
      if (!payload || typeof payload !== 'object') {
        setLiveLeaderboard(null);
        return;
      }
      if (payload.revealed === true) {
        setLiveLeaderboard({
          revealed: true,
          basis:
            payload.basis === 'snapshot_eta' || payload.basis === 'checkpoint' || payload.basis === 'plan'
              ? payload.basis
              : 'plan',
          projectedArrivalAt:
            typeof payload.projectedArrivalAt === 'string'
              ? payload.projectedArrivalAt
              : new Date().toISOString(),
          capturedAt:
            typeof payload.capturedAt === 'string' ? payload.capturedAt : new Date().toISOString(),
          standings: toArray(payload.standings),
        });
        return;
      }
      const hiddenReason =
        'reason' in payload && typeof payload.reason === 'string' ? payload.reason : 'not_locked';
      setLiveLeaderboard({
        revealed: false,
        reason: hiddenReason,
        standings: [],
      });
    } catch {
      // live leaderboard is best-effort; hidden until predictions lock
    }
  }

  async function handleLockNow() {
    if (locking) return;
    setLocking(true);
    try {
      await api.post(`/rooms/${roomId}/predictions/lock-now`);
      await Promise.all([fetchLiveLeaderboard(), fetchPredictions(), fetchLiveState()]);
    } catch (error) {
      appAlert('Could not lock', getApiErrorMessage(error, 'Please try again.'));
    } finally {
      setLocking(false);
    }
  }

  async function fetchPredictions() {
    try {
      const res = await api.get(`/rooms/${roomId}/predictions`);
      const rows = (res.data ?? []) as RoomPredictionEntry[];
      setPredictions(rows);
      // Room-wide reveal window: seconds until the latest edit deadline elapses
      // (that's when blurred guesses auto-unlock unless someone locks first).
      const deadlines = rows
        .map((entry: any) => (entry.editDeadline ? new Date(entry.editDeadline).getTime() : 0))
        .filter((t: number) => t > 0);
      if (deadlines.length) {
        const maxDeadline = Math.max(...deadlines);
        setUnlockInSeconds(Math.max(0, Math.ceil((maxDeadline - Date.now()) / 1000)));
      } else {
        setUnlockInSeconds(null);
      }
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
    if (confirmingArrival || ending || cancelling) return;
    const submitFinishJourney = async (confirmAnyway = false) => {
      setConfirmingArrival(true);
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        const coords = permission.status === 'granted' ? await Location.getCurrentPositionAsync({}) : null;
        const res = await api.post(`/rooms/${roomId}/journey/confirm-arrival`, {
          location: coords
            ? { lat: coords.coords.latitude, lng: coords.coords.longitude }
            : undefined,
          confirmAnyway,
        });
        if (res.data?.requiresConfirmation && !confirmAnyway) {
          setConfirmingArrival(false);
          return appAlert(
            'Outside the finish zone',
            res.data.prompt,
            [
              { text: 'Go back', style: 'cancel' },
              {
                text: 'Finish Anyway',
                style: 'destructive',
                onPress: () => {
                  void submitFinishJourney(true);
                },
              },
            ],
          );
        }
        navigation.navigate('Result', { roomId, result: res.data });
      } catch (err: unknown) {
        appAlert('Finish failed', getApiErrorMessage(err, 'Could not finish this journey.'));
      } finally {
        setConfirmingArrival(false);
      }
    };

    appAlert(
      'Finish Journey?',
      'Confirm arrival and reveal the final result for everyone in the room.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Finish Journey',
          onPress: () => {
            void submitFinishJourney(false);
          },
        },
      ],
    );
  }

  async function handleCancelJourney() {
    if (cancelling || confirmingArrival || ending) return;
    setCancelling(true);
    try {
      const res = await api.post(`/rooms/${roomId}/journey/cancel`, { reasonCode: 'plan_changed' });
      navigation.navigate('Result', { roomId, result: res.data });
    } catch (err: unknown) {
      Alert.alert('Cancel failed', getApiErrorMessage(err, 'Could not close this journey fairly.'));
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
    if (ending || confirmingArrival || cancelling) return;
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

  const categoryTheme = getCategoryTheme(category);
  const isGenericRoom = category === 'open_prediction';

  const visibleOptionPredictions = safePredictions.filter(
    (entry) => entry.status === 'visible' && !!entry.selectedOptionKey,
  );
  const genericVoteSummary = visibleOptionPredictions.reduce<Record<string, number>>((acc, entry) => {
    const key = String(entry.selectedOptionKey);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const genericSummaryRows = Object.entries(genericVoteSummary).sort((a, b) => b[1] - a[1]);
  const myVisiblePrediction = safePredictions.find(
    (entry) => entry.isCurrentUser && entry.status !== 'revoked',
  );

  const checkpointList = featureFlags.checkpointLeaderboardV2 ? V2_CHECKPOINTS : V1_CHECKPOINTS;
  const anyCheckpointAvailable = checkpointList.some((cp) => checkpointBoards[cp]?.available);

  // ---- The three unmistakable phases: predictions OPEN → LOCKED → journey STARTED ----
  const rawStatus = liveState?.status ?? room?.status ?? 'live';
  const normStatus = normalizeRoomStatus(rawStatus);
  const isTerminal = isTerminalJourneyState(normStatus, liveState?.journeyStatus ?? room?.journeyStatus);
  const journeyStarted =
    normStatus === 'live' ||
    !!liveState?.waitingForDelayedStart ||
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
  const creatorName = room?.creatorDisplayName ?? room?.creatorHandle ?? room?.creator?.name ?? 'the host';
  // Guest-facing "what do I do now" state: they've locked in; the only remaining
  // question is whether the journey has started.
  const isGuestView = !isCreator && !isGenericRoom;
  const guestNotStarted = isGuestView && (phase === 'open' || phase === 'locked');
  const lockCountdownLabel =
    lockCountdownSeconds != null && lockCountdownSeconds > 0
      ? `Locks in ${Math.floor(lockCountdownSeconds / 60)}:${String(lockCountdownSeconds % 60).padStart(2, '0')}`
      : lockCountdownSeconds === 0
        ? 'Locking now…'
        : null;

  // v2 re-predict: a viewer may replace their guess through the 80% checkpoint.
  const myPrediction = safePredictions.find((p) => p.isCurrentUser && p.status !== 'revoked');
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
  // Challenge CTA only when the viewer has not guessed yet.
  const liveOracle = deriveArrivalBenchmarks(room)?.oracle;
  const liveBotEtaLabel =
    liveState?.etaMinutes != null
      ? `${liveState.etaMinutes} min`
      : liveOracle
        ? formatClock(liveOracle.date, false)
        : room?.oracleBotPrediction?.label ?? null;
  const liveBotTeaser =
    category === 'weather_rain' || !liveBotEtaLabel
      ? null
      : myPrediction
        ? botEtaRead(liveBotEtaLabel)
        : liveState?.etaMinutes != null || room?.oracleBotPrediction?.label
          ? botEtaTeaser(liveBotEtaLabel)
          : botGuessTeaser(liveBotEtaLabel);

  // ---- Pre-tracking "you're all set" waiting room (arrival only) ----
  const isArrivalCategory = category !== 'weather_rain' && category !== 'food_eta' && !isGenericRoom;
  const trackingCountdownActive =
    secondsUntilStart > 0 && (liveState?.status === 'live' || !!liveState?.waitingForDelayedStart);
  const suppressGuestStartCountdown =
    !isCreator &&
    isArrivalCategory &&
    trackingCountdownActive &&
    !['completed', 'cancelled'].includes(liveState?.status ?? '');
  const showArrivalWaitingRoom =
    isArrivalCategory &&
    isCreator &&
    trackingCountdownActive &&
    !isTerminal;

  const creatorDesktopJourneyBoard =
    isDesktop && isCreator && !isGenericRoom && category !== 'weather_rain' && phase !== 'ended';
  const inviteCode = room?.inviteCode ?? room?.code ?? '';
  const sharePayload = useMemo(
    () => (room && inviteCode ? buildSharePayload({ ...room, inviteCode }) : null),
    [inviteCode, room],
  );

  useEffect(() => {
    // Custom MyPrediktion chrome replaces the stack header on the desktop journey board.
    navigation.setOptions({ headerShown: !creatorDesktopJourneyBoard || showArrivalWaitingRoom });
    return () => {
      navigation.setOptions({ headerShown: true, title: '' });
    };
  }, [creatorDesktopJourneyBoard, showArrivalWaitingRoom, navigation]);

  const waitingBenchmarks = showArrivalWaitingRoom ? deriveArrivalBenchmarks(room) : null;
  const waitingTargetTime = showArrivalWaitingRoom
    ? !isCreator && liveState?.visibleMovementStartTime
      ? new Date(liveState.visibleMovementStartTime)
      : liveState?.startTime
      ? new Date(liveState.startTime)
      : room?.startTime
        ? new Date(room.startTime)
        : new Date(Date.now() + Math.max(secondsUntilStart, 1) * 1000)
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

  if (!room && !liveState) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
        <ArrivalWaitingRoom
          title="Journey room"
          statusLabel="Preparing your journey"
          statusMessage="Preparing your journey..."
          targetTime={new Date(Date.now() + 60_000)}
          startLabel="Start"
          destinationLabel="Destination"
          expectedDurationMinutes={null}
          modeLabel="Car"
          modeIcon="🚗"
          safetyMessage="Movement is delayed for safety."
          cards={[]}
          onHowItWorks={() => navigation.navigate('Help')}
          onGhostModeDetails={() => navigation.navigate('Help')}
        />
      </ScrollView>
    );
  }

  if (showArrivalWaitingRoom) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
        <ArrivalWaitingRoom
          title={room?.roomTitle ?? 'Arrival room'}
          statusLabel={liveState?.journeyStatus ? String(liveState.journeyStatus).replace(/_/g, ' ') : 'Preparing your journey'}
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
          statusMessage={liveState?.lifecycleMessage ?? 'Preparing your journey...'}
          onHowItWorks={() => navigation.navigate('Help')}
          onGhostModeDetails={() => navigation.navigate('Help')}
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

  const routeLabel = `${shortenPlaceLabel(room?.startingPointLabel ?? room?.routeSummary?.startLabel)} → ${shortenPlaceLabel(room?.destinationLabel ?? room?.routeSummary?.destinationLabel)}`;
  const hostGuessLabel = myPredictionDate ? formatClock(myPredictionDate, false) : room?.benchmarks?.hostPrediction?.arrivalTime ? formatClock(new Date(room.benchmarks.hostPrediction.arrivalTime), false) : 'Pending';
  const botGuessLabel =
    room?.benchmarks?.oracle?.arrivalTime
      ? formatClock(new Date(room.benchmarks.oracle.arrivalTime), false)
      : room?.oracleBotPrediction?.label ?? 'Pending';
  const guestCount = Math.max(0, safePredictions.filter((entry) => !entry.isCurrentUser && entry.status !== 'revoked').length);
  const creatorDesktopLiveJourney = creatorDesktopJourneyBoard && phase === 'started';
  const canStartJourney =
    !!liveState &&
    !isGenericRoom &&
    category !== 'weather_rain' &&
    phase !== 'started' &&
    liveState.status !== 'live';
  const participantRows = safePredictions
    .filter((entry) => entry.status !== 'revoked')
    .map((entry, index) => ({
      key: entry.predictionId ?? `${entry.user?.userId ?? 'row'}-${index}`,
      name:
        entry.user?.prediktHandle ??
        entry.user?.name ??
        (entry.isCurrentUser ? `${user?.prediktHandle ? `@${user.prediktHandle}` : user?.name ?? 'You'} (you)` : 'Guest'),
      locked: !!entry.predictedReachedTime || !!entry.selectedOptionKey,
      isCurrentUser: !!entry.isCurrentUser,
    }));
  const liveLeaderboardStandings =
    liveLeaderboard?.revealed && Array.isArray(liveLeaderboard.standings)
      ? liveLeaderboard.standings
      : [];
  const creatorDesktopRankRows = liveLeaderboard?.revealed
    ? liveLeaderboardStandings.slice(0, 6).map((standing, index) => ({
        key: `${standing.userId}-${standing.rank}`,
        rank: standing.rank ?? index + 1,
        name:
          standing.prediktHandle ??
          standing.user?.prediktHandle ??
          standing.user?.name ??
          'Guest',
        guess: standing.predictedReachedTime
          ? formatClock(new Date(standing.predictedReachedTime), false)
          : 'Pending',
        badge: standing.isWinnerSoFar ? 'Winning' : standing.isCurrentUser ? 'You' : `+${Math.round(Math.max(0, standing.deltaFromBestSeconds) / 60)} min`,
        highlight: standing.isWinnerSoFar || standing.isCurrentUser,
      }))
    : participantRows.map((participant, index) => ({
        key: participant.key,
        rank: index + 1,
        name: participant.name,
        guess: participant.locked ? 'Locked in' : 'Waiting',
        badge: participant.isCurrentUser ? 'You' : participant.locked ? 'Predicted' : 'Pending',
        highlight: participant.isCurrentUser,
      }));
  async function handleShareInviteLink() {
    if (!sharePayload) return;
    if (Platform.OS === 'web') {
      const shared = await shareViaWebShareApi({
        shareTitle: `Join ${sharePayload.shareTitle}`,
        shareText: sharePayload.shareText,
        inviteUrl: sharePayload.inviteUrl,
      });
      if (shared) return;
    }
    await Share.share({
      message: sharePayload.shareText,
      title: `Join ${sharePayload.shareTitle}`,
    });
  }

  async function handleCopyCode() {
    if (!inviteCode) return;
    const copied = await copyToClipboard(inviteCode);
    if (copied) {
      Alert.alert('Code copied', 'Your invite code is ready to paste.');
      return;
    }
    await Share.share({ message: inviteCode, title: 'Invite code' });
  }

  const stageLabel = getTravelStageFromProgress(pct, 'creator', { journeyStarted: phase === 'started' });
  const etaMinutesLabel =
    liveState?.etaMinutes != null
      ? `${liveState.etaMinutes} min`
      : `${Math.round((liveState?.expectedDurationSeconds ?? 2640) / 60)} min`;
  const heroMetaCopy =
    phase === 'open'
      ? lockCountdownLabel
        ? `${lockCountdownLabel} left to lock guesses`
        : 'Friends can still lock in their calls'
      : phase === 'locked'
        ? 'Guesses are locked — ready when you are'
        : phase === 'started'
          ? pct > 0
            ? `${stageLabel} · ${Math.round(pct)}% along the way`
            : 'Just started · first privacy-safe update coming soon'
          : 'Journey complete';
  const statusPillLabel =
    phase === 'started'
      ? stageLabel
      : phase === 'open'
        ? 'Predictions open'
        : phase === 'locked'
          ? 'Predictions closed'
          : 'Journey complete';
  const inviteNudgeCopy =
    guestCount === 0
      ? 'Share your code — the reveal gets better with every guess.'
      : guestCount === 1
        ? 'One guest is in. A couple more guesses makes this spicy.'
        : `${guestCount} guests are watching. Keep the room buzzing.`;
  const botVsYouHint = (() => {
    const hostMs = myPredictionDate?.getTime()
      ?? (room?.benchmarks?.hostPrediction?.arrivalTime
        ? new Date(room.benchmarks.hostPrediction.arrivalTime).getTime()
        : null);
    const botMs = room?.benchmarks?.oracle?.arrivalTime
      ? new Date(room.benchmarks.oracle.arrivalTime).getTime()
      : null;
    if (hostMs == null || botMs == null || Number.isNaN(hostMs) || Number.isNaN(botMs)) return 'just for fun';
    const diffMin = Math.round((botMs - hostMs) / 60000);
    if (Math.abs(diffMin) < 2) return 'neck and neck';
    return diffMin > 0 ? `${diffMin} min later than you` : `${Math.abs(diffMin)} min earlier than you`;
  })();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          backgroundColor: palette.bg,
          maxWidth: creatorDesktopJourneyBoard ? layout.maxWideWidth : layout.maxContentWidth,
          alignSelf: 'center',
          width: '100%',
        },
      ]}
    >
      {creatorDesktopJourneyBoard ? (
        <View style={styles.myPrediktionHeader}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.myPrediktionBack}
          >
            <Text style={styles.myPrediktionBackIcon}>←</Text>
          </Pressable>
          <View style={styles.myPrediktionBrand}>
            <BrandLogo height={40} />
          </View>
          <View style={styles.myPrediktionHeaderActions}>
            {inviteCode ? (
              <>
                <Pressable
                  onPress={() => void handleCopyCode()}
                  accessibilityRole="button"
                  accessibilityLabel={`Copy invite code ${inviteCode}`}
                  style={styles.myPrediktionCodeChip}
                >
                  <Text style={styles.myPrediktionCodeLabel}>Code</Text>
                  <Text style={styles.myPrediktionCodeValue}>{inviteCode}</Text>
                </Pressable>
              </>
            ) : null}
            <PrimaryButton
              label="Invite friends"
              onPress={handleInviteFriends}
              variant="secondary"
              icon="👥"
              fullWidth={false}
            />
          </View>
        </View>
      ) : null}

      {!isGenericRoom && room ? (
        <LinearGradient
          colors={['rgba(124,58,237,0.32)', 'rgba(15,21,39,0.98)', 'rgba(37,99,235,0.22)']}
          style={styles.journeyHeroShell}
        >
          <View style={styles.journeyHeroHeader}>
            <View style={styles.journeyHeroLead}>
              <View style={styles.journeyHeroRouteIcon}>
                <Text style={styles.journeyHeroRouteIconText}>📍</Text>
              </View>
              <View style={styles.journeyHeroRouteBlock}>
                <Text style={styles.journeyHeroRoute}>{routeLabel}</Text>
                <Text style={styles.journeyHeroMeta}>{heroMetaCopy}</Text>
              </View>
            </View>
            <View style={styles.journeyHeroPills}>
              <Pressable
                onPress={() => setShowPrivacyInfo((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="Why live location is hidden"
                style={styles.journeyHeroPrivacyPill}
              >
                <Text style={styles.journeyHeroPrivacyText}>🛡 Live location hidden</Text>
              </Pressable>
              <View style={styles.journeyHeroStatusPill}>
                <View style={[styles.journeyHeroStatusDot, phase === 'started' && styles.journeyHeroStatusDotLive]} />
                <Text style={styles.journeyHeroStatusText}>{statusPillLabel}</Text>
              </View>
            </View>
          </View>
          {showPrivacyInfo ? (
            <Text style={styles.journeyHeroPrivacyHint}>
              Friends never see your exact GPS. They follow delayed progress checkpoints so the race stays fun and private.
            </Text>
          ) : null}
          {creatorDesktopJourneyBoard && phase === 'started' ? (
            <View style={styles.journeyHeroSoftProgress}>
              <View style={styles.journeyHeroSoftProgressTrack}>
                <View
                  style={[
                    styles.journeyHeroSoftProgressFill,
                    { width: `${Math.max(6, Math.min(100, pct || 4))}%` },
                  ]}
                />
              </View>
              <Text style={styles.journeyHeroSoftProgressLabel}>
                {pct <= 0
                  ? 'Tracking just started · first checkpoint is privacy-delayed'
                  : `${Math.round(pct)}% complete · privacy-safe updates`}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
      ) : null}

      {phase === 'ended' ? (
        <View style={styles.terminalBanner}>
          <Text style={styles.terminalTitle}>{isDraw ? 'Result Ready' : 'Result Ready'}</Text>
          <Text style={styles.terminalCopy}>
            {isDraw
              ? 'This room closed neutrally — nobody counted as a loss. Here’s the recap.'
              : 'Predictions are in and the result is ready. See who made the closest guess.'}
          </Text>
          <PrimaryButton
            label="View Result"
            onPress={() => navigation.navigate('Result', { roomId })}
            icon="🏆"
          />
        </View>
      ) : !creatorDesktopJourneyBoard ? (
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
              ? 'Guesses are locked in — no more changes. Now we watch.'
                : isGenericRoom
                  ? 'Voting is live. Make your call before the timer ends.'
                  : 'Guesses are locked. Delayed progress updates will roll in below.'}
          </Text>
        </View>
      ) : null}

      {/* Guest lead: a calm confirmation of their own guess + one line on what's next. */}
      {isGuestView && myPredictionDate ? (
        <View style={[styles.card, styles.guestGuessCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.guestGuessLabel, { color: colors.textSecondary }]}>Your guess</Text>
          <Text style={[styles.guestGuessTime, { color: colors.textPrimary }]}>
            {formatClock(myPredictionDate, false)} · locked in ✓
          </Text>
          {guestNotStarted ? (
            <Text style={[styles.guestGuessHint, { color: colors.textSecondary }]}>
              Journey starts when {creatorName} taps go.
            </Text>
          ) : phase === 'started' ? (
            <Text style={[styles.guestGuessHint, { color: colors.textSecondary }]}>
              Waiting for the result — watch the progress below.
            </Text>
          ) : null}
        </View>
      ) : null}

      {room && phase !== 'ended' && (isCreator || isGenericRoom) && !creatorDesktopJourneyBoard ? (
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
          <Text style={styles.reviewBannerTitle}>✏️ One-minute review window</Text>
          <Text style={styles.reviewBannerCopy}>
            {reviewCountdownLabel}. Human times stay blurred until your own prediction locks.
          </Text>
        </View>
      ) : null}

      {isGenericRoom ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>{room?.roomTitle ?? 'Wild Cards'}</Text>
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
      ) : !creatorDesktopJourneyBoard ? (
        <LiveStatusCard
          theme={categoryTheme}
          title={room?.roomTitle ?? (category === 'weather_rain' ? 'Weather Room' : 'Live room')}
          statusLabel={category === 'weather_rain' ? (liveState?.journeyStatus ?? liveState?.status ?? 'live').replace(/_/g, ' ') : getTravelStageFromProgress(pct, isCreator ? 'creator' : 'guest', { journeyStarted: phase === 'started' })}
          statusTone="live"
          progress={category !== 'weather_rain' ? pct : undefined}
          etaLabel={
            liveState?.etaMinutes != null
              ? `${liveState.etaMinutes} min remaining`
              : suppressGuestStartCountdown
                ? undefined
                : trackingCountdownLabel ?? (minutesUntilStart > 0 ? `Starts in ${minutesUntilStart} min` : undefined)
          }
          oracleLabel={room?.baselineLabel ?? room?.oracleBotPrediction?.label}
          lifecycleNote={
            suppressGuestStartCountdown
              ? "You're in. Predictions are open and journey updates will appear here shortly."
              : liveState?.waitingForDelayedStart && !isCreator
                ? (trackingCountdownLabel ?? 'Waiting to start.')
                : (liveState?.lifecycleMessage ?? liveState?.safetyMessage)
          }
        />
      ) : null}

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

      {!isGenericRoom && !creatorDesktopJourneyBoard ? (
        <View>
          <Text
            onPress={() => setShowPrivacyInfo((v) => !v)}
            style={[styles.privacyLink, { color: colors.textMuted }]}
          >
            🔒 Location hidden ⓘ
          </Text>
          {showPrivacyInfo ? (
            <View style={[styles.privacyPill, { backgroundColor: colors.purpleDim }]}>
              <Text style={[styles.privacyText, { color: colors.purpleLight }]}>
                Exact location stays hidden. Progress is delayed and shared only at key moments.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {creatorDesktopJourneyBoard ? (
        <View style={styles.creatorDesktopStack}>
          <View style={[styles.creatorDesktopCard, styles.creatorDesktopJourneyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.creatorDesktopCardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.creatorDesktopTitle, { color: colors.textPrimary }]}>Journey view</Text>
                <Text style={[styles.creatorDesktopSub, { color: colors.textSecondary }]}>
                  Friends follow delayed progress — never your exact spot.
                </Text>
              </View>
              <View style={styles.journeyViewStatusPill}>
                <View style={[styles.journeyViewStatusDot, phase === 'started' && styles.journeyViewStatusDotLive]} />
                <Text style={styles.journeyViewStatusText}>
                  {phase === 'started' ? stageLabel : 'Waiting to start'}
                </Text>
              </View>
            </View>
            <ArrivalJourneyViz
              progressPercentage={pct}
              etaMinutes={liveState?.etaMinutes}
              status={liveState?.journeyStatus ?? liveState?.status}
              startLabel={room?.startingPointLabel ?? room?.routeSummary?.startLabel ?? 'Start'}
              destinationLabel={room?.destinationLabel ?? room?.routeSummary?.destinationLabel ?? 'Destination'}
              safetyMessage={liveState?.safetyMessage}
              primaryColor="#A855F7"
              secondaryColor="#3B82F6"
              embedded
            />
          </View>

          <View style={[styles.creatorDesktopStatusStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.journeyHeroStats}>
              <View style={styles.journeyHeroStat}>
                <Text style={styles.journeyHeroStatIcon}>⏱</Text>
                <Text style={styles.journeyHeroStatLabel}>
                  {liveState?.etaMinutes != null ? 'Time left' : 'ETA'}
                </Text>
                <Text style={styles.journeyHeroStatValue}>{etaMinutesLabel}</Text>
                <Text style={styles.journeyHeroStatHint}>privacy-safe</Text>
              </View>
              <View style={styles.journeyHeroStatDivider} />
              <View style={styles.journeyHeroStat}>
                <Text style={styles.journeyHeroStatIcon}>👤</Text>
                <Text style={styles.journeyHeroStatLabel}>Your call</Text>
                <Text style={styles.journeyHeroStatValue}>{hostGuessLabel}</Text>
                <Text style={styles.journeyHeroStatHint}>locked in</Text>
              </View>
              <View style={styles.journeyHeroStatDivider} />
              <View style={styles.journeyHeroStat}>
                <Text style={styles.journeyHeroStatIcon}>🤖</Text>
                <Text style={styles.journeyHeroStatLabel}>Bot</Text>
                <Text style={styles.journeyHeroStatValue}>{botGuessLabel}</Text>
                <Text style={styles.journeyHeroStatHint}>{botVsYouHint}</Text>
              </View>
              <View style={styles.journeyHeroStatDivider} />
              <View style={styles.journeyHeroStat}>
                <Text style={styles.journeyHeroStatIcon}>👥</Text>
                <Text style={styles.journeyHeroStatLabel}>Guests</Text>
                <Text style={styles.journeyHeroStatValue}>{guestCount}</Text>
                <Text style={styles.journeyHeroStatHint}>
                  {guestCount === 0 ? 'invite a friend' : 'in the room'}
                </Text>
              </View>
            </View>
          </View>

          {creatorDesktopLiveJourney ? (
            <>
              <View style={[styles.creatorDesktopCard, styles.creatorDesktopControlsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.creatorDesktopCardHeader}>
                  <Text style={[styles.creatorDesktopIcon, { color: colors.purpleLight }]}>⚙</Text>
                  <View style={{ flex: 1 }}>
                  <Text style={[styles.creatorDesktopTitle, { color: colors.textPrimary }]}>Host tools</Text>
                    <Text style={[styles.creatorDesktopSub, { color: colors.textSecondary }]}>
                      {staysOpenUntilLabel ?? 'Finish the journey when you arrive, or cancel it fairly if plans change.'}
                    </Text>
                  </View>
                </View>
                <View style={styles.creatorDesktopControlsRow}>
                  <View style={styles.creatorDesktopControlAction}>
                    <PrimaryButton
                      label="Finish Journey"
                      onPress={handleConfirmArrival}
                      loading={confirmingArrival}
                      icon="✅"
                    />
                  </View>
                  <View style={styles.creatorDesktopControlAction}>
                    <PrimaryButton
                      label="Cancel Journey"
                      onPress={handleCancelJourney}
                      loading={cancelling}
                      variant="secondary"
                      icon="🛑"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.creatorDesktopLiveSplit}>
                <View style={[styles.creatorDesktopCard, styles.creatorDesktopSplitCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.creatorDesktopInviteIntro}>
                    <View style={[styles.creatorDesktopGiftIcon, { backgroundColor: 'rgba(139,92,246,0.18)' }]}>
                      <Text style={styles.creatorDesktopGiftEmoji}>🎁</Text>
                    </View>
                    <View style={styles.creatorDesktopInviteCopy}>
                      <Text style={[styles.creatorDesktopInviteTitle, { color: colors.textPrimary }]}>
                        Invite friends & win
                      </Text>
                      <Text style={[styles.creatorDesktopInviteBody, { color: colors.textSecondary }]}>
                        {inviteNudgeCopy}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.creatorDesktopInviteLabel, { color: colors.textSecondary }]}>Invite code · tap to copy</Text>
                  <Pressable
                    onPress={() => void handleCopyCode()}
                    accessibilityRole="button"
                    accessibilityLabel={`Copy invite code ${inviteCode}`}
                    style={styles.creatorDesktopCodeRow}
                  >
                    {inviteCode.split('').map((char: string, index: number) => (
                      <View
                        key={`${char}-${index}`}
                        style={[
                          styles.creatorDesktopCodeChip,
                          { backgroundColor: 'rgba(79,70,229,0.4)', borderColor: colors.border },
                        ]}
                      >
                        <Text style={styles.creatorDesktopCodeChipText}>{char}</Text>
                      </View>
                    ))}
                  </Pressable>
                  <View style={styles.creatorDesktopInviteActionsInline}>
                    <View style={styles.creatorDesktopInviteActionGrow}>
                      <PrimaryButton
                        label="Share link"
                        onPress={() => void handleShareInviteLink()}
                        gradientColors={['#8B5CF6', '#3B82F6']}
                        icon="🔗"
                      />
                    </View>
                    <View style={styles.creatorDesktopInviteActionGrow}>
                      <PrimaryButton
                        label="Copy code"
                        onPress={() => void handleCopyCode()}
                        variant="secondary"
                        icon="📋"
                      />
                    </View>
                  </View>
                </View>

                <View style={[styles.creatorDesktopCard, styles.creatorDesktopSplitCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.creatorDesktopCardHeader}>
                    <Text style={[styles.creatorDesktopIcon, { color: colors.purpleLight }]}>🏆</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.creatorDesktopTitle, { color: colors.textPrimary }]}>Who's closest</Text>
                      <Text style={[styles.creatorDesktopSub, { color: colors.textSecondary }]}>
                        {liveLeaderboard?.revealed
                          ? 'Live ranking from the latest projected arrival.'
                          : guestCount === 0
                            ? 'You are alone on the board — invite someone.'
                            : 'Guesses line up here as friends lock in.'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.creatorDesktopRankList}>
                    {creatorDesktopRankRows.length ? (
                      creatorDesktopRankRows.map((participant) => (
                        <View
                          key={participant.key}
                          style={[
                            styles.creatorDesktopRankRow,
                            {
                              borderColor: participant.highlight ? colors.purple : colors.border,
                              backgroundColor: participant.highlight ? colors.purpleDim : colors.surfaceHigh,
                            },
                          ]}
                        >
                          <View style={styles.creatorDesktopRankLead}>
                            <Text style={[styles.creatorDesktopRankNumber, { color: colors.purpleLight }]}>
                              #{participant.rank}
                            </Text>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.creatorDesktopRankName, { color: colors.textPrimary }]} numberOfLines={1}>
                                {participant.name}
                              </Text>
                              <Text style={[styles.creatorDesktopRankGuess, { color: colors.textSecondary }]}>
                                {participant.guess}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.creatorDesktopRankBadge,
                              { color: participant.highlight ? colors.purpleLight : colors.textMuted },
                            ]}
                          >
                            {participant.badge}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.creatorDesktopEmptyInvite}>
                        <Text style={[styles.startDelayCopy, { color: colors.textSecondary, marginBottom: 12 }]}>
                          The board is quiet. Share your code and get the first guess in.
                        </Text>
                        <PrimaryButton
                          label="Invite a friend"
                          onPress={handleInviteFriends}
                          gradientColors={['#8B5CF6', '#3B82F6']}
                          icon="📨"
                        />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </>
          ) : (
          <View style={styles.creatorDesktopGrid}>
            <View style={styles.creatorDesktopColumn}>
            {canStartJourney ? (
              <View style={[styles.creatorDesktopCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.creatorDesktopCardHeader}>
                  <Text style={[styles.creatorDesktopIcon, { color: colors.purpleLight }]}>▷</Text>
                  <Text style={[styles.creatorDesktopTitle, { color: colors.textPrimary }]}>Start Journey</Text>
                </View>
                <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
                  Choose when the visible journey begins. Friends see delayed progress, not exact GPS.
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
                <PrimaryButton
                  label="Start Journey"
                  onPress={handleStartRoom}
                  loading={starting}
                  gradientColors={['#8B5CF6', '#38BDF8']}
                />
              </View>
            ) : null}

            <View style={[styles.creatorDesktopCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.creatorDesktopCardHeader}>
                <Text style={[styles.creatorDesktopIcon, { color: colors.purpleLight }]}>⌘</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.creatorDesktopTitle, { color: colors.textPrimary }]}>People in this room</Text>
                  <Text style={[styles.creatorDesktopSub, { color: colors.textSecondary }]}>
                    More guesses make the reveal better!
                  </Text>
                </View>
              </View>
              <View style={styles.peopleStack}>
                {participantRows.length ? (
                  participantRows.map((participant) => (
                    <View key={participant.key} style={[styles.personRow, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}>
                      <View style={styles.personAvatar}>
                        <Text style={styles.personAvatarText}>{participant.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.personName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {participant.name}
                        </Text>
                      </View>
                      <Text style={[styles.personLock, { color: participant.locked ? '#86efac' : colors.textSecondary }]}>
                        {participant.locked ? 'Locked in' : 'Waiting'}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.startDelayCopy, { color: colors.textSecondary, marginBottom: 0 }]}>
                    No one has joined yet. Share the room to start the reveal.
                  </Text>
                )}
              </View>
              <PrimaryButton
                label="Invite friends to join"
                onPress={handleInviteFriends}
                variant="secondary"
                fullWidth
              />
            </View>

            </View>

            <View style={styles.creatorDesktopColumn}>
            <View style={[styles.creatorDesktopCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.creatorDesktopCardHeader}>
                <Text style={[styles.creatorDesktopIcon, { color: colors.purpleLight }]}>⚙</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.creatorDesktopTitle, { color: colors.textPrimary }]}>Host tools</Text>
                  <Text style={[styles.creatorDesktopSub, { color: colors.textSecondary }]}>
                    Start the journey now, then finish it when you arrive.
                  </Text>
                </View>
              </View>
              {!isTerminal ? (
                <>
                  <PrimaryButton label="Finish Journey" onPress={handleConfirmArrival} loading={confirmingArrival} icon="✅" />
                  <PrimaryButton label="Cancel Journey" onPress={handleCancelJourney} loading={cancelling} variant="secondary" icon="↗" />
                </>
              ) : null}
            </View>
            </View>
          </View>
          )}
        </View>
      ) : (isGenericRoom ? safePredictions.length > 0 : !!liveState && (safePredictions.length || anyCheckpointAvailable)) ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {isGenericRoom && genericSummaryRows.length > 0 ? (
            <View style={styles.genericSummaryWrap}>
              <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>Live votes</Text>
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
            data={safePredictions}
            title={isGenericRoom ? 'Prediction board' : undefined}
          />
          {!isGenericRoom ? (
            <LiveLeaderboard
              data={liveLeaderboard}
              unlockInSeconds={unlockInSeconds}
              onLockNow={handleLockNow}
              locking={locking}
            />
          ) : null}
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

      {isCreator && liveState && !isGenericRoom && category !== 'weather_rain' && !creatorDesktopJourneyBoard && (secondsUntilStart > 0 || liveState.status !== 'live') ? (
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

      {!isCreator && liveState?.waitingForDelayedStart && trackingCountdownLabel && !suppressGuestStartCountdown && !isGenericRoom && category !== 'weather_rain' ? (
        <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={[colors.purple + '30', 'transparent']} style={styles.creatorHeader}>
            <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>Journey starting soon</Text>
          </LinearGradient>
          <View style={styles.creatorBody}>
            <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
              {trackingCountdownLabel}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Live visualization — SVG only, never a map */}
      {!creatorDesktopJourneyBoard && !isGenericRoom && liveProgressPending ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>🚦 {getTravelStageFromProgress(20, 'creator')}</Text>
          <Text style={[styles.startDelayCopy, { color: colors.textSecondary, marginBottom: 0 }]}>
            Live progress will appear here shortly — hang tight. Guests see delayed checkpoint updates, not a live trail.
          </Text>
        </View>
      ) : !creatorDesktopJourneyBoard && !isGenericRoom && liveState && category === 'food_eta' ? (
        <FoodEtaViz
          progressPercentage={pct}
          etaMinutes={liveState.etaMinutes}
          status={liveState.journeyStatus ?? liveState.status}
        />
      ) : !creatorDesktopJourneyBoard && !isGenericRoom && liveState && category !== 'weather_rain' ? (
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
      ) : !creatorDesktopJourneyBoard && !isGenericRoom ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.waiting, { color: colors.textMuted }]}>Waiting for live updates…</Text>
        </View>
      ) : null}

      {/* Creator controls */}
      {isCreator && room?.answerType === 'multiple_choice' ? (
        <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={[colors.purple + '30', 'transparent']} style={styles.creatorHeader}>
            <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>{category === 'open_prediction' ? 'Host Confirms Result' : 'Declare Result'}</Text>
          </LinearGradient>
          <View style={styles.creatorBody}>
            <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
              {category === 'open_prediction'
                ? 'Choose the actual outcome from the original options. MVP rule: host-confirmed only, no screenshot upload. Predictors can challenge afterward.'
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

      {isCreator && room?.answerType !== 'multiple_choice' && !creatorDesktopJourneyBoard ? (
        <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={[colors.purple + '30', 'transparent']} style={styles.creatorHeader}>
            <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>⚙️  Host tools</Text>
          </LinearGradient>
          <View style={styles.creatorBody}>
            <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
              Your room runs on private checkpoints at 20%, 40%, 60%, 80%, 90%, and arrival. Friends only see delayed stage updates.
            </Text>
            {staysOpenUntilLabel ? (
              <Text style={[styles.startDelayCopy, { color: colors.purpleLight }]}>{staysOpenUntilLabel}</Text>
            ) : null}
            {!isTerminal ? (
              <>
                <PrimaryButton label="Finish Journey" onPress={handleConfirmArrival} loading={confirmingArrival} icon="✅" />
                <PrimaryButton label="Cancel Journey" onPress={handleCancelJourney} loading={cancelling} variant="secondary" icon="🛑" />
              </>
            ) : null}
          </View>
        </View>
      ) : null}

      {isTerminal ? (
        <PrimaryButton
          label="View Result"
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
  myPrediktionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  myPrediktionBack: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,21,39,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPrediktionBackIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: -1 },
  myPrediktionBrand: { flex: 1, alignItems: 'center' },
  myPrediktionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  myPrediktionCodeChip: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    backgroundColor: 'rgba(49,46,129,0.28)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
  },
  myPrediktionCodeLabel: {
    color: '#9BA7C2',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  myPrediktionCodeValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  myPrediktionCopyButton: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    backgroundColor: 'rgba(8,47,73,0.3)',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPrediktionCopyButtonText: {
    color: '#67E8F9',
    fontSize: 14,
    fontWeight: '800',
  },
  journeyHeroShell: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(123,63,228,0.34)',
    backgroundColor: 'rgba(15,21,39,0.96)',
    padding: 20,
    marginBottom: 16,
    gap: 10,
  },
  journeyHeroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  journeyHeroLead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 240 },
  journeyHeroRouteIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(168,85,247,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyHeroRouteIconText: { fontSize: 22 },
  journeyHeroRouteBlock: { flex: 1, gap: 6 },
  journeyHeroRoute: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', lineHeight: 26 },
  journeyHeroMeta: { color: '#9BA7C2', fontSize: 14, fontWeight: '700' },
  journeyHeroPills: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  journeyHeroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.28)',
    backgroundColor: 'rgba(8,47,73,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  journeyHeroStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22D3EE',
  },
  journeyHeroStatusDotLive: {
    backgroundColor: '#34D399',
    shadowColor: '#34D399',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  journeyHeroStatusText: { color: '#E0F2FE', fontSize: 13, fontWeight: '800' },
  journeyHeroPrivacyPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.22)',
    backgroundColor: 'rgba(49,46,129,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  journeyHeroPrivacyText: { color: 'rgba(255,255,255,0.86)', fontSize: 13, fontWeight: '700' },
  journeyHeroPrivacyHint: {
    color: '#C4B5FD',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 4,
  },
  journeyHeroSoftProgress: { gap: 8, marginTop: 4 },
  journeyHeroSoftProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  journeyHeroSoftProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#A855F7',
  },
  journeyHeroSoftProgressLabel: { color: '#9BA7C2', fontSize: 12, fontWeight: '700' },
  journeyViewStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(88,28,135,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  journeyViewStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A855F7' },
  journeyViewStatusDotLive: {
    backgroundColor: '#34D399',
    shadowColor: '#34D399',
    shadowOpacity: 0.75,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  journeyViewStatusText: { color: '#E9D5FF', fontSize: 12, fontWeight: '800' },
  journeyHeroProgressRail: {
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  journeyHeroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#38BDF8',
  },
  journeyHeroStats: { flexDirection: 'row', alignItems: 'stretch', flexWrap: 'wrap' },
  journeyHeroStat: { flex: 1, minWidth: 120, paddingHorizontal: 12, gap: 3 },
  journeyHeroStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(148,163,184,0.16)',
    marginVertical: 4,
  },
  journeyHeroStatIcon: { fontSize: 16, marginBottom: 2 },
  journeyHeroStatLabel: { color: '#9BA7C2', fontSize: 13, fontWeight: '700' },
  journeyHeroStatValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 2 },
  journeyHeroStatHint: { color: '#8B93B3', fontSize: 12, fontWeight: '600', marginTop: 2 },
  liveHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
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
  privacyPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16, marginTop: 6, alignSelf: 'flex-start' },
  privacyText: { fontSize: 12, fontWeight: '600' },
  privacyLink: { fontSize: 12, fontWeight: '700', alignSelf: 'flex-start' },
  guestGuessCard: { alignItems: 'center', gap: 4 },
  guestGuessLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  guestGuessTime: { fontSize: 26, fontWeight: '900' },
  guestGuessHint: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 2 },
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
  creatorDesktopStack: { gap: 14, marginBottom: 16 },
  creatorDesktopJourneyCard: { paddingBottom: 16 },
  creatorDesktopControlsCard: {
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(24,16,48,0.9)',
  },
  creatorDesktopLiveSplit: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
    flexWrap: 'wrap',
  },
  creatorDesktopSplitCard: {
    flex: 1,
    minWidth: 300,
    gap: 14,
  },
  creatorDesktopInviteActionsInline: {
    flexDirection: 'row',
    gap: 10,
  },
  creatorDesktopInviteActionGrow: { flex: 1 },
  creatorDesktopStatusStrip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 12,
    gap: 14,
  },
  creatorDesktopStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  creatorDesktopStatusLabel: { fontSize: 13, fontWeight: '800' },
  creatorDesktopStatusPct: { fontSize: 15, fontWeight: '900' },
  creatorDesktopGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  creatorDesktopRankList: { gap: 10 },
  creatorDesktopRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  creatorDesktopRankLead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  creatorDesktopRankNumber: {
    width: 34,
    fontSize: 16,
    fontWeight: '900',
  },
  creatorDesktopRankName: { fontSize: 15, fontWeight: '800' },
  creatorDesktopRankGuess: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  creatorDesktopRankBadge: { fontSize: 12, fontWeight: '800' },
  creatorDesktopEmptyInvite: { gap: 4 },
  creatorDesktopControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  creatorDesktopControlAction: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 160,
  },
  creatorDesktopInviteCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  creatorDesktopInviteIntro: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  creatorDesktopGiftIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorDesktopGiftEmoji: { fontSize: 24 },
  creatorDesktopInviteCopy: { flex: 1, gap: 4 },
  creatorDesktopInviteTitle: { fontSize: 17, fontWeight: '900' },
  creatorDesktopInviteBody: { fontSize: 13, lineHeight: 19 },
  creatorDesktopInviteMeta: { flex: 1, gap: 10 },
  creatorDesktopInviteLabel: { fontSize: 12, fontWeight: '800' },
  creatorDesktopCodeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  creatorDesktopCodeChip: {
    minWidth: 44,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  creatorDesktopCodeChipText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: 1.2 },
  creatorDesktopInviteActions: { width: 300, gap: 12 },
  creatorDesktopInviteAction: { width: '100%' },
  creatorDesktopNotifyCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  creatorDesktopNotifyCopy: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  creatorDesktopNotifyIcon: { fontSize: 24 },
  creatorDesktopNotifyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  creatorDesktopNotifyText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  creatorDesktopColumn: { flex: 1, gap: 16 },
  creatorDesktopCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  creatorDesktopCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  creatorDesktopCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  creatorDesktopIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 18,
    fontWeight: '900',
    backgroundColor: 'rgba(99,102,241,0.18)',
    paddingTop: 7,
  },
  creatorDesktopTitle: { fontSize: 17, fontWeight: '900' },
  creatorDesktopSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  creatorDesktopHint: { fontSize: 13, fontWeight: '800' },
  peopleStack: { gap: 10, marginBottom: 14 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139,92,246,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  personName: { fontSize: 15, fontWeight: '800' },
  personLock: { fontSize: 14, fontWeight: '800' },
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
