import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import api, { getApiErrorMessage } from '../services/api';
import RoutePlaceSearchInput, { PlaceSuggestion } from '../components/RoutePlaceSearchInput';
import PredictionOptionCard from '../components/PredictionOptionCard';
import TextInputField from '../components/TextInputField';
import TimePickerSegments from '../components/TimePickerSegments';
import TravelModeSelector, { TravelMode } from '../components/TravelModeSelector';
import RoutePreviewCard from '../components/RoutePreviewCard';
import RouteMapPreview from '../components/RouteMapPreview';
import StepProgress from '../components/StepProgress';
import CategoryTile from '../components/CategoryTile';
import CategoryVotePrompt from '../components/CategoryVotePrompt';
import ModeCard from '../components/ModeCard';
import PrivacyModeSelector from '../components/PrivacyModeSelector';
import CoachMark from '../components/CoachMark';
import { getCategoryTheme, CATEGORY_LIST, CategoryTheme } from '../config/categoryTheme';
import { featureFlags, isCategoryEnabled } from '../config/featureFlags';
import { voteCategoryInterest } from '../utils/categoryInterest';
import { layout, palette } from '../theme/designSystem';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'CreateRoom'> };

// The "Guesses lock at" field is a LOCAL wall-clock string (YYYY-MM-DDTHH:MM).
// The submit handlers parse it with `new Date(str)` (local) then `.toISOString()`
// to produce correct UTC — so any value we seed here must be LOCAL digits, not
// UTC. Using `.toISOString().slice(0,16)` here would emit UTC wall-clock digits
// that then get re-interpreted as local, shifting the time by the tz offset
// (e.g. -5:30 in IST) and pushing the lock time hours into the past.
function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function parseLocalDateTimeInput(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mergeLocalDateAndTime(datePart: string, timePart: Date): string {
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return datePart;
  const merged = new Date(
    year,
    month - 1,
    day,
    timePart.getHours(),
    timePart.getMinutes(),
    timePart.getSeconds(),
  );
  return toLocalDateTimeInput(merged);
}

function splitLocalDateTimeInput(value: string) {
  const parsed = parseLocalDateTimeInput(value) ?? new Date();
  const fallbackDatePart = toLocalDateTimeInput(parsed).split('T')[0];
  return {
    datePart: value.includes('T') ? value.split('T')[0] : fallbackDatePart,
    timePart: parsed,
  };
}

function LockDateTimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const parsed = splitLocalDateTimeInput(value);

  return (
    <View style={styles.lockFieldWrap}>
      <TextInputField
        label="Guesses lock date"
        value={parsed.datePart}
        onChangeText={(nextDate) => {
          const safeDate = nextDate.replace(/[^0-9-]/g, '').slice(0, 10);
          onChange(mergeLocalDateAndTime(safeDate, parsed.timePart));
        }}
        placeholder="2026-07-10"
        hint="Local date · YYYY-MM-DD"
        autoCapitalize="none"
      />
      <View style={styles.lockTimeBlock}>
        <Text style={styles.lockTimeLabel}>Guesses lock time</Text>
        <TimePickerSegments
          value={parsed.timePart}
          onChange={(nextTime) => onChange(mergeLocalDateAndTime(parsed.datePart, nextTime))}
          showSeconds
          showAmPm
        />
        <Text style={styles.lockTimeHint}>Local time · HH MM SS</Text>
      </View>
    </View>
  );
}

const makeDefaultCloseAt = () => toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000));
const startDelayOptions = [3, 5, 10, 15] as const;
const visibilities = ['invite_only', 'private', 'public'] as const;
const forecastProviders = ['Weather app', 'Google Weather', 'IMD', 'Other'] as const;

const categoryTiles = [
  {
    key: 'arrival_time',
    icon: '🚗',
    label: 'Arrival Time',
    helper: 'Predict arrivals, commutes, and real-world ETAs with privacy-safe route sharing.',
  },
  {
    key: 'weather_rain',
    icon: '🌧️',
    label: 'Will It Rain?',
    helper: 'Beat the Forecast for a location and time window.',
  },
  {
    key: 'food_eta',
    icon: '🍕',
    label: 'Food ETA',
    helper: 'Turn app ETA suspense into a playful friend challenge.',
  },
  {
    key: 'whos_late',
    icon: '⏰',
    label: "Who's Late?",
    helper: 'Call who reaches last or who beats the agreed time.',
  },
  {
    key: 'gym_habit',
    icon: '💪',
    label: 'Gym / Habit',
    helper: 'Create light accountability challenges without pressure.',
  },
] as const;

const modeOptions = [
  {
    key: 'friends',
    label: 'Play with Friends',
    helper: 'Invite your group and see who gets closest.',
  },
  {
    key: 'beat_bot',
    label: 'Beat the Bot',
    helper: "Make your call against Oracle Bot's benchmark.",
  },
  {
    key: 'challenge_self',
    label: 'Challenge Yourself',
    helper: 'Predict your own moment and build a streak.',
  },
] as const;

const routeTemplates = [
  { key: 'journey', label: 'Journey', roomCategory: 'travel' },
  { key: 'arrival', label: 'Arrival', roomCategory: 'journey' },
  { key: 'airport_run', label: 'Airport Run', roomCategory: 'travel' },
  { key: 'food_delivery', label: 'Food Delivery', roomCategory: 'delivery' },
  { key: 'ai_eta', label: 'AI vs Human ETA', roomCategory: 'ai_vs_human' },
] as const;

const routePredictionOptions = [
  {
    type: 'arrival_time',
    title: 'Arrival Time',
    description: 'Friends guess the exact time you will arrive.',
    answerType: 'exact_time',
    example: '09:42:30',
    icon: '🕒',
    recommended: true,
  },
  {
    type: 'journey_duration',
    title: 'Journey Duration',
    description: 'Friends guess how long the journey will take.',
    answerType: 'duration',
    example: '35 mins',
    icon: '⏱️',
  },
  {
    type: 'beat_eta',
    title: 'Beat ETA?',
    description: 'Friends choose whether you arrive before the estimated arrival time.',
    answerType: 'yes_no',
    example: 'Yes / No',
    icon: '⚡',
  },
] as const;

