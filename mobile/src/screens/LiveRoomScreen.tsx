import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import ProgressBar from '../components/ProgressBar';
import PrimaryButton from '../components/PrimaryButton';
import TextInputField from '../components/TextInputField';
import { useTheme } from '../context/ThemeContext';
import api, { getApiErrorMessage } from '../services/api';
import { getCategoryTheme } from '../config/categoryTheme';
import LiveStatusCard from '../components/LiveStatusCard';
import { layout, palette } from '../theme/designSystem';

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
}

const startDelayOptions = [3, 5, 10, 15] as const;

export default function LiveRoomScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { roomId, isCreator } = route.params;
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [room, setRoom] = useState<any | null>(null);
  const [progressInput, setProgressInput] = useState('');
  const [etaInput, setEtaInput] = useState('');
  const [actualOptionKey, setActualOptionKey] = useState<string | null>(null);
  const [startDelayMinutes, setStartDelayMinutes] = useState(3);
  const [starting, setStarting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmingArrival, setConfirmingArrival] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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
    const interval = setInterval(fetchLiveState, 5000);
    return () => clearInterval(interval);
  }, []);

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
    } catch { /* silently retry */ }
  }

  async function handleStartRoom() {
    setStarting(true);
    try {
      await api.post(`/rooms/${roomId}/journey/start`, { startDelayMinutes });
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
      const res = await api.post(`/rooms/${roomId}/journey/confirm-arrival`);
      navigation.navigate('Result', { roomId, result: res.data });
    } catch (err: unknown) {
      Alert.alert('Arrival not confirmed', getApiErrorMessage(err, 'Could not confirm arrival.'));
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
      Alert.alert('Cancel failed', getApiErrorMessage(err, 'Could not close this journey fairly.'));
    } finally {
      setCancelling(false);
    }
  }

  async function handleProgressUpdate() {
    const pct = parseFloat(progressInput);
    if (isNaN(pct)) return Alert.alert('Error', 'Enter a valid 0–100 percentage.');
    setUpdating(true);
    try {
      await api.post(`/rooms/${roomId}/location-update`, {
        progressPercentage: pct,
        etaMinutes: etaInput ? parseInt(etaInput, 10) : undefined,
      });
      fetchLiveState();
    } catch (err: unknown) {
      Alert.alert('Failed', getApiErrorMessage(err, 'Could not send this privacy-safe progress update.'));
    } finally {
      setUpdating(false);
    }
  }

  async function handleEndRoom() {
    if (room?.answerType === 'multiple_choice') {
      if (!actualOptionKey) {
        return Alert.alert('Choose outcome', 'Select the actual outcome before declaring results.');
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
        Alert.alert('Failed', getApiErrorMessage(err, 'Could not declare this result.'));
      } finally {
        setEnding(false);
      }
      return;
    }

    Alert.alert('End Room?', 'This will calculate the winner and award Aura.', [
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
            Alert.alert('Failed', getApiErrorMessage(err, 'Could not end this room.'));
          } finally {
            setEnding(false);
          }
        },
      },
    ]);
  }

  const pct = liveState?.progressPercentage ?? 0;
  const secondsUntilStart = liveState?.secondsUntilStart ?? 0;
  const minutesUntilStart = Math.ceil(secondsUntilStart / 60);
  const canSendUpdates = liveState?.status === 'live' && secondsUntilStart === 0;
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

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}>

      <LiveStatusCard
        theme={categoryTheme}
        title={room?.roomTitle ?? (category === 'weather_rain' ? 'Weather Room' : 'Live PREDIKT')}
        statusLabel={(liveState?.journeyStatus ?? liveState?.status ?? 'live').replace(/_/g, ' ')}
        statusTone="live"
        progress={category !== 'weather_rain' ? pct : undefined}
        etaLabel={liveState?.etaMinutes != null ? `${liveState.etaMinutes} min` : minutesUntilStart > 0 ? `Starts in ${minutesUntilStart} min` : undefined}
        oracleLabel={room?.baselineLabel ?? room?.oracleBotPrediction?.label}
        lifecycleNote={liveState?.lifecycleMessage ?? liveState?.safetyMessage}
      />

      {/* Privacy notice */}
      <View style={[styles.privacyPill, { backgroundColor: colors.purpleDim }]}>
        <Text style={[styles.privacyText, { color: colors.purpleLight }]}>
          🔒 Ghost Mode on · exact GPS and raw movement are hidden · {liveState?.safetyMessage ?? 'Only approximate progress is shown.'}
        </Text>
      </View>

      {liveState ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>
            {category === 'weather_rain' ? 'Weather Room Status' : 'Journey Status'}
          </Text>
          <Text style={[styles.statusLine, { color: colors.purpleLight }]}>{(liveState.journeyStatus ?? liveState.status).replace(/_/g, ' ')}</Text>
          <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
            {category === 'weather_rain'
              ? 'Declare the actual rain outcome when the time window ends. Oracle Bot is a benchmark, not a guarantee.'
              : liveState.lifecycleMessage ?? 'Approx. journey progress is shown with privacy-safe timing.'}
          </Text>
          {category !== 'weather_rain' ? (
            <>
              <Text style={[styles.statusMeta, { color: colors.textSecondary }]}>
                Expected duration: {Math.round((liveState.expectedDurationSeconds ?? 3600) / 60)} min
              </Text>
              <Text style={[styles.statusMeta, { color: colors.textSecondary }]}>
                Auto-close: {liveState.autoCloseAt ? new Date(liveState.autoCloseAt).toLocaleString() : 'Pending start'}
              </Text>
              <Text style={[styles.statusMeta, { color: colors.textSecondary }]}>
                Grace buffer: {Math.round((liveState.gracePeriodSeconds ?? 600) / 60)} min
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      {isCreator && liveState && category !== 'weather_rain' && (!canSendUpdates || liveState.status !== 'live') ? (
        <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={[colors.purple + '30', 'transparent']} style={styles.creatorHeader}>
            <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>Start Journey</Text>
          </LinearGradient>
          <View style={styles.creatorBody}>
            {liveState.status === 'live' && secondsUntilStart > 0 ? (
              <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
                Journey timer starts in {minutesUntilStart} min. Progress updates unlock when the timer starts.
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

      {/* Progress card */}
      {liveState && category !== 'weather_rain' ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* ETA hero */}
          {liveState.etaMinutes !== null && (
            <View style={styles.etaBlock}>
              <Text style={[styles.etaNum, { color: colors.textPrimary }]}>{liveState.etaMinutes}</Text>
              <Text style={[styles.etaUnit, { color: colors.textSecondary }]}>min estimated</Text>
            </View>
          )}

          <ProgressBar percentage={pct} label="Journey Progress" />

          {/* Visual track */}
          <View style={styles.track}>
            <Text style={[styles.trackLabel, { color: colors.textMuted }]}>📍 Start</Text>
            <View style={[styles.trackLine, { backgroundColor: colors.border }]}>
              <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: colors.purple }]} />
              <Text style={[styles.trackDot, { left: `${Math.max(0, pct - 4)}%` }]}>🚗</Text>
            </View>
            <Text style={[styles.trackLabel, { color: colors.textMuted }]}>🏁 End</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.waiting, { color: colors.textMuted }]}>Waiting for live updates…</Text>
        </View>
      )}

      {/* Creator controls */}
      {isCreator && room?.answerType === 'multiple_choice' ? (
        <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={[colors.purple + '30', 'transparent']} style={styles.creatorHeader}>
            <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>Declare Result</Text>
          </LinearGradient>
          <View style={styles.creatorBody}>
            <Text style={[styles.startDelayCopy, { color: colors.textSecondary }]}>
              Choose the actual outcome from the original options. Predictions stay hidden until lock.
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
            <PrimaryButton label="Declare Result & See Winners" onPress={handleEndRoom} loading={ending} icon="🏁" />
          </View>
        </View>
      ) : null}

      {isCreator && room?.answerType !== 'multiple_choice' ? (
        <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={[colors.purple + '30', 'transparent']} style={styles.creatorHeader}>
            <Text style={[styles.creatorTitle, { color: colors.textPrimary }]}>⚙️  Creator Controls</Text>
          </LinearGradient>
          <View style={styles.creatorBody}>
            <TextInputField
              label="Privacy-safe progress % (0 – 100)"
              value={progressInput}
              onChangeText={setProgressInput}
              keyboardType="numeric"
              placeholder="e.g. 60"
            />
            <TextInputField
              label="ETA in minutes"
              value={etaInput}
              onChangeText={setEtaInput}
              keyboardType="numeric"
              placeholder="e.g. 20"
            />
            <PrimaryButton
              label={canSendUpdates ? 'Send Update' : 'Waiting for timer'}
              onPress={handleProgressUpdate}
              loading={updating}
              disabled={!canSendUpdates}
              icon="📡"
            />
            <PrimaryButton label="Confirm Arrival" onPress={handleConfirmArrival} loading={confirmingArrival} icon="✅" />
            <PrimaryButton label="Cancel / Plan Changed" onPress={handleCancelJourney} loading={cancelling} variant="secondary" icon="🛑" />
            <PrimaryButton label="End Room & See Results" onPress={handleEndRoom} loading={ending} variant="danger" icon="🏁" />
          </View>
        </View>
      ) : null}

      <PrimaryButton
        label="View Results"
        onPress={() => navigation.navigate('Result', { roomId })}
        variant="secondary"
        icon="🏆"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 880, alignSelf: 'center', padding: 20, paddingTop: 28 },
  liveHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  liveDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  liveText: { fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  heading: { fontWeight: '700', fontSize: 18 },
  privacyPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16, alignSelf: 'flex-start' },
  privacyText: { fontSize: 12, fontWeight: '600' },
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
