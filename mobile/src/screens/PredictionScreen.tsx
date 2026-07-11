import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import api, { getApiErrorMessage } from '../services/api';
import InfoTip from '../components/InfoTip';
import PredictionInputExactTime from '../components/PredictionInputExactTime';
import PredictionInputDuration from '../components/PredictionInputDuration';
import PredictionInputYesNo from '../components/PredictionInputYesNo';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Prediction'>;
  route: RouteProp<RootStackParamList, 'Prediction'>;
};

const durationChoices = [20, 30, 45, 60];
const quickMinutes = [-5, -1, 1, 5];

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  const hours = `${value.getHours()}`.padStart(2, '0');
  const minutes = `${value.getMinutes()}`.padStart(2, '0');
  const seconds = `${value.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export default function PredictionScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { roomId, room } = route.params;
  const answerType = room?.answerType ?? 'exact_time';
  const routeEtaSeconds = room?.route?.estimatedDurationSeconds ?? room?.journeyRoute?.estimatedDurationSeconds ?? 1800;
  const routeEtaDate = useMemo(() => new Date(Date.now() + routeEtaSeconds * 1000), [routeEtaSeconds]);

  const [exactTime, setExactTime] = useState(formatDateInput(routeEtaDate));
  const [durationMinutes, setDurationMinutes] = useState(Math.max(1, Math.round(routeEtaSeconds / 60)).toString());
  const [yesNoChoice, setYesNoChoice] = useState<'yes' | 'no' | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const multipleChoiceOptions = useMemo(() => {
    const scoringRule = room?.scoringRule ?? room?.creationMeta?.weatherOptions;
    if (Array.isArray(scoringRule?.weatherOptions)) return scoringRule.weatherOptions;
    if (Array.isArray(room?.creationMeta?.options)) {
      return room.creationMeta.options.map((key: string) => ({
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

  function adjustExactTime(deltaMinutes: number) {
    const current = new Date(exactTime);
    if (Number.isNaN(current.getTime())) return;
    current.setMinutes(current.getMinutes() + deltaMinutes);
    setExactTime(formatDateInput(current));
  }

  function buildPredictedReachedTime() {
    if (answerType === 'duration') {
      const parsed = Number(durationMinutes);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('Enter a valid duration in minutes.');
      }
      return new Date(Date.now() + parsed * 60 * 1000).toISOString();
    }

    if (answerType === 'yes_no') {
      if (!yesNoChoice) {
        throw new Error('Choose Yes or No first.');
      }
      const etaMs = routeEtaDate.getTime();
      return new Date(etaMs + (yesNoChoice === 'yes' ? -60_000 : 60_000)).toISOString();
    }

    if (answerType === 'multiple_choice') {
      if (!selectedOptionKey) {
        throw new Error('Choose an option first.');
      }
      return new Date().toISOString();
    }

    const dt = new Date(exactTime);
    if (Number.isNaN(dt.getTime())) {
      throw new Error('Use format YYYY-MM-DDTHH:MM:SS');
    }
    return dt.toISOString();
  }

  async function handleSubmit() {
    let predictedReachedTime: string;
    try {
      predictedReachedTime = buildPredictedReachedTime();
    } catch (error: any) {
      return Alert.alert('Missing prediction', error.message);
    }

    setLoading(true);
    try {
      await api.post(
        `/rooms/${roomId}/predictions`,
        answerType === 'multiple_choice'
          ? {
              selectedOptionKey,
            }
          : {
              predictedArrivalTime: predictedReachedTime,
            },
      );
      Alert.alert('Prediction submitted', 'Your Closest Guess has been recorded.', [
        { text: 'View room', onPress: () => navigation.navigate('LiveRoom', { roomId, isCreator: false }) },
      ]);
    } catch (err: unknown) {
      Alert.alert('Failed', getApiErrorMessage(err, 'Could not submit. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.heading, { color: colors.textPrimary }]}>Your Prediction</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        Make a hidden, privacy-safe guess. Closest prediction earns Aura.
      </Text>
      <InfoTip
        title="Prediction tips"
        body="Closest guess wins Aura. Predictions stay hidden until lock, so submit only when your guess feels ready."
      />

      <View style={[styles.roomCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.purple }]}>
        <Text style={[styles.roomTitle, { color: colors.textPrimary }]}>{room?.roomTitle}</Text>
        <View style={styles.routeRow}>
          <Text style={{ color: colors.green }}>📍</Text>
          <Text style={[styles.routeText, { color: colors.textSecondary }]}>{room?.startingPointLabel}</Text>
          <Text style={[styles.arrow, { color: colors.textMuted }]}>→</Text>
          <Text style={[styles.routeText, { color: colors.textSecondary }]}>{room?.destinationLabel}</Text>
        </View>
        <Text style={[styles.etaCopy, { color: colors.textSecondary }]}>
          Suggested ETA: {routeEtaDate.toLocaleTimeString()} • Closest guess wins Aura.
        </Text>
        <Text style={[styles.privacyCopy, { color: colors.green }]}>
          No exact live location is shown. Location is privacy-safe and delayed where applicable.
        </Text>
      </View>

      <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {answerType === 'exact_time' ? (
          <PredictionInputExactTime
            value={exactTime}
            onChange={setExactTime}
            onAdjust={adjustExactTime}
            quickMinutes={quickMinutes}
          />
        ) : null}

        {answerType === 'duration' ? (
          <PredictionInputDuration
            value={durationMinutes}
            onChange={setDurationMinutes}
            durationChoices={durationChoices}
          />
        ) : null}

        {answerType === 'yes_no' ? (
          <>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Choose Yes or No. This stays privacy-safe and hidden until lock.
            </Text>
            <PredictionInputYesNo value={yesNoChoice} onChange={setYesNoChoice} />
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

        <View style={[styles.tipBox, { backgroundColor: colors.purpleDim }]}>
          <Text style={[styles.tipText, { color: colors.purpleLight }]}>
            Submit once you are ready. If submission fails, nothing is saved and you can try again.
          </Text>
        </View>
      </View>

      <PrimaryButton label="Submit Prediction" onPress={handleSubmit} loading={loading} icon="🎯" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 820, alignSelf: 'center', padding: 24 },
  heading: { fontSize: 26, fontWeight: '800', marginBottom: 20 },
  sub: { fontSize: 14, lineHeight: 20, marginTop: -12, marginBottom: 14 },
  roomCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 20,
  },
  roomTitle: { fontWeight: '700', fontSize: 17, marginBottom: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeText: { fontSize: 14 },
  arrow: { fontSize: 14 },
  etaCopy: { marginTop: 10, fontSize: 13, lineHeight: 18 },
  privacyCopy: { marginTop: 6, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  inputCard: { borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 16 },
  helperText: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  optionStack: { marginBottom: 4 },
  optionHelper: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  tipBox: { borderRadius: 12, padding: 12, marginTop: 10 },
  tipText: { fontSize: 13, lineHeight: 18 },
});