const weatherOptions = [
  {
    key: 'no_rain',
    label: 'No Rain',
    helper: 'No rain during the chosen window.',
  },
  {
    key: 'rain_before_6',
    label: 'Yes, before 6 PM',
    helper: 'Rain lands before 6 PM.',
  },
  {
    key: 'rain_after_6',
    label: 'Yes, after 6 PM',
    helper: 'Rain lands after 6 PM.',
  },
] as const;

const placeholderTemplates = {
  food_eta: {
    title: 'Will this order beat the app ETA?',
    question: 'Will it beat the app ETA?',
    answerType: 'yes_no',
    baselineLabel: 'Swiggy',
  },
  whos_late: {
    title: 'Who reaches last tonight?',
    question: 'Who will reach last?',
    answerType: 'yes_no',
    baselineLabel: 'Meet time',
  },
  gym_habit: {
    title: 'Will I hit the gym tomorrow?',
    question: 'Will I complete this habit?',
    answerType: 'yes_no',
    baselineLabel: 'Habit target',
  },
} as const;

interface StartLocation {
  latitude: number;
  longitude: number;
  label: string;
}

interface MapPoint {
  latitude: number;
  longitude: number;
  label: string;
}

function buildBoundsFromCoordinates(coordinates: Array<{ latitude: number; longitude: number }>) {
  const lats = coordinates.map((point) => point.latitude);
  const lngs = coordinates.map((point) => point.longitude);
  const padding = coordinates.length === 1 ? 0.01 : 0;
  return {
    north: Math.max(...lats) + padding,
    south: Math.min(...lats) - padding,
    east: Math.max(...lngs) + padding,
    west: Math.min(...lngs) - padding,
  };
}

export default function CreateRoomScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState<(typeof categoryTiles)[number]['key']>('arrival_time');
  const [selectedMode, setSelectedMode] = useState<(typeof modeOptions)[number]['key']>('friends');

  const [selectedRouteTemplateKey, setSelectedRouteTemplateKey] = useState<(typeof routeTemplates)[number]['key']>('journey');
  const [selectedRoutePredictionType, setSelectedRoutePredictionType] = useState<string>('arrival_time');
  const [startQuery, setStartQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [startPlaceId, setStartPlaceId] = useState('');
  const [destinationPlaceId, setDestinationPlaceId] = useState('');
  const [startLabel, setStartLabel] = useState('');
  const [destinationLabel, setDestinationLabel] = useState('');
  const [startLocation, setStartLocation] = useState<StartLocation | null>(null);
  const [selectedStartPoint, setSelectedStartPoint] = useState<MapPoint | null>(null);
  const [selectedDestinationPoint, setSelectedDestinationPoint] = useState<MapPoint | null>(null);
  const [locatingStart, setLocatingStart] = useState(false);
  const [startDelayMinutes, setStartDelayMinutes] = useState(3);
  const [travelMode, setTravelMode] = useState<TravelMode>('car');
  const [visibility, setVisibility] = useState<(typeof visibilities)[number]>('invite_only');
  const [predictionClosesAt, setPredictionClosesAt] = useState(makeDefaultCloseAt);
  const [titleOverride, setTitleOverride] = useState('');
  const [questionOverride, setQuestionOverride] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  // Tracks whether the user has edited the (now primary-path) close time, so an
  // arriving route preview only auto-fills a suggested lock time when untouched.
  const [closeTimeEdited, setCloseTimeEdited] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [weatherLocationLabel, setWeatherLocationLabel] = useState('');
  const [weatherWindowLabel, setWeatherWindowLabel] = useState('Today 5-8 PM');
  const [forecastChancePercent, setForecastChancePercent] = useState('65');
  const [forecastWindow, setForecastWindow] = useState('5-8 PM');
  const [forecastProviderLabel, setForecastProviderLabel] =
    useState<(typeof forecastProviders)[number]>('Weather app');
  const [weatherSelectedOption, setWeatherSelectedOption] = useState<(typeof weatherOptions)[number]['key']>('no_rain');

  const [placeholderTitle, setPlaceholderTitle] = useState('');
  const [placeholderQuestion, setPlaceholderQuestion] = useState('');
  const [placeholderBaselineValue, setPlaceholderBaselineValue] = useState('');
  const [placeholderLabel, setPlaceholderLabel] = useState('');
  const [votePromptCategory, setVotePromptCategory] = useState<CategoryTheme | null>(null);

  const selectedRouteTemplate = useMemo(
    () => routeTemplates.find((template) => template.key === selectedRouteTemplateKey) ?? routeTemplates[0],
    [selectedRouteTemplateKey],
  );
  const selectedRoutePrediction = useMemo(
    () => routePredictionOptions.find((option) => option.type === selectedRoutePredictionType) ?? routePredictionOptions[0],
    [selectedRoutePredictionType],
  );
  const readyForPreview = useMemo(
    () => (startPlaceId.trim().length > 0 || !!startLocation) && destinationPlaceId.trim().length > 0,
    [startPlaceId, startLocation, destinationPlaceId],
  );

  const placeholderPreset = useMemo(() => {
    if (selectedCategory === 'food_eta' || selectedCategory === 'whos_late' || selectedCategory === 'gym_habit') {
      return placeholderTemplates[selectedCategory];
    }
    return null;
  }, [selectedCategory]);
  const enabledModes = useMemo(
    () =>
      modeOptions.filter(
        (mode) =>
          mode.key === 'friends' ||
          (mode.key === 'beat_bot' && featureFlags.modeBeatTheBot) ||
          (mode.key === 'challenge_self' && featureFlags.modeChallengeYourself),
      ),
    [],
  );
  const shouldShowModeStep = enabledModes.length > 1;

  const mapPreview = useMemo(() => {
    if (preview) return preview;

    const start = startLocation
      ? {
          latitude: startLocation.latitude,
          longitude: startLocation.longitude,
          label: startLocation.label,
        }
      : selectedStartPoint;
    const destination = selectedDestinationPoint;

    if (!start && !destination) return null;

    const coordinates: Array<{ latitude: number; longitude: number }> = [];
    if (start) {
      coordinates.push({ latitude: start.latitude, longitude: start.longitude });
    }
    if (destination) {
      coordinates.push({ latitude: destination.latitude, longitude: destination.longitude });
    }

    return {
      startLabel: start?.label,
      destinationLabel: destination?.label,
      travelMode,
      start: start ?? null,
      destination: destination ?? null,
      previewGeometry: {
        coordinates,
        bounds: buildBoundsFromCoordinates(coordinates),
      },
      isApproximate: true,
      providerLabel: start && destination ? 'Route preview loading' : 'Selected place',
    };
  }, [preview, selectedDestinationPoint, selectedStartPoint, startLocation, travelMode]);

  async function resolveSelectedPlace(suggestion: PlaceSuggestion): Promise<MapPoint | null> {
    const latitude = Number(suggestion.latitude);
    const longitude = Number(suggestion.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        latitude,
        longitude,
        label: suggestion.label,
      };
    }

    try {
      const res = await api.get(`/routes/place-details/${encodeURIComponent(suggestion.placeId)}`);
      const resolvedLatitude = Number(res.data?.latitude);
      const resolvedLongitude = Number(res.data?.longitude);
      if (Number.isFinite(resolvedLatitude) && Number.isFinite(resolvedLongitude)) {
        return {
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
          label: res.data?.label ?? suggestion.label,
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  function routePayload() {
    return {
      startPlaceId: startLocation ? undefined : startPlaceId.trim(),
      startLocation: startLocation
        ? {
            latitude: startLocation.latitude,
            longitude: startLocation.longitude,
            label: startLocation.label,
          }
        : undefined,
      destinationPlaceId: destinationPlaceId.trim(),
      roomCategory: selectedRouteTemplate.roomCategory,
      travelMode,
      visibility,
      startDelayMinutes,
    };
  }

  async function applyReverseGeocodedStart(latitude: number, longitude: number) {
    try {
      const res = await api.get('/routes/reverse-geocode', {
        params: { latitude, longitude },
      });
      const label = res.data?.label?.trim() || 'Current location';
      const placeId = res.data?.placeId?.trim();

      if (placeId && !placeId.startsWith('current-location:')) {
        setStartPlaceId(placeId);
        setStartLocation(null);
        setSelectedStartPoint({ latitude, longitude, label });
      } else {
        setStartPlaceId('');
        setStartLocation({ latitude, longitude, label });
        setSelectedStartPoint({ latitude, longitude, label });
      }
      setStartLabel(label);
      setStartQuery(label);
    } catch {
      const fallbackLabel = 'Current location';
      setStartLocation({ latitude, longitude, label: fallbackLabel });
      setStartPlaceId('');
      setSelectedStartPoint({ latitude, longitude, label: fallbackLabel });
      setStartLabel(fallbackLabel);
      setStartQuery(fallbackLabel);
    }
  }

  function resetCreateErrors() {
    setPreviewError(null);
    setCreateError(null);
  }

  function swapRoute() {
    setPreview(null);
    setPreviewError(null);
    const prevStartQuery = startQuery;
    const prevStartPlaceId = startPlaceId;
    const prevStartLabel = startLabel;
    const prevStartPoint = selectedStartPoint;
    const prevStartLocation = startLocation;

    // New start = old destination.
    setStartQuery(destinationQuery);
    setStartPlaceId(destinationPlaceId);
    setStartLabel(destinationLabel);
    setStartLocation(null);
    setSelectedStartPoint(selectedDestinationPoint);

    // New destination = old start. The destination model has no "current
    // location" concept, so fold a live-location start down into a fixed point.
    setDestinationQuery(prevStartQuery);
    setDestinationPlaceId(prevStartPlaceId);
    setDestinationLabel(prevStartLabel);
    setSelectedDestinationPoint(
      prevStartPoint ??
        (prevStartLocation
          ? {
              latitude: prevStartLocation.latitude,
              longitude: prevStartLocation.longitude,
              label: prevStartLocation.label,
            }
          : null),
    );
  }

  function trackCreateEvent(eventType: string, metadata: Record<string, unknown>) {
    api.post('/events', { eventType, metadata }).catch(() => undefined);
  }

  function onCategorySelect(nextCategory: (typeof categoryTiles)[number]['key']) {
    setSelectedCategory(nextCategory);
    trackCreateEvent('category_selected', { category: nextCategory });
    setShowAdvancedOptions(false);
    resetCreateErrors();
    if (nextCategory !== 'arrival_time') {
      setPreview(null);
    }
    if (nextCategory === 'weather_rain') {
      setPlaceholderLabel('');
    }
    if (nextCategory === 'food_eta' || nextCategory === 'whos_late' || nextCategory === 'gym_habit') {
      const preset = placeholderTemplates[nextCategory];
      setPlaceholderTitle(preset.title);
      setPlaceholderQuestion(preset.question);
      setPlaceholderLabel(preset.baselineLabel);
    }
  }

  async function useCurrentLocationForStart() {
    setPreviewError(null);
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const message = 'Search your starting point instead.';
        setPreviewError(message);
        return Alert.alert('Location unavailable', message);
      }

      if (
        typeof window !== 'undefined' &&
        !window.isSecureContext &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        const message =
          'Browser location needs HTTPS or localhost. Open the app on localhost or a secure URL, then try Use current again.';
        setPreviewError(message);
        return Alert.alert('Secure context needed', message);
      }

      setLocatingStart(true);
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 60_000,
          });
        });

        const nextStart = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Current location',
        };
        setStartLocation(nextStart);
        setStartPlaceId('');
        setStartLabel(nextStart.label);
        setStartQuery(nextStart.label);
        setPreview(null);
        await applyReverseGeocodedStart(nextStart.latitude, nextStart.longitude);
        return;
      } catch (error: unknown) {
        const message =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: number }).code === 1
            ? 'Location permission was blocked in the browser. Allow location access and try again.'
            : 'Search your starting point instead.';
        setPreviewError(message);
        return Alert.alert('Location unavailable', message);
      } finally {
        setLocatingStart(false);
      }
    }

    setLocatingStart(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        const message = 'Location permission is needed to use your current location as Start.';
        setPreviewError(message);
        return Alert.alert('Location permission needed', message);
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextStart = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        label: 'Current location',
      };
      setStartLocation(nextStart);
      setStartPlaceId('');
      setStartLabel(nextStart.label);
      setStartQuery(nextStart.label);
      setPreview(null);
      await applyReverseGeocodedStart(nextStart.latitude, nextStart.longitude);
    } catch {
      const message = 'Could not read your current location. You can still search for Start manually.';
      setPreviewError(message);
      Alert.alert('Location unavailable', message);
    } finally {
      setLocatingStart(false);
    }
  }

  async function requestRoutePreview(showAlert = true) {
    setPreviewError(null);
    if (!readyForPreview) {
      const message = 'Choose both Start and Destination first.';
      setPreviewError(message);
      if (showAlert) {
        Alert.alert('Missing route', message);
      }
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await api.post('/routes/preview', routePayload());
      setPreview(res.data);
      if (!closeTimeEdited && res.data?.suggestedLockTime) {
        // suggestedLockTime is a UTC ISO string from the server; render it as
        // local wall-clock digits so the field (and the round-trip on submit)
        // stays in the user's timezone.
        const suggested = new Date(res.data.suggestedLockTime);
        if (!Number.isNaN(suggested.getTime())) {
          setPredictionClosesAt(toLocalDateTimeInput(suggested));
        }
      }
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Could not preview this route. Check the labels and try again.');
      setPreviewError(message);
      if (showAlert) {
        Alert.alert('Preview failed', message);
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    if (selectedCategory !== 'arrival_time' || !readyForPreview) {
      return;
    }

    const timer = setTimeout(() => {
      void requestRoutePreview(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [
    selectedCategory,
    readyForPreview,
    startPlaceId,
    startLocation?.latitude,
    startLocation?.longitude,
    destinationPlaceId,
    travelMode,
    selectedRouteTemplateKey,
  ]);

  async function handleCreateArrivalRoom() {
    setCreateError(null);
    if (!preview) {
      const message = 'Preview the route before creating the room.';
      setCreateError(message);
      return Alert.alert('Preview first', message);
    }

    const lockTimeInput = predictionClosesAt || preview.suggestedLockTime;
    const closeDate = new Date(lockTimeInput);
    if (Number.isNaN(closeDate.getTime())) {
      const message = 'Use format YYYY-MM-DDTHH:MM.';
      setCreateError(message);
      return Alert.alert('Invalid date', message);
    }

    setCreateLoading(true);
    try {
      const res = await api.post('/rooms/from-route', {
        ...routePayload(),
        roomType: selectedMode === 'challenge_self' ? 'single_target' : 'single_target',
        title: titleOverride.trim() || preview.suggestedRoomTitle,
        predictionClosesAt: closeDate.toISOString(),
        primaryPrediction: {
          type: selectedRoutePrediction.type,
          answerType: selectedRoutePrediction.answerType,
          question:
            questionOverride.trim() ||
            (selectedRoutePrediction.type === 'journey_duration'
              ? 'How long will the journey take?'
              : selectedRoutePrediction.type === 'beat_eta'
                ? 'Will I beat the ETA?'
                : preview.suggestedQuestion ?? 'When will I arrive?'),
        },
        category: 'arrival_time',
        mode: selectedMode,
      });
      navigation.navigate('RoomCreated', { room: res.data });
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Could not create the room. Try again in a moment.');
      setCreateError(message);
      Alert.alert('Create failed', message);
    } finally {
      setCreateLoading(false);
    }
  }

  function buildOracleWeatherPrediction() {
    const chance = Number(forecastChancePercent);
    if (!Number.isFinite(chance)) return null;
    if (chance < 60) return 'no_rain';
    return forecastWindow.toLowerCase().includes('before 6') || forecastWindow.includes('5')
      ? 'rain_before_6'
      : 'rain_after_6';
  }

  function buildPlaceholderTitle() {
    if (!placeholderPreset) return '';
    if (selectedCategory === 'food_eta') {
      return placeholderTitle.trim()
        ? `Food ETA PREDIKT: ${placeholderTitle.trim()}`
        : placeholderPreset.title;
    }
    if (selectedCategory === 'whos_late') {
      return placeholderLabel.trim()
        ? `${placeholderLabel.trim()} arrival PREDIKT`
        : placeholderPreset.title;
    }
    if (selectedCategory === 'gym_habit') {
      return placeholderLabel.trim()
        ? `${placeholderLabel.trim()} PREDIKT`
        : placeholderPreset.title;
    }
    return placeholderPreset.title;
  }

  async function handleCreateWeatherRoom() {
    setCreateError(null);
    if (!weatherLocationLabel.trim()) {
      const message = 'Add the weather location first.';
      setCreateError(message);
      return Alert.alert('Location needed', message);
    }

    const closeDate = new Date(predictionClosesAt);
    if (Number.isNaN(closeDate.getTime())) {
      const message = 'Use format YYYY-MM-DDTHH:MM.';
      setCreateError(message);
      return Alert.alert('Invalid date', message);
    }

    const forecastChance = Number(forecastChancePercent);
    if (!Number.isFinite(forecastChance) || forecastChance < 0 || forecastChance > 100) {
      const message = 'Forecast chance must be between 0 and 100.';
      setCreateError(message);
      return Alert.alert('Invalid forecast', message);
    }

    setCreateLoading(true);
    try {
      const forecastWindowValue = forecastWindow.trim() || weatherWindowLabel.trim();
      const snapshot = {
        forecastChancePercent: forecastChance,
        forecastWindow: forecastWindowValue,
        forecastProviderLabel,
        capturedAt: new Date().toISOString(),
      };
      const oracleBotPrediction = buildOracleWeatherPrediction();
      const res = await api.post('/rooms', {
        roomTitle: titleOverride.trim() || `Will it rain in ${weatherLocationLabel.trim()}?`,
        eventType: 'weather_rain',
        question: questionOverride.trim() || 'Beat the Forecast',
        category: 'weather_rain',
        roomType: 'social_prediction',
        answerType: 'multiple_choice',
        mode: selectedMode,
        templateKey: 'weather_rain',
        roomCategory: 'custom',
        startingPointLabel: weatherLocationLabel.trim(),
        destinationLabel: weatherWindowLabel.trim() || forecastWindowValue,
        predictionCloseTime: closeDate.toISOString(),
        visibility,
        baselineSource: forecastProviderLabel,
        baselineLabel: 'Forecast chance',
        baselineValue: forecastChance,
        baselineSnapshot: snapshot,
        oracleBotPrediction,
        options: weatherOptions.map((option) => option.key),
        scoringRule: {
          categoryKey: 'weather_rain',
          weatherOptions,
        },
        outcomeSource: 'forecast_snapshot',
        confidenceLevel: forecastChance >= 60 ? 'high' : forecastChance >= 35 ? 'medium' : 'low',
      });
      navigation.navigate('RoomCreated', { room: res.data });
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Could not create the weather room. Try again in a moment.');
      setCreateError(message);
      Alert.alert('Create failed', message);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleCreatePlaceholderRoom() {
    if (!placeholderPreset) return;
    setCreateError(null);
    const closeDate = new Date(predictionClosesAt);
    if (Number.isNaN(closeDate.getTime())) {
      const message = 'Use format YYYY-MM-DDTHH:MM.';
      setCreateError(message);
      return Alert.alert('Invalid date', message);
    }

    const isFoodEta = selectedCategory === 'food_eta';
    const etaMinutes = isFoodEta ? Number(placeholderBaselineValue) : null;
    if (isFoodEta && (!Number.isFinite(etaMinutes ?? NaN) || (etaMinutes ?? 0) <= 0)) {
      const message = 'Add the delivery app ETA in minutes.';
      setCreateError(message);
      return Alert.alert('ETA needed', message);
    }

    setCreateLoading(true);
    try {
      const foodEtaProvider = placeholderLabel.trim() || placeholderPreset.baselineLabel;
      const foodEtaSnapshot = isFoodEta
        ? {
            providerLabel: foodEtaProvider,
            predictedDurationMinutes: etaMinutes,
            predictedDurationSeconds: Math.round((etaMinutes ?? 0) * 60),
            capturedAt: new Date().toISOString(),
          }
        : null;
      const res = await api.post('/rooms', {
        roomTitle: buildPlaceholderTitle(),
        eventType: placeholderQuestion.trim() || placeholderPreset.question,
        question: placeholderQuestion.trim() || placeholderPreset.question,
        category: selectedCategory,
        roomType: 'social_prediction',
        answerType: placeholderPreset.answerType,
        mode: selectedMode,
        templateKey: selectedCategory,
        roomCategory: selectedCategory === 'food_eta' ? 'delivery' : 'custom',
        startingPointLabel: placeholderLabel.trim() || placeholderPreset.baselineLabel,
        destinationLabel: placeholderBaselineValue.trim() || 'Shared challenge',
        predictionCloseTime: closeDate.toISOString(),
        visibility,
        baselineSource: 'manual',
        baselineLabel: isFoodEta
          ? `${foodEtaProvider} ETA · ${etaMinutes} min`
          : placeholderLabel.trim() || placeholderPreset.baselineLabel,
        baselineValue: isFoodEta ? Math.round((etaMinutes as number) * 60) : placeholderBaselineValue.trim() || null,
        baselineSnapshot: foodEtaSnapshot,
        oracleBotPrediction: isFoodEta
          ? {
              label: `${foodEtaProvider} ETA · ${etaMinutes} min`,
              predictedDurationMinutes: etaMinutes,
              predictedDurationSeconds: Math.round((etaMinutes as number) * 60),
              reason: 'Manual delivery-app ETA benchmark',
            }
          : null,
        scoringRule: {
          categoryKey: selectedCategory,
          placeholder: true,
        },
      });
      navigation.navigate('RoomCreated', { room: res.data });
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Could not create the room. Try again in a moment.');
      setCreateError(message);
      Alert.alert('Create failed', message);
    } finally {
      setCreateLoading(false);
    }
  }

  // Honest stepper: only count the "Mode" step when more than one mode is actually
  // offered (in the MVP just "Play with Friends" is enabled, so it collapses to
  // Category → Setup on a single screen). Setup unlocks once the arrival route is
  // previewed, or immediately for the simpler category forms.
  const stepLabels = shouldShowModeStep ? ['Category', 'Mode', 'Setup'] : ['Category', 'Setup'];
  const setupUnlocked = selectedCategory === 'arrival_time' ? !!preview : true;
  const createStep = setupUnlocked ? stepLabels.length : shouldShowModeStep ? 2 : 1;

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]} keyboardShouldPersistTaps="handled">
      <LinearGradient colors={['rgba(34,211,238,0.26)', 'rgba(236,72,153,0.16)', 'rgba(56,189,248,0.12)']} style={styles.heroCard}>
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>CREATE</Text>
          </View>
          <View style={[styles.heroBadge, styles.heroBadgeMuted]}>
            <Text style={styles.heroBadgeMutedText}>Closest guess wins Aura</Text>
          </View>
        </View>
        <Text style={styles.heroHeadline}>
          What do you want to <Text style={styles.heroHeadlineAccent}>PREDIKT?</Text>
        </Text>
        <Text style={styles.heroSubline}>
          Pick a moment, invite friends, closest guess wins <Text style={styles.heroAura}>Aura.</Text>
        </Text>
        <StepProgress current={createStep} total={stepLabels.length} labels={stepLabels} />
      </LinearGradient>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Privacy</Text>
        <PrivacyModeSelector
          value={visibility === 'public' ? 'invite_only' : visibility}
          onChange={setVisibility}
          onLearnMore={() =>
            Alert.alert(
              'Ghost Mode',
              'Your exact GPS and raw movement stay private. Friends only see privacy-safe progress and your final result — never your live location.',
            )
          }
          onPrivateDetails={() =>
            Alert.alert(
              'Private Mode',
              'Only friends you invite can open this room and see its full details.',
            )
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Category</Text>
        <CoachMark
          storageKey="coachmark:create:aura"
          title="Aura"
          body="Reputation points. Closest guess wins. No money, no stress."
        />
        <CoachMark
          storageKey="coachmark:create:ghost_mode"
          title="Ghost Mode"
          body="Your live location stays private — only progress shows."
        />
        <View style={styles.categoryGrid}>
          {CATEGORY_LIST.map((theme) => {
            const enabled = isCategoryEnabled(theme.key);
            return (
              <CategoryTile
                key={theme.key}
                theme={theme}
                badge={enabled && theme.key === 'arrival_time' ? 'POPULAR' : undefined}
                locked={!enabled}
                selected={enabled && selectedCategory === theme.key}
                onPress={() =>
                  enabled
                    ? onCategorySelect(theme.key as (typeof categoryTiles)[number]['key'])
                    : setVotePromptCategory(theme)
                }
              />
            );
          })}
        </View>
      </View>

      {shouldShowModeStep ? (
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>How do you want to play?</Text>
        <View style={styles.modeGrid}>
          {enabledModes.map((mode) => (
            <ModeCard
              key={mode.key}
              label={mode.label}
              helper={mode.helper}
              icon={mode.key === 'beat_bot' ? '🤖' : mode.key === 'challenge_self' ? '💪' : '👥'}
              selected={selectedMode === mode.key}
              onPress={() => {
                setSelectedMode(mode.key);
                trackCreateEvent('mode_selected', { category: selectedCategory, mode: mode.key });
              }}
            />
          ))}
        </View>
      </View>
      ) : null}

      {selectedCategory === 'arrival_time' ? (
        <View style={[styles.card, styles.routeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>📍 Your route</Text>
            <View style={styles.cardHeaderActions}>
              <TouchableOpacity
                onPress={swapRoute}
                style={[styles.swapButton, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}
                accessibilityLabel="Swap start and destination"
              >
                <Text style={[styles.swapIcon, { color: colors.purpleLight }]}>⇅</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={useCurrentLocationForStart} disabled={locatingStart}>
                <Text style={[styles.linkAction, { color: colors.purpleLight }]}>
                  {locatingStart ? 'Locating…' : '📍 Use current location'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchFields}>
            <RoutePlaceSearchInput
              label="From"
              stackPriority={30}
              value={startQuery}
              onChangeValue={(value) => {
                setStartQuery(value);
                setPreview(null);
                if (value !== startLabel) {
                  setStartPlaceId('');
                  setStartLocation(null);
                  setSelectedStartPoint(null);
                }
              }}
              selectedPlaceId={startPlaceId}
              onSelect={async (suggestion) => {
                setStartPlaceId(suggestion.placeId);
                setStartLocation(null);
                setStartLabel(suggestion.label);
                setStartQuery(suggestion.label);
                setPreview(null);
                const point = await resolveSelectedPlace(suggestion);
                setSelectedStartPoint(point);
              }}
              placeholder="Start location"
            />

            <RoutePlaceSearchInput
              label="To"
              stackPriority={20}
              value={destinationQuery}
              onChangeValue={(value) => {
                setDestinationQuery(value);
                setPreview(null);
                if (value !== destinationLabel) {
                  setDestinationPlaceId('');
                  setSelectedDestinationPoint(null);
                }
              }}
              selectedPlaceId={destinationPlaceId}
              onSelect={async (suggestion) => {
                setDestinationPlaceId(suggestion.placeId);
                setDestinationLabel(suggestion.label);
                setDestinationQuery(suggestion.label);
                setPreview(null);
                const point = await resolveSelectedPlace(suggestion);
                setSelectedDestinationPoint(point);
              }}
              placeholder="Destination"
            />
          </View>

          <TravelModeSelector value={travelMode} onChange={setTravelMode} />

          <RouteMapPreview
            preview={mapPreview}
            loading={previewLoading}
            emptyLabel="Map preview"
            emptyCopy="Search and pick From and To to see places on the map."
          />

          {previewError ? <Text style={[styles.errorText, { color: colors.red }]}>{previewError}</Text> : null}

          {preview ? (
            <View style={styles.previewBlock}>
              <RoutePreviewCard preview={preview} compact />
              <Text style={[styles.generatedTitle, { color: colors.textPrimary }]}>
                {titleOverride.trim() || preview.suggestedRoomTitle}
              </Text>
              <Text style={[styles.generatedQuestion, { color: colors.textSecondary }]}>
                {questionOverride.trim() || preview.suggestedQuestion}
              </Text>
              <Text style={[styles.privacyNote, { color: colors.green }]}>
                Ghost Mode on · Accuracy wins. Speed does not.
              </Text>

              <TouchableOpacity onPress={() => setShowAdvancedOptions((value) => !value)}>
                <Text style={[styles.advancedToggle, { color: colors.purpleLight }]}>
                  {showAdvancedOptions ? 'Hide options' : 'More options'}
                </Text>
              </TouchableOpacity>

              {showAdvancedOptions ? (
                <View style={styles.advancedStack}>
                  <TextInputField
                    label="Room title"
                    value={titleOverride}
                    onChangeText={setTitleOverride}
                    placeholder={preview.suggestedRoomTitle}
                    hint="Defaults to the route title."
                  />
                  <LockDateTimeField
                    value={predictionClosesAt}
                    onChange={(value) => {
                      setCloseTimeEdited(true);
                      setPredictionClosesAt(value);
                    }}
                  />
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Visibility</Text>
                  <View style={styles.optionRow}>
                    {visibilities.map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        style={[
                          styles.chip,
                          {
                            borderColor: visibility === mode ? colors.purple : colors.border,
                            backgroundColor: visibility === mode ? colors.purpleDim : colors.surfaceHigh,
                          },
                        ]}
                        onPress={() => setVisibility(mode)}
                      >
                        <Text style={[styles.chipText, { color: colors.textPrimary }]}>{mode.replace('_', ' ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Start delay</Text>
                  <View style={styles.optionRow}>
                    {startDelayOptions.map((minutes) => (
                      <TouchableOpacity
                        key={minutes}
                        style={[
                          styles.chip,
                          {
                            borderColor: startDelayMinutes === minutes ? colors.purple : colors.border,
                            backgroundColor: startDelayMinutes === minutes ? colors.purpleDim : colors.surfaceHigh,
                          },
                        ]}
                        onPress={() => setStartDelayMinutes(minutes)}
                      >
                        <Text style={[styles.chipText, { color: colors.textPrimary }]}>{minutes} min</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Prediction type</Text>
                  <View style={styles.predictionGrid}>
                    {routePredictionOptions.map((option) => (
                      <PredictionOptionCard
                        key={option.type}
                        title={option.title}
                        description={option.description}
                        answerType={option.answerType}
                        example={option.example}
                        icon={option.icon}
                        recommended={'recommended' in option ? Boolean(option.recommended) : false}
                        selected={selectedRoutePredictionType === option.type}
                        onPress={() => setSelectedRoutePredictionType(option.type)}
                      />
                    ))}
                  </View>

                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Template</Text>
                  <View style={styles.optionRow}>
                    {routeTemplates.map((template) => (
                      <TouchableOpacity
                        key={template.key}
                        style={[
                          styles.chip,
                          {
                            borderColor: selectedRouteTemplateKey === template.key ? colors.purple : colors.border,
                            backgroundColor: selectedRouteTemplateKey === template.key ? colors.purpleDim : colors.surfaceHigh,
                          },
                        ]}
                        onPress={() => setSelectedRouteTemplateKey(template.key)}
                      >
                        <Text style={[styles.chipText, { color: colors.textPrimary }]}>{template.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInputField
                    label="Custom question"
                    value={questionOverride}
                    onChangeText={setQuestionOverride}
                    placeholder={preview.suggestedQuestion}
                  />
                </View>
              ) : null}

              {createError ? <Text style={[styles.errorText, { color: colors.red }]}>{createError}</Text> : null}
              <PrimaryButton label="Create PREDIKT" onPress={handleCreateArrivalRoom} loading={createLoading} icon="🎯" />
            </View>
          ) : null}
        </View>
      ) : null}

      {selectedCategory === 'weather_rain' ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Will it rain?</Text>
          <TextInputField
            label="Location"
            value={weatherLocationLabel}
            onChangeText={setWeatherLocationLabel}
            placeholder="Bengaluru, Koramangala"
          />
          <TextInputField
            label="Time window"
            value={weatherWindowLabel}
            onChangeText={(value) => {
              setWeatherWindowLabel(value);
              setForecastWindow(value);
            }}
            placeholder="Today 5-8 PM"
          />
          <TextInputField
            label="Forecast chance %"
            value={forecastChancePercent}
            onChangeText={setForecastChancePercent}
            placeholder="65"
            keyboardType="numeric"
          />

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Your call</Text>
          <View style={styles.optionRow}>
            {weatherOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.chip,
                  {
                    borderColor: weatherSelectedOption === option.key ? colors.purple : colors.border,
                    backgroundColor: weatherSelectedOption === option.key ? colors.purpleDim : colors.surfaceHigh,
                  },
                ]}
                onPress={() => setWeatherSelectedOption(option.key)}
              >
                <Text style={[styles.chipText, { color: colors.textPrimary }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => setShowAdvancedOptions((value) => !value)}>
            <Text style={[styles.advancedToggle, { color: colors.purpleLight }]}>
              {showAdvancedOptions ? 'Hide options' : 'More options'}
            </Text>
          </TouchableOpacity>

          {showAdvancedOptions ? (
            <View style={styles.advancedStack}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Forecast source</Text>
              <View style={styles.optionRow}>
                {forecastProviders.map((provider) => (
                  <TouchableOpacity
                    key={provider}
                    style={[
                      styles.chip,
                      {
                        borderColor: forecastProviderLabel === provider ? colors.purple : colors.border,
                        backgroundColor: forecastProviderLabel === provider ? colors.purpleDim : colors.surfaceHigh,
                      },
                    ]}
                    onPress={() => setForecastProviderLabel(provider)}
                  >
                    <Text style={[styles.chipText, { color: colors.textPrimary }]}>{provider}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInputField
                label="Custom title"
                value={titleOverride}
                onChangeText={setTitleOverride}
                placeholder={`Will it rain in ${weatherLocationLabel || 'this location'}?`}
              />
              <LockDateTimeField
                value={predictionClosesAt}
                onChange={(value) => {
                  setCloseTimeEdited(true);
                  setPredictionClosesAt(value);
                }}
              />
            </View>
          ) : null}

          {createError ? <Text style={[styles.errorText, { color: colors.red }]}>{createError}</Text> : null}
          <PrimaryButton label="Create PREDIKT" onPress={handleCreateWeatherRoom} loading={createLoading} icon="🌧️" />
        </View>
      ) : null}

      {placeholderPreset ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {categoryTiles.find((tile) => tile.key === selectedCategory)?.label}
          </Text>
          <TextInputField
            label={
              selectedCategory === 'food_eta'
                ? 'Order label'
                : selectedCategory === 'whos_late'
                  ? 'Who / group'
                  : 'Habit'
            }
            value={placeholderTitle}
            onChangeText={(value) => {
              setPlaceholderTitle(value);
              if (selectedCategory !== 'food_eta') {
                setPlaceholderLabel(value);
              }
            }}
            placeholder={
              selectedCategory === 'food_eta'
                ? 'Paneer roll'
                : selectedCategory === 'whos_late'
                  ? 'Team dinner'
                  : 'Gym tomorrow'
            }
          />
          <TextInputField
            label={
              selectedCategory === 'food_eta'
                ? 'App ETA (mins)'
                : selectedCategory === 'whos_late'
                  ? 'Meet time'
                  : 'Target'
            }
            value={selectedCategory === 'food_eta' ? placeholderBaselineValue : placeholderLabel}
            onChangeText={selectedCategory === 'food_eta' ? setPlaceholderBaselineValue : setPlaceholderLabel}
            placeholder={selectedCategory === 'food_eta' ? '35' : selectedCategory === 'whos_late' ? '8 PM' : 'Tomorrow AM'}
            keyboardType={selectedCategory === 'food_eta' ? 'numeric' : 'default'}
          />

          <View style={[styles.generatedBox, { backgroundColor: colors.surfaceHigh }]}>
            <Text style={[styles.generatedQuestion, { color: colors.textSecondary }]}>Question</Text>
            <Text style={[styles.generatedTitle, { color: colors.textPrimary }]}>
              {placeholderQuestion.trim() || placeholderPreset.question}
            </Text>
          </View>

          <LockDateTimeField
            value={predictionClosesAt}
            onChange={(value) => {
              setCloseTimeEdited(true);
              setPredictionClosesAt(value);
            }}
          />

          <TouchableOpacity onPress={() => setShowAdvancedOptions((value) => !value)}>
            <Text style={[styles.advancedToggle, { color: colors.purpleLight }]}>
              {showAdvancedOptions ? 'Hide options' : 'More options'}
            </Text>
          </TouchableOpacity>

          {showAdvancedOptions ? (
            <View style={styles.advancedStack}>
              {selectedCategory === 'food_eta' ? (
                <TextInputField
                  label="Delivery app"
                  value={placeholderLabel}
                  onChangeText={setPlaceholderLabel}
                  placeholder="Swiggy, Zomato, Blinkit"
                  hint="This is the benchmark provider your friends will see."
                />
              ) : null}
              <TextInputField
                label="Custom question"
                value={placeholderQuestion}
                onChangeText={setPlaceholderQuestion}
                placeholder={placeholderPreset.question}
              />
            </View>
          ) : null}

          {createError ? <Text style={[styles.errorText, { color: colors.red }]}>{createError}</Text> : null}
          <PrimaryButton label="Create PREDIKT" onPress={handleCreatePlaceholderRoom} loading={createLoading} icon="✨" />
        </View>
      ) : null}

      <CategoryVotePrompt
        visible={!!votePromptCategory}
        categoryLabel={votePromptCategory?.label ?? null}
        onVote={() => {
          if (votePromptCategory) voteCategoryInterest(votePromptCategory.key, votePromptCategory.label);
        }}
        onClose={() => setVotePromptCategory(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, gap: 16, paddingBottom: 40 },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.32)',
    backgroundColor: 'rgba(9,12,25,0.96)',
    padding: 18,
    gap: 12,
    overflow: 'hidden',
  },
  heroOrbLarge: {
    position: 'absolute',
    right: -26,
    top: -24,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(34,211,238,0.2)',
  },
  heroOrbSmall: {
    position: 'absolute',
    right: 52,
    top: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(236,72,153,0.18)',
  },
  heroBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.4)',
    backgroundColor: 'rgba(236,72,153,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeMuted: {
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroBadgeText: { color: '#F9A8D4', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  heroBadgeMutedText: { color: 'rgba(255,255,255,0.78)', fontSize: 10, fontWeight: '800' },
  hero: { gap: 4, marginTop: 4 },
  heading: { fontSize: 26, fontWeight: '900' },
  sub: { fontSize: 14, lineHeight: 20 },
  heroHeadline: { color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.4 },
  heroHeadlineAccent: { color: '#A5F3FC' },
  heroSubline: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  heroAura: { color: '#A5F3FC', fontWeight: '900' },
  cardHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swapButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapIcon: { fontSize: 16, fontWeight: '900' },
  section: { gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeGrid: { gap: 10 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryIcon: { fontSize: 16 },
  categoryLabel: { fontSize: 14, fontWeight: '800' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 11, alignItems: 'center' },
  modeChipText: { fontSize: 13, fontWeight: '800' },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  routeCard: { overflow: 'visible' },
  searchFields: { gap: 2, overflow: 'visible', zIndex: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '900' },
  linkAction: { fontSize: 13, fontWeight: '800' },
  previewBlock: { gap: 10, marginTop: 4 },
  generatedTitle: { fontSize: 15, fontWeight: '900', lineHeight: 21 },
  generatedQuestion: { fontSize: 13, lineHeight: 18 },
  privacyNote: { fontSize: 12, fontWeight: '700' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
  predictionGrid: { gap: 10 },
  generatedBox: { borderRadius: 12, padding: 12, gap: 4 },
  advancedToggle: { fontSize: 13, fontWeight: '800', paddingVertical: 4 },
  advancedStack: { gap: 10 },
  lockFieldWrap: { gap: 8 },
  lockTimeBlock: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  lockTimeLabel: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    alignSelf: 'flex-start',
  },
  lockTimeHint: {
    color: palette.textMuted,
    fontSize: 12,
    alignSelf: 'flex-start',
  },
  errorText: { fontSize: 13, fontWeight: '700' },
});
