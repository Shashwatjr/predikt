import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
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
import RouteMapPreview from '../components/RouteMapPreview';
import StepProgress from '../components/StepProgress';
import CategoryVotePrompt from '../components/CategoryVotePrompt';
import ModeCard from '../components/ModeCard';
import { PrivacyVisibility } from '../components/PrivacyModeSelector';
import { CategoryTheme } from '../config/categoryTheme';
import { featureFlags } from '../config/featureFlags';
import { voteCategoryInterest } from '../utils/categoryInterest';
import { appAlert } from '../utils/appAlert';
import { layout, palette } from '../theme/designSystem';
import { getTravelStageFromProgress } from '../utils/travelProgress';
import { formatClock } from '../utils/benchmarks';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreateRoom'>;
  route: RouteProp<RootStackParamList, 'CreateRoom'>;
};

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

function capWithEllipsis(text: string, max: number) {
  const value = text.trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function shortenJourneyPlaceLabel(label?: string | null) {
  const raw = (label ?? '').trim();
  if (!raw) return '';
  const [primary] = raw.split(',').map((part) => part.trim()).filter(Boolean);
  return capWithEllipsis(primary || raw, 24);
}

function buildJourneyRouteLabel(startLabel?: string | null, destinationLabel?: string | null) {
  const start = shortenJourneyPlaceLabel(startLabel) || 'Start';
  const destination = shortenJourneyPlaceLabel(destinationLabel) || 'Destination';
  return `${start} → ${destination}`;
}

function formatDiffFrom(reference: Date, comparison: Date, label: string) {
  const deltaSeconds = Math.round((reference.getTime() - comparison.getTime()) / 1000);
  if (deltaSeconds === 0) return `Same as ${label}`;
  const direction = deltaSeconds > 0 ? 'after' : 'before';
  const abs = Math.abs(deltaSeconds);
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  const pieces = [
    minutes > 0 ? `${minutes} min` : null,
    seconds > 0 ? `${seconds} sec` : null,
  ].filter(Boolean);
  return `${pieces.join(' ')} ${direction} ${label}`;
}

function pickNearestDateForTimeSelection(candidate: Date, anchor: Date) {
  const options = [-1, 0, 1].map((offsetDays) => {
    const next = new Date(candidate);
    next.setDate(candidate.getDate() + offsetDays);
    return next;
  });

  return options.reduce((closest, current) => {
    const currentDiff = Math.abs(current.getTime() - anchor.getTime());
    const closestDiff = Math.abs(closest.getTime() - anchor.getTime());
    return currentDiff < closestDiff ? current : closest;
  });
}

function formatPredictionDateLabel(date: Date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfDate - startOfToday) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// A date + time picker. Labels are configurable because this widget is reused for
// three distinct fields in the Delivery ETA form (vendor ETA, the creator's own
// prediction, and the guesses-lock time). Hardcoding "Guesses lock" made all three
// render identically, which read as a single widget duplicated three times.
// `showTime={false}` keeps the date row only and leaves the time part of `value`
// untouched — the Journey form takes its lock time from the suggested lock time,
// so the clock wheel was three columns of noise there.
function LockDateTimeField({
  value,
  onChange,
  dateLabel = 'Guesses lock date',
  timeLabel = 'Guesses lock time',
  hint = 'Local time · HH MM SS',
  showTime = true,
}: {
  value: string;
  onChange: (next: string) => void;
  dateLabel?: string;
  timeLabel?: string;
  hint?: string;
  showTime?: boolean;
}) {
  const parsed = splitLocalDateTimeInput(value);

  return (
    <View style={styles.lockFieldWrap}>
      <TextInputField
        label={dateLabel}
        value={parsed.datePart}
        onChangeText={(nextDate) => {
          const safeDate = nextDate.replace(/[^0-9-]/g, '').slice(0, 10);
          onChange(mergeLocalDateAndTime(safeDate, parsed.timePart));
        }}
        placeholder="2026-07-19"
        hint="Local date · YYYY-MM-DD"
        autoCapitalize="none"
      />
      {showTime ? (
        <View style={styles.lockTimeBlock}>
          <Text style={styles.lockTimeLabel}>{timeLabel}</Text>
          <TimePickerSegments
            value={parsed.timePart}
            onChange={(nextTime) => onChange(mergeLocalDateAndTime(parsed.datePart, nextTime))}
            showSeconds
            showAmPm
          />
          <Text style={styles.lockTimeHint}>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Compact time-only (HH:MM) picker for the Delivery ETA inputs. Reuses the clock
// wheel without the date row or the seconds column, so the vendor ETA and the
// creator's own prediction read as light, single-purpose fields — clearly distinct
// from the full date + time "Guesses lock" widget (the previous version reused the
// whole lock widget for all three, so they looked like one widget repeated 3x). The
// date part of `value` is preserved (defaults to today) so the stored ISO stays right.
function TimeOnlyField({
  value,
  onChange,
  label,
  hint,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  hint?: string;
}) {
  const parsed = splitLocalDateTimeInput(value);
  return (
    <View style={styles.lockTimeBlock}>
      <Text style={styles.lockTimeLabel}>{label}</Text>
      <TimePickerSegments
        value={parsed.timePart}
        onChange={(nextTime) => onChange(mergeLocalDateAndTime(parsed.datePart, nextTime))}
        showSeconds={false}
        showAmPm
      />
      {hint ? <Text style={styles.lockTimeHint}>{hint}</Text> : null}
    </View>
  );
}

function LockDateField({
  value,
  onChange,
  label = 'Vendor ETA date',
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  return (
    <TextInputField
      label={label}
      value={value}
      onChangeText={(nextDate) => onChange(nextDate.replace(/[^0-9-]/g, '').slice(0, 10))}
      placeholder="2026-07-19"
      hint="Local date · YYYY-MM-DD"
      autoCapitalize="none"
    />
  );
}

const makeDefaultCloseAt = () => toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000));
const startDelayOptions = [3, 5, 10, 15] as const;
const visibilities = ['invite_only', 'public'] as const;
const buildJourneyPredictionAdjustments = [
  { key: 'maps', label: 'Maps ETA' },
  { key: 'bot', label: 'Bot guess' },
  { key: 'minus_1m', label: '−1 min', seconds: -60 },
  { key: 'minus_30s', label: '−30 sec', seconds: -30 },
  { key: 'plus_30s', label: '+30 sec', seconds: 30 },
  { key: 'plus_1m', label: '+1 min', seconds: 60 },
  { key: 'plus_2m', label: '+2 min', seconds: 120 },
  { key: 'plus_5m', label: '+5 min', seconds: 300 },
] as const;
const forecastProviders = ['Weather app', 'Google Weather', 'IMD', 'Other'] as const;
const timeOnlyDeliveryProviders = ['Zomato', 'Swiggy', 'Blinkit', 'Zepto', 'Porter'] as const;
const dateOptionalDeliveryProviders = ['Amazon', 'Flipkart', 'Ekart', 'DTDC', 'Bluedart', 'India Post'] as const;
const genericDeliveryProviders = [
  ...timeOnlyDeliveryProviders,
  ...dateOptionalDeliveryProviders,
  'Other',
] as const;

type DeliveryVendorTimingMode = 'time_only' | 'date_or_datetime';

function providerTimingMode(provider: string): DeliveryVendorTimingMode {
  return (dateOptionalDeliveryProviders as readonly string[]).includes(provider)
    ? 'date_or_datetime'
    : 'time_only';
}

function formatVendorEtaLabel(value: string, mode: DeliveryVendorTimingMode) {
  const parsed = parseLocalDateTimeInput(value);
  if (!parsed) return value;
  if (mode === 'time_only') {
    return parsed.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

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
    icon: '📦',
    label: 'Delivery ETA',
    helper: 'Turn vendor ETA suspense into a playful friend challenge.',
  },
  {
    key: 'gym_habit',
    icon: '💪',
    label: 'Gym / Habit',
    helper: 'Create light accountability challenges without pressure.',
  },
  {
    key: 'sports_prediction',
    icon: '⚽',
    label: 'Sports',
    helper: 'Start with a match-style room like Argentina vs Spain, then add teams or players as needed.',
  },
  {
    key: 'open_prediction',
    icon: '🏆',
    label: 'Custom Prediktion',
    helper: 'Open a free-play room with your own question and prediction options.',
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
    helper: "Make your call against the bot's benchmark.",
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
  { key: 'food_delivery', label: 'Delivery', roomCategory: 'delivery' },
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
    title: 'Will this delivery beat the vendor ETA?',
    question: 'Will it beat the vendor ETA?',
    answerType: 'yes_no',
    baselineLabel: 'Zomato',
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

const openPredictionAnswerModes = [
  {
    key: 'multiple_choice',
    label: 'Custom options',
    helper: 'Use choices like Argentina, Spain, or Draw.',
  },
  {
    key: 'yes_no',
    label: 'Yes / No',
    helper: 'Simple binary poll for quick predictions.',
  },
] as const;

const genericRoomTemplates = [
  { key: 'sports', label: 'Sports match', title: 'Argentina vs Spain', question: 'Who will win?' },
  { key: 'delivery', label: 'Delivery race', title: 'Will this delivery beat the vendor ETA?', question: 'Will it arrive before the vendor ETA?' },
  { key: 'free_play', label: 'Free play', title: 'Tonight’s big call', question: 'What do you think happens?' },
] as const;

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

export default function CreateRoomScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= layout.breakpoints.tablet;
  const journeyOnlyFlow =
    !route.params?.presetCategory || route.params.presetCategory === 'arrival_time';

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
  const [visibility, setVisibility] = useState<PrivacyVisibility>('invite_only');
  const [predictionClosesAt, setPredictionClosesAt] = useState(makeDefaultCloseAt);
  const [titleOverride, setTitleOverride] = useState('');
  const [questionOverride, setQuestionOverride] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(!journeyOnlyFlow);
  // Tracks whether the user has edited the (now primary-path) close time, so an
  // arriving route preview only auto-fills a suggested lock time when untouched.
  const [closeTimeEdited, setCloseTimeEdited] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatorPrediction, setCreatorPrediction] = useState<Date | null>(null);
  const [predictionAnchor, setPredictionAnchor] = useState<'maps' | 'oracle'>('maps');

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
  const [placeholderPredictionValue, setPlaceholderPredictionValue] = useState(makeDefaultCloseAt);
  const [deliveryProviderPreset, setDeliveryProviderPreset] =
    useState<(typeof genericDeliveryProviders)[number]>('Zomato');
  const [deliveryProviderOther, setDeliveryProviderOther] = useState('');
  const [deliveryVendorEtaDate, setDeliveryVendorEtaDate] = useState(toLocalDateTimeInput(new Date()).split('T')[0]);
  const [deliveryVendorEtaDateTime, setDeliveryVendorEtaDateTime] = useState(makeDefaultCloseAt);
  const [deliveryUseDateAndTime, setDeliveryUseDateAndTime] = useState(false);
  const [votePromptCategory, setVotePromptCategory] = useState<CategoryTheme | null>(null);
  const [openPredictionTitle, setOpenPredictionTitle] = useState('');
  const [openPredictionQuestion, setOpenPredictionQuestion] = useState('');
  const [openPredictionOptions, setOpenPredictionOptions] = useState<string[]>(['', '']);
  const [openPredictionAnswerType, setOpenPredictionAnswerType] =
    useState<(typeof openPredictionAnswerModes)[number]['key']>('multiple_choice');
  const [genericTemplate, setGenericTemplate] =
    useState<(typeof genericRoomTemplates)[number]['key']>('free_play');
  const [genericDeliveryProvider, setGenericDeliveryProvider] =
    useState<(typeof genericDeliveryProviders)[number] | ''>('Zomato');
  const [genericDeliveryProviderOther, setGenericDeliveryProviderOther] = useState('');

  function applySportsPreset() {
    setSelectedCategory('sports_prediction');
    setOpenPredictionTitle('');
    setOpenPredictionQuestion('');
    setOpenPredictionOptions(['', '', '']);
    setOpenPredictionAnswerType('multiple_choice');
    setGenericTemplate('sports');
    setGenericDeliveryProvider('Zomato');
    setGenericDeliveryProviderOther('');
  }

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
    if (selectedCategory === 'food_eta' || selectedCategory === 'gym_habit') {
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
  const shouldShowModeStep = !journeyOnlyFlow && enabledModes.length > 1;
  const mapsEtaDate = useMemo(() => {
    if (!preview?.estimatedDurationSeconds) return null;
    return new Date(Date.now() + preview.estimatedDurationSeconds * 1000);
  }, [preview]);
  const botEtaDate = useMemo(() => {
    if (!preview?.oracleBotPrediction?.predictedDurationSeconds) return null;
    return new Date(Date.now() + preview.oracleBotPrediction.predictedDurationSeconds * 1000);
  }, [preview]);
  const shortenedRouteLabel = useMemo(
    () => buildJourneyRouteLabel(preview?.startLabel, preview?.destinationLabel),
    [preview?.destinationLabel, preview?.startLabel],
  );
  const predictionComparison = useMemo(() => {
    if (!creatorPrediction) return null;
    if (predictionAnchor === 'oracle' && botEtaDate) {
      return formatDiffFrom(creatorPrediction, botEtaDate, 'the bot');
    }
    if (mapsEtaDate) {
      return formatDiffFrom(creatorPrediction, mapsEtaDate, 'Maps');
    }
    if (botEtaDate) {
      return formatDiffFrom(creatorPrediction, botEtaDate, 'the bot');
    }
    return null;
  }, [botEtaDate, creatorPrediction, mapsEtaDate, predictionAnchor]);
  const predictionDateLabel = useMemo(
    () => (creatorPrediction ? formatPredictionDateLabel(creatorPrediction) : null),
    [creatorPrediction],
  );

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
    if (nextCategory === 'sports_prediction') {
      trackCreateEvent('category_selected', { category: 'sports_prediction' });
      setShowAdvancedOptions(false);
      resetCreateErrors();
      setPreview(null);
      applySportsPreset();
      return;
    }
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
    if (nextCategory === 'food_eta' || nextCategory === 'gym_habit') {
      const preset = placeholderTemplates[nextCategory];
      setPlaceholderTitle(preset.title);
      setPlaceholderQuestion(preset.question);
      setPlaceholderLabel(preset.baselineLabel);
      setPlaceholderBaselineValue('');
      setPlaceholderPredictionValue(makeDefaultCloseAt());
      if (nextCategory === 'food_eta') {
        setDeliveryProviderPreset('Zomato');
        setDeliveryProviderOther('');
        setDeliveryVendorEtaDate(toLocalDateTimeInput(new Date()).split('T')[0]);
        setDeliveryVendorEtaDateTime(makeDefaultCloseAt());
        setDeliveryUseDateAndTime(false);
      }
    }
    if (nextCategory === 'open_prediction') {
      setOpenPredictionTitle('Tonight’s big call');
      setOpenPredictionQuestion('What do you think happens?');
      setOpenPredictionOptions(['Option 1', 'Option 2']);
      setOpenPredictionAnswerType('multiple_choice');
      setGenericTemplate('free_play');
      setGenericDeliveryProvider('Zomato');
      setGenericDeliveryProviderOther('');
    }
  }

  function applyGenericTemplate(templateKey: (typeof genericRoomTemplates)[number]['key']) {
    const template = genericRoomTemplates.find((item) => item.key === templateKey) ?? genericRoomTemplates[0];
    setGenericTemplate(templateKey);
    setOpenPredictionTitle(template.title);
    setOpenPredictionQuestion(template.question);
    if (templateKey === 'sports') {
      setOpenPredictionAnswerType('multiple_choice');
      setOpenPredictionTitle('');
      setOpenPredictionQuestion('');
      setOpenPredictionOptions(['', '', '']);
    } else if (templateKey === 'delivery') {
      setOpenPredictionAnswerType('yes_no');
      setOpenPredictionTitle('Will this delivery beat the vendor ETA?');
      setOpenPredictionQuestion('Will it arrive before the vendor ETA?');
      setOpenPredictionOptions(['', '']);
    } else {
      setOpenPredictionAnswerType('multiple_choice');
      setOpenPredictionTitle('Tonight’s big call');
      setOpenPredictionQuestion('What do you think happens?');
      setOpenPredictionOptions(['Option 1', 'Option 2']);
    }
  }

  function updateOpenPredictionOption(index: number, value: string) {
    setOpenPredictionOptions((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function addOpenPredictionOption() {
    setOpenPredictionOptions((current) => [...current, '']);
  }

  function removeOpenPredictionOption(index: number) {
    setOpenPredictionOptions((current) => {
      if (current.length <= 2) return current;
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  useEffect(() => {
    if (
      route.params?.presetCategory === 'sports_prediction' ||
      (route.params?.presetCategory === 'open_prediction' && route.params?.presetTemplate === 'sports')
    ) {
      applySportsPreset();
      return;
    }
    if (route.params?.presetCategory === 'open_prediction') {
      onCategorySelect('open_prediction');
      return;
    }
    if (route.params?.presetCategory === 'food_eta') {
      onCategorySelect('food_eta');
      return;
    }
    if (route.params?.presetCategory === 'gym_habit') {
      onCategorySelect('gym_habit');
      return;
    }
    if (route.params?.presetCategory === 'arrival_time') {
      onCategorySelect('arrival_time');
    }
  }, [route.params?.presetCategory, route.params?.presetTemplate]);

  async function useCurrentLocationForStart() {
    setPreviewError(null);
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const message = 'Search your starting point instead.';
        setPreviewError(message);
        return appAlert('Location unavailable', message);
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
        return appAlert('Secure context needed', message);
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
        return appAlert('Location unavailable', message);
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
        return appAlert('Location permission needed', message);
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
      appAlert('Location unavailable', message);
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
        appAlert('Missing route', message);
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
        appAlert('Preview failed', message);
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

  useEffect(() => {
    if (selectedCategory !== 'arrival_time') return;
    if (!mapsEtaDate) {
      setCreatorPrediction(null);
      return;
    }
    setCreatorPrediction(new Date(mapsEtaDate));
    setPredictionAnchor('maps');
  }, [mapsEtaDate, preview?.destinationLabel, preview?.startLabel, selectedCategory, travelMode]);

  function applyPredictionShortcut(action: (typeof buildJourneyPredictionAdjustments)[number]) {
    if (!creatorPrediction) return;
    if (action.key === 'maps' && mapsEtaDate) {
      setCreatorPrediction(new Date(mapsEtaDate));
      setPredictionAnchor('maps');
      return;
    }
    if (action.key === 'bot' && botEtaDate) {
      setCreatorPrediction(new Date(botEtaDate));
      setPredictionAnchor('oracle');
      return;
    }
    if ('seconds' in action) {
      setCreatorPrediction(new Date(creatorPrediction.getTime() + action.seconds * 1000));
    }
  }

  async function handleCreateArrivalRoom() {
    setCreateError(null);
    if (!preview) {
      const message = 'Preview the route before creating the room.';
      setCreateError(message);
      return appAlert('Preview first', message);
    }

    const lockTimeInput = predictionClosesAt || preview.suggestedLockTime;
    const closeDate = new Date(lockTimeInput);
    if (Number.isNaN(closeDate.getTime())) {
      const message = 'Use format YYYY-MM-DDTHH:MM.';
      setCreateError(message);
      return appAlert('Invalid date', message);
    }
    if (!creatorPrediction) {
      const message = 'Add your prediction before creating the journey.';
      setCreateError(message);
      return appAlert('Prediction needed', message);
    }

    setCreateLoading(true);
    try {
      const fallbackQuestion = preview.suggestedQuestion ?? 'When will I arrive?';
      const safeTitle = capWithEllipsis(
        titleOverride.trim() || preview.suggestedRoomTitle || 'Arrival room',
        120,
      );
      const safeQuestion = capWithEllipsis(questionOverride.trim() || fallbackQuestion, 160);
      const res = await api.post('/rooms/from-route', {
        ...routePayload(),
        roomType: selectedMode === 'challenge_self' ? 'single_target' : 'single_target',
        title: safeTitle,
        predictionClosesAt: closeDate.toISOString(),
        primaryPrediction: {
          type: 'arrival_time',
          answerType: 'exact_time',
          question: safeQuestion,
        },
        hostPrediction: {
          arrivalTime: creatorPrediction.toISOString(),
        },
        category: 'arrival_time',
        mode: selectedMode,
      });
      try {
        await api.post(`/rooms/${res.data.roomId}/predictions`, {
          predictedArrivalTime: creatorPrediction.toISOString(),
        });
        navigation.navigate('RoomCreated', {
          room: {
            ...res.data,
            viewerHasPredicted: true,
            hostPrediction: { arrivalTime: creatorPrediction.toISOString() },
          },
        });
      } catch (predictionError: unknown) {
        appAlert(
          'Journey created',
          getApiErrorMessage(
            predictionError,
            'Your journey was created, but your prediction still needs to be saved.',
          ),
        );
        navigation.navigate('Prediction', {
          roomId: res.data.roomId,
          room: res.data,
          returnToRoomCreated: true,
        });
      }
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Could not create the room. Try again in a moment.');
      setCreateError(message);
      appAlert('Create failed', message);
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
        ? `Delivery ETA room: ${placeholderTitle.trim()}`
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
      return appAlert('Location needed', message);
    }

    const closeDate = new Date(predictionClosesAt);
    if (Number.isNaN(closeDate.getTime())) {
      const message = 'Use format YYYY-MM-DDTHH:MM.';
      setCreateError(message);
      return appAlert('Invalid date', message);
    }

    const forecastChance = Number(forecastChancePercent);
    if (!Number.isFinite(forecastChance) || forecastChance < 0 || forecastChance > 100) {
      const message = 'Forecast chance must be between 0 and 100.';
      setCreateError(message);
      return appAlert('Invalid forecast', message);
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
      appAlert('Create failed', message);
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
      return appAlert('Invalid date', message);
    }

    const isFoodEta = selectedCategory === 'food_eta';
    const selectedProvider =
      deliveryProviderPreset === 'Other'
        ? deliveryProviderOther.trim() || placeholderLabel.trim() || placeholderPreset.baselineLabel
        : deliveryProviderPreset;
    const vendorTimingMode = providerTimingMode(selectedProvider);
    const vendorEtaInput = isFoodEta
      ? vendorTimingMode === 'time_only'
        ? deliveryVendorEtaDateTime
        : deliveryUseDateAndTime
          ? deliveryVendorEtaDateTime
          : `${deliveryVendorEtaDate}T23:59`
      : '';
    const vendorEtaDate = isFoodEta ? parseLocalDateTimeInput(vendorEtaInput) : null;
    const predictedDate = isFoodEta ? parseLocalDateTimeInput(placeholderPredictionValue) : null;
    if (isFoodEta && !vendorEtaDate) {
      const message =
        vendorTimingMode === 'time_only'
          ? 'Add the vendor ETA time first.'
          : deliveryUseDateAndTime
            ? 'Add the vendor ETA date and time first.'
            : 'Add the vendor ETA date first.';
      setCreateError(message);
      return appAlert('ETA needed', message);
    }
    if (isFoodEta && !predictedDate) {
      const message = 'Add your own predicted delivery time too.';
      setCreateError(message);
      return appAlert('Prediction needed', message);
    }

    setCreateLoading(true);
    try {
      const foodEtaProvider = isFoodEta
        ? selectedProvider
        : placeholderLabel.trim() || placeholderPreset.baselineLabel;
      const vendorEtaLabel = isFoodEta ? formatVendorEtaLabel(vendorEtaInput, vendorTimingMode) : null;
      const creatorPredictionLabel = isFoodEta
        ? formatVendorEtaLabel(placeholderPredictionValue, 'date_or_datetime')
        : null;
      const foodEtaSnapshot = isFoodEta
        ? {
            providerLabel: foodEtaProvider,
            vendorTimingMode,
            vendorEtaLocal: vendorEtaInput,
            vendorEtaIso: vendorEtaDate?.toISOString(),
            creatorPredictionLocal: placeholderPredictionValue,
            creatorPredictionIso: predictedDate?.toISOString(),
            vendorEtaLabel,
            creatorPredictionLabel,
            vendorEtaEntryMode:
              vendorTimingMode === 'date_or_datetime'
                ? deliveryUseDateAndTime
                  ? 'date_time'
                  : 'date_only'
                : 'time_only',
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
        startingPointLabel:
          selectedCategory === 'food_eta'
            ? foodEtaProvider
            : placeholderLabel.trim() || placeholderPreset.baselineLabel,
        destinationLabel:
          selectedCategory === 'food_eta'
            ? vendorEtaLabel || 'Vendor ETA'
            : placeholderBaselineValue.trim() || 'Shared challenge',
        predictionCloseTime: closeDate.toISOString(),
        visibility,
        baselineSource: 'manual',
        baselineLabel: isFoodEta
          ? `${foodEtaProvider} ETA · ${vendorEtaLabel ?? 'Pending'}`
          : placeholderLabel.trim() || placeholderPreset.baselineLabel,
        baselineValue:
          isFoodEta
            ? vendorEtaDate?.toISOString()
            : placeholderBaselineValue.trim() || null,
        baselineSnapshot: foodEtaSnapshot,
        oracleBotPrediction: isFoodEta
          ? {
              label: `${foodEtaProvider} ETA · ${vendorEtaLabel ?? 'Pending'}`,
              predictedArrivalTime: vendorEtaDate?.toISOString(),
              creatorPredictedArrivalTime: predictedDate?.toISOString(),
              reason: 'Manual delivery ETA benchmark',
            }
          : null,
        scoringRule: {
          categoryKey: selectedCategory,
          placeholder: true,
          deliveryProvider: isFoodEta ? foodEtaProvider : undefined,
          vendorTimingMode: isFoodEta ? vendorTimingMode : undefined,
          creatorPredictionIso: isFoodEta ? predictedDate?.toISOString() : undefined,
        },
      });
      navigation.navigate('RoomCreated', { room: res.data });
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Could not create the room. Try again in a moment.');
      setCreateError(message);
      appAlert('Create failed', message);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleCreateOpenPredictionRoom() {
    setCreateError(null);
    const closeDate = new Date(predictionClosesAt);
    if (Number.isNaN(closeDate.getTime())) {
      const message = 'Use format YYYY-MM-DDTHH:MM.';
      setCreateError(message);
      return appAlert('Invalid date', message);
    }

    const title = openPredictionTitle.trim();
    const question = openPredictionQuestion.trim();
    if (!title) {
      const message = 'Add a room title first.';
      setCreateError(message);
      return appAlert('Title needed', message);
    }
    if (!question) {
      const message = 'Add the prediction question first.';
      setCreateError(message);
      return appAlert('Question needed', message);
    }

    const options = openPredictionOptions.map((option) => option.trim()).filter(Boolean);
    if (openPredictionAnswerType === 'multiple_choice' && options.length < 2) {
      const message = 'Add at least two prediction options.';
      setCreateError(message);
      return appAlert('Options needed', message);
    }

    const normalizedAnswerType =
      openPredictionAnswerType === 'yes_no' ? 'multiple_choice' : openPredictionAnswerType;
    const normalizedOptions =
      normalizedAnswerType === 'multiple_choice'
        ? openPredictionAnswerType === 'yes_no'
          ? ['yes', 'no']
          : options
        : undefined;
    setCreateLoading(true);
    try {
      const res = await api.post('/rooms', {
        roomTitle: title,
        eventType: question,
        question,
        category: 'open_prediction',
        roomType: 'social_prediction',
        answerType: normalizedAnswerType,
        mode: selectedMode,
        templateKey: 'open_prediction',
        roomCategory: 'custom',
        startingPointLabel: title,
        destinationLabel:
          normalizedAnswerType === 'multiple_choice'
            ? (normalizedOptions ?? []).join(' vs ')
            : 'Yes / No poll',
        predictionCloseTime: closeDate.toISOString(),
        visibility,
        baselineSource: 'manual',
        baselineLabel: 'Community prediction',
        baselineValue: normalizedAnswerType,
        options: normalizedOptions,
        scoringRule: {
          categoryKey: 'open_prediction',
          pollType: openPredictionAnswerType,
          genericTemplate,
          rewardMode: 'gems_rizz_no_aura',
        },
        outcomeSource: 'creator_attest',
        confidenceLevel: 'creator_attested',
      });
      navigation.navigate('RoomCreated', { room: res.data });
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Could not create the open prediction room. Try again in a moment.');
      setCreateError(message);
      appAlert('Create failed', message);
    } finally {
      setCreateLoading(false);
    }
  }

  // Honest stepper: only count the "Mode" step when more than one mode is actually
  // offered (in the MVP just "Play with Friends" is enabled, so it collapses to
  // Category → Setup on a single screen). Setup unlocks once the arrival route is
  // previewed, or immediately for the simpler category forms.
  const stepLabels = journeyOnlyFlow
    ? ['Route', 'Predict', 'Share']
    : shouldShowModeStep
      ? ['Category', 'Mode', 'Setup']
      : ['Category', 'Setup'];
  const setupUnlocked = selectedCategory === 'arrival_time' ? !!preview : true;
  const createStep = journeyOnlyFlow
    ? !readyForPreview
      ? 1
      : preview
        ? 2
        : 1
    : setupUnlocked
      ? stepLabels.length
      : shouldShowModeStep
        ? 2
        : 1;

  return (
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.container, isDesktop ? styles.containerDesktop : styles.containerMobile, { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]} keyboardShouldPersistTaps="handled">
      <LinearGradient colors={['rgba(76,29,149,0.82)', 'rgba(30,41,59,0.94)', 'rgba(29,78,216,0.58)']} style={styles.heroCard}>
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />
        {journeyOnlyFlow ? (
          <View style={styles.heroRouteArtRow}>
            <View style={styles.heroRouteDot} />
            <View style={styles.heroRouteDash} />
            <Text style={styles.heroRouteCar}>🚗</Text>
            <View style={[styles.heroRouteDash, styles.heroRouteDashShort]} />
            <Text style={styles.heroRoutePin}>📍</Text>
          </View>
        ) : null}
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{journeyOnlyFlow ? 'JOURNEY' : 'CREATE'}</Text>
          </View>
          <View style={[styles.heroBadge, styles.heroBadgeMuted]}>
            <Text style={styles.heroBadgeMutedText}>
              {journeyOnlyFlow ? 'Launch a route challenge' : 'Closest guess wins Aura'}
            </Text>
          </View>
        </View>
        <Text style={styles.heroHeadline}>
          {journeyOnlyFlow ? (
            <>
              Build your <Text style={styles.heroHeadlineAccent}>journey</Text>
            </>
          ) : (
            <>
              What do you want to <Text style={styles.heroHeadlineAccent}>predict?</Text>
            </>
          )}
        </Text>
        <Text style={styles.heroSubline}>
          {journeyOnlyFlow ? (
            <>
              Pick the route, choose how friends predict it, then share the link when you&apos;re ready.
            </>
          ) : (
            <>
              Pick a moment, invite friends, closest guess wins <Text style={styles.heroAura}>Aura.</Text>
            </>
          )}
        </Text>
        <StepProgress current={createStep} total={stepLabels.length} labels={stepLabels} />
      </LinearGradient>

      {journeyOnlyFlow ? (
        <View style={[styles.infoBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoBannerRow}>
            <View style={styles.infoBannerCopyBlock}>
              <Text style={[styles.infoBannerTitle, { color: colors.textPrimary }]}>Location hidden by default</Text>
              <Text style={[styles.infoBannerCopy, { color: colors.textSecondary }]}>
                Friends can follow delayed progress and the finish moment, but your live location stays private.
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Help')}>
              <Text style={[styles.infoBannerAction, { color: colors.purpleLight }]}>Learn more</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

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
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Your route</Text>
            <View style={styles.cardHeaderActions}>
              <TouchableOpacity
                onPress={useCurrentLocationForStart}
                disabled={locatingStart}
                style={[styles.currentLocationButton, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}
              >
                <Text style={[styles.linkAction, { color: colors.purpleLight }]}>
                  {locatingStart ? 'Locating…' : '⌖ Use current location'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.primaryJourneySetupStack}>
            <TextInputField
              label="Room title"
              value={titleOverride}
              onChangeText={setTitleOverride}
              placeholder={preview?.suggestedRoomTitle ?? 'Arrival room'}
              hint="Optional"
              maxLength={120}
            />
            <LockDateTimeField
              value={predictionClosesAt}
              onChange={(value) => {
                setCloseTimeEdited(true);
                setPredictionClosesAt(value);
              }}
              showTime={false}
            />
          </View>

          <View style={[styles.searchFields, isDesktop ? styles.routeFieldsDesktop : styles.routeFieldsMobile]}>
            <View style={styles.routeFieldColumn}>
              <RoutePlaceSearchInput
                label="Start"
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
            </View>

            <TouchableOpacity
              onPress={swapRoute}
              style={[styles.swapButton, isDesktop ? styles.swapButtonDesktop : styles.swapButtonMobile, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}
              accessibilityLabel="Swap start and destination"
            >
              <Text style={[styles.swapIcon, { color: colors.purpleLight }]}>⇅</Text>
            </TouchableOpacity>

            <View style={styles.routeFieldColumn}>
              <RoutePlaceSearchInput
                label="Destination"
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
          </View>

          <View style={styles.travelModeBlock}>
            <Text style={[styles.travelModeTitle, { color: colors.textPrimary }]}>How are you travelling?</Text>
            <TravelModeSelector value={travelMode} onChange={setTravelMode} />
          </View>

          {!preview ? (
            <View style={[styles.inlinePrivacyNotice, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}>
              <Text style={[styles.inlinePrivacyTitle, { color: colors.textPrimary }]}>Location hidden by default</Text>
              <Text style={[styles.inlinePrivacyCopy, { color: colors.textSecondary }]}>
                Friends only see delayed progress, not your live location.
              </Text>
            </View>
          ) : null}

          {preview ? (
            <View style={[styles.routeEstimateCard, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}>
              <View style={styles.routeSummaryHeader}>
                <View style={styles.routeSummaryHeaderCopy}>
                  <Text style={[styles.inlinePrivacyTitle, { color: colors.textPrimary }]}>Location hidden by default</Text>
                  <Text style={[styles.inlinePrivacyCopy, { color: colors.textSecondary }]}>
                    Friends only see delayed progress, not your live location.
                  </Text>
                </View>
              </View>
              <View style={styles.routeSummaryIdentity}>
                <Text style={[styles.routeSummaryRoute, { color: colors.textPrimary }]}>{shortenedRouteLabel}</Text>
                <Text style={[styles.routeSummaryMeta, { color: colors.textSecondary }]}>
                  Route locked in. Here&apos;s the estimate you&apos;re trying to beat.
                </Text>
              </View>
              <View style={styles.routeEstimateHeader}>
                <Text style={[styles.routeEstimateLabel, { color: colors.textSecondary }]}>Journey time</Text>
                <Text style={[styles.routeEstimateLabel, { color: colors.textSecondary }]}>Distance</Text>
                <Text style={[styles.routeEstimateLabel, { color: colors.textSecondary }]}>Mode</Text>
              </View>
              <View style={styles.routeEstimateMetrics}>
                <Text style={[styles.routeEstimateValue, { color: colors.textPrimary }]}>{preview.estimatedDurationLabel}</Text>
                <Text style={[styles.routeEstimateValue, { color: colors.textPrimary }]}>{preview.distanceLabel}</Text>
                <Text style={[styles.routeEstimateValue, { color: colors.textPrimary }]}>{preview.travelModeLabel}</Text>
              </View>
              {mapsEtaDate ? (
                <Text style={[styles.routeEstimateArrival, { color: colors.textPrimary }]}>
                  Estimated arrival: {formatClock(mapsEtaDate, false)}
                </Text>
              ) : null}
              {preview.isApproximate ? (
                <Text style={[styles.routeEstimateWarning, { color: colors.textMuted }]}>
                  Approximate estimate based on distance and travel mode
                </Text>
              ) : null}
            </View>
          ) : null}

          {!preview ? (
            <RouteMapPreview
              preview={mapPreview}
              loading={previewLoading}
              emptyLabel="Map preview"
              emptyCopy="Search and pick From and To to see places on the map."
            />
          ) : null}

          {previewError ? <Text style={[styles.errorText, { color: colors.red }]}>{previewError}</Text> : null}

          {preview ? (
            <View style={styles.previewBlock}>
              <View style={[styles.predictionSection, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}>
                <Text style={[styles.predictionSectionTitle, { color: colors.textPrimary }]}>Make your call</Text>
                <Text style={[styles.predictionSectionHelper, { color: colors.textSecondary }]}>
                  Closest to the real arrival wins.
                </Text>

                <View style={styles.benchmarkStack}>
                  {mapsEtaDate ? (
                    <View style={styles.benchmarkRow}>
                      <Text style={[styles.benchmarkLabel, { color: colors.textSecondary }]}>Maps estimate</Text>
                      <Text style={[styles.benchmarkValue, { color: colors.textPrimary }]}>{formatClock(mapsEtaDate, false)}</Text>
                    </View>
                  ) : null}
                  {botEtaDate ? (
                    <View style={styles.benchmarkRow}>
                      <Text style={[styles.benchmarkLabel, { color: colors.textSecondary }]}>Bot prediction</Text>
                      <Text style={[styles.benchmarkValue, { color: colors.textPrimary }]}>{formatClock(botEtaDate, false)}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={[styles.predictionInputLabel, { color: colors.textPrimary }]}>Host call</Text>
                {creatorPrediction ? (
                  <View style={styles.predictionInputBlock}>
                    <TimePickerSegments
                      value={creatorPrediction}
                      onChange={(next) => {
                        const anchor = mapsEtaDate ?? botEtaDate ?? next;
                        setCreatorPrediction(pickNearestDateForTimeSelection(next, anchor));
                        setPredictionAnchor('maps');
                      }}
                      showSeconds={false}
                      showAmPm
                    />
                  </View>
                ) : null}

                {predictionDateLabel ? (
                  <Text style={[styles.predictionDateLabel, { color: colors.textMuted }]}>
                    Date auto-set to {predictionDateLabel}
                  </Text>
                ) : null}

                <ScrollView
                  horizontal={!isDesktop}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.shortcutRow, !isDesktop && styles.shortcutRowMobile]}
                >
                  {buildJourneyPredictionAdjustments.map((shortcut) => {
                    const disabled = shortcut.key === 'bot' && !botEtaDate;
                    return (
                      <TouchableOpacity
                        key={shortcut.key}
                        disabled={disabled}
                        style={[
                          styles.shortcutChip,
                          {
                            borderColor: colors.border,
                            backgroundColor: disabled ? 'rgba(255,255,255,0.04)' : colors.surface,
                          },
                          disabled && styles.shortcutChipDisabled,
                        ]}
                        onPress={() => applyPredictionShortcut(shortcut)}
                      >
                        <Text style={[styles.shortcutChipText, { color: disabled ? colors.textMuted : colors.textPrimary }]}>
                          {shortcut.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {predictionComparison ? (
                  <Text style={[styles.predictionComparison, { color: colors.purpleLight }]}>
                    {predictionComparison}
                  </Text>
                ) : null}
              </View>

              {/* No advanced-options toggle here: the Journey form is short enough
                  that hiding four fields behind a link cost more than it saved. */}
              <View style={styles.advancedStack}>
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
                <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                  Viewers first see {getTravelStageFromProgress(20)} after the privacy delay.
                </Text>

                <TextInputField
                  label="Custom question"
                  value={questionOverride}
                  onChangeText={setQuestionOverride}
                  placeholder={preview.suggestedQuestion}
                  hint="Optional"
                  maxLength={160}
                />
              </View>

              {createError ? <Text style={[styles.errorText, { color: colors.red }]}>{createError}</Text> : null}
              {isDesktop ? (
                <View style={[styles.finalSummaryCard, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}>
                  <View style={styles.finalSummaryMeta}>
                    <Text style={[styles.finalSummaryRoute, { color: colors.textPrimary }]}>{shortenedRouteLabel}</Text>
                    <Text style={[styles.finalSummaryLine, { color: colors.textSecondary }]}>
                      Maps ETA: {mapsEtaDate ? formatClock(mapsEtaDate, false) : 'Pending'}
                    </Text>
                    <Text style={[styles.finalSummaryLine, { color: colors.textSecondary }]}>
                      Host call: {creatorPrediction ? `${formatPredictionDateLabel(creatorPrediction)} · ${formatClock(creatorPrediction, false)}` : 'Add your call'}
                    </Text>
                  </View>
                  <View style={styles.finalSummaryCta}>
                    <PrimaryButton
                      label="Create Journey"
                      onPress={handleCreateArrivalRoom}
                      loading={createLoading}
                      gradientColors={['#8B5CF6', '#3B82F6']}
                    />
                  </View>
                </View>
              ) : null}
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
          <PrimaryButton label="Start a Prediktion" onPress={handleCreateWeatherRoom} loading={createLoading} icon="🌧️" />
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
                ? 'Delivery label'
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
                ? 'Nike shoes'
                : 'Gym tomorrow'
            }
          />
          {selectedCategory === 'food_eta' ? (
            <View style={styles.advancedStack}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Delivery vendor</Text>
              <View style={styles.optionRow}>
                {genericDeliveryProviders.map((provider) => (
                  <TouchableOpacity
                    key={provider}
                    style={[
                      styles.chip,
                      {
                        borderColor: deliveryProviderPreset === provider ? colors.purple : colors.border,
                        backgroundColor: deliveryProviderPreset === provider ? colors.purpleDim : colors.surfaceHigh,
                      },
                    ]}
                    onPress={() => setDeliveryProviderPreset(provider)}
                  >
                    <Text style={[styles.chipText, { color: colors.textPrimary }]}>{provider}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {deliveryProviderPreset === 'Other' ? (
                <TextInputField
                  label="Custom vendor"
                  value={deliveryProviderOther}
                  onChangeText={setDeliveryProviderOther}
                  placeholder="Manual courier or seller"
                />
              ) : null}
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Vendor ETA & your prediction</Text>
              <Text style={[styles.lockTimeHint, { color: colors.textSecondary }]}>
                The vendor ETA is the bot benchmark everyone races. Your predicted
                arrival is your own guess — it locks with everyone else&apos;s.
              </Text>
              {providerTimingMode(
                deliveryProviderPreset === 'Other' ? deliveryProviderOther.trim() || 'Other' : deliveryProviderPreset,
              ) === 'time_only' ? (
                <TimeOnlyField
                  value={deliveryVendorEtaDateTime}
                  onChange={setDeliveryVendorEtaDateTime}
                  label="Vendor's stated ETA"
                  hint="Read this off your delivery app · HH:MM"
                />
              ) : (
                <View style={styles.advancedStack}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Vendor ETA format</Text>
                  <View style={styles.optionRow}>
                    {[
                      { key: 'date_only', label: 'Date only' },
                      { key: 'date_time', label: 'Date + time' },
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.chip,
                          {
                            borderColor:
                              (deliveryUseDateAndTime ? 'date_time' : 'date_only') === option.key ? colors.purple : colors.border,
                            backgroundColor:
                              (deliveryUseDateAndTime ? 'date_time' : 'date_only') === option.key
                                ? colors.purpleDim
                                : colors.surfaceHigh,
                          },
                        ]}
                        onPress={() => setDeliveryUseDateAndTime(option.key === 'date_time')}
                      >
                        <Text style={[styles.chipText, { color: colors.textPrimary }]}>{option.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <LockDateField value={deliveryVendorEtaDate} onChange={setDeliveryVendorEtaDate} />
                  {deliveryUseDateAndTime ? (
                    <LockDateTimeField
                      value={deliveryVendorEtaDateTime}
                      onChange={setDeliveryVendorEtaDateTime}
                      dateLabel="Vendor ETA date"
                      timeLabel="Vendor's stated ETA"
                      hint="Read this off your delivery app · HH MM"
                    />
                  ) : null}
                </View>
              )}
              <TimeOnlyField
                value={placeholderPredictionValue}
                onChange={setPlaceholderPredictionValue}
                label="Your predicted arrival"
                hint="Your own guess · locks with everyone else's · HH:MM"
              />
            </View>
          ) : (
            <TextInputField
              label="Target"
              value={placeholderLabel}
              onChangeText={setPlaceholderLabel}
              placeholder="Tomorrow AM"
            />
          )}

          <View style={[styles.generatedBox, { backgroundColor: colors.surfaceHigh }]}>
            <Text style={[styles.generatedQuestion, { color: colors.textSecondary }]}>Question</Text>
            <Text style={[styles.generatedTitle, { color: colors.textPrimary }]}>
              {placeholderQuestion.trim() || placeholderPreset.question}
            </Text>
            {selectedCategory === 'food_eta' ? (
              <Text style={[styles.generatedQuestion, { color: colors.textSecondary }]}>
                Add both the vendor ETA and your own predicted arrival. Everyone else predicts against the same countdown.
              </Text>
            ) : null}
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
                <View style={[styles.generatedBox, { backgroundColor: colors.surfaceHigh }]}>
                  <Text style={[styles.generatedQuestion, { color: colors.textSecondary }]}>Vendor logic</Text>
                  <Text style={[styles.generatedTitle, { color: colors.textPrimary }]}>
                    Zomato, Swiggy, Blinkit, Zepto, and Porter are time-based. Amazon, Flipkart-style couriers can be date-only or date + time.
                  </Text>
                </View>
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
          <PrimaryButton label="Start a Prediktion" onPress={handleCreatePlaceholderRoom} loading={createLoading} icon="✨" />
        </View>
      ) : null}

      {selectedCategory === 'open_prediction' || selectedCategory === 'sports_prediction' ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {selectedCategory === 'sports_prediction' ? 'Sports' : 'Custom Prediktion'}
          </Text>
          <Text style={[styles.generatedQuestion, { color: colors.textSecondary }]}>
            {genericTemplate === 'free_play'
              ? 'Open room — just name your moment and ask the question. Friends predict at will.'
              : 'Set up your room with custom options.'}
          </Text>
          <TextInputField
            label="Room title"
            value={openPredictionTitle}
            onChangeText={setOpenPredictionTitle}
            placeholder="Argentina vs Spain"
          />
          <TextInputField
            label="Question"
            value={openPredictionQuestion}
            onChangeText={setOpenPredictionQuestion}
            placeholder="Who will win?"
          />

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Room style</Text>
          <View style={styles.optionRow}>
            {[
              { key: 'free_play', label: 'Free Play' },
              { key: 'sports', label: 'Sports' },
            ].map((styleOption) => (
              <TouchableOpacity
                key={styleOption.key}
                style={[
                  styles.chip,
                  {
                    borderColor: genericTemplate === styleOption.key ? colors.purple : colors.border,
                    backgroundColor: genericTemplate === styleOption.key ? colors.purpleDim : colors.surfaceHigh,
                  },
                ]}
                onPress={() => applyGenericTemplate(styleOption.key as 'free_play' | 'sports')}
              >
                <Text style={[styles.chipText, { color: colors.textPrimary }]}>{styleOption.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Prediction format</Text>
          <View style={styles.predictionGrid}>
            {openPredictionAnswerModes.map((option) => (
              <PredictionOptionCard
                key={option.key}
                title={option.label}
                description={option.helper}
                answerType={option.key}
                example={option.key === 'yes_no' ? 'Yes / No' : 'Argentina / Spain'}
                icon={option.key === 'yes_no' ? '✅' : '🏁'}
                selected={openPredictionAnswerType === option.key}
                onPress={() => setOpenPredictionAnswerType(option.key)}
              />
            ))}
          </View>

          {openPredictionAnswerType === 'multiple_choice' ? (
            <View style={styles.advancedStack}>
              {openPredictionOptions.map((option, index) => (
                <View key={`open-option-${index}`} style={styles.optionInputRow}>
                  <View style={styles.optionInputField}>
                    <TextInputField
                      label={`Option ${index + 1}${index > 1 ? ' (optional)' : ''}`}
                      value={option}
                      onChangeText={(value) => updateOpenPredictionOption(index, value)}
                      placeholder={`Option ${index + 1}`}
                    />
                  </View>
                  {openPredictionOptions.length > 2 ? (
                    <TouchableOpacity
                      onPress={() => removeOpenPredictionOption(index)}
                      style={[styles.optionRemoveButton, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}
                    >
                      <Text style={[styles.optionRemoveButtonText, { color: colors.textSecondary }]}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              <TouchableOpacity
                onPress={addOpenPredictionOption}
                style={[styles.addOptionButton, { borderColor: colors.purple, backgroundColor: colors.purpleDim }]}
              >
                <Text style={[styles.addOptionButtonText, { color: colors.purpleLight }]}>+ Add another option</Text>
              </TouchableOpacity>
            </View>
          ) : null}

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
              <View style={[styles.generatedBox, { backgroundColor: colors.surfaceHigh }]}>
                <Text style={[styles.generatedQuestion, { color: colors.textSecondary }]}>Result policy</Text>
                <Text style={[styles.generatedTitle, { color: colors.textPrimary }]}>
                  Host-confirmed only. No screenshot upload in MVP.
                </Text>
                <Text style={[styles.generatedQuestion, { color: colors.textSecondary }]}>
                  Any predictor can challenge later and send proof through a WhatsApp link.
                </Text>
              </View>
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
            </View>
          ) : null}

          {createError ? <Text style={[styles.errorText, { color: colors.red }]}>{createError}</Text> : null}
          <PrimaryButton
            label="Create Custom Prediktion"
            onPress={handleCreateOpenPredictionRoom}
            loading={createLoading}
            icon="🏆"
          />
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
    {!isDesktop && selectedCategory === 'arrival_time' && preview ? (
      <View style={[styles.mobileStickyFooter, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.mobileStickyMeta}>
          <Text style={[styles.finalSummaryRoute, { color: colors.textPrimary }]}>{shortenedRouteLabel}</Text>
          <Text style={[styles.finalSummaryLine, { color: colors.textSecondary }]}>
            Maps ETA: {mapsEtaDate ? formatClock(mapsEtaDate, false) : 'Pending'}
          </Text>
          <Text style={[styles.finalSummaryLine, { color: colors.textSecondary }]}>
            Host call: {creatorPrediction ? `${formatPredictionDateLabel(creatorPrediction)} · ${formatClock(creatorPrediction, false)}` : 'Add your call'}
          </Text>
        </View>
        <PrimaryButton
          label="Create Journey"
          onPress={handleCreateArrivalRoom}
          loading={createLoading}
          gradientColors={['#8B5CF6', '#3B82F6']}
        />
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  container: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, gap: 18, paddingBottom: 40 },
  containerDesktop: { paddingBottom: 48 },
  containerMobile: { paddingBottom: 172 },
  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.34)',
    backgroundColor: 'rgba(9,12,25,0.98)',
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 12,
    overflow: 'hidden',
  },
  heroOrbLarge: {
    position: 'absolute',
    right: -26,
    top: -24,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(59,130,246,0.22)',
  },
  heroOrbSmall: {
    position: 'absolute',
    right: 54,
    top: 34,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(236,72,153,0.16)',
  },
  heroRouteArtRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 2 },
  heroRouteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  heroRouteDash: {
    width: 72,
    borderStyle: 'dashed',
    borderTopWidth: 2.5,
    borderColor: 'rgba(168,85,247,0.75)',
  },
  heroRouteDashShort: { width: 52, borderColor: 'rgba(59,130,246,0.75)' },
  heroRouteCar: { fontSize: 20 },
  heroRoutePin: { fontSize: 24 },
  heroBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.42)',
    backgroundColor: 'rgba(124,58,237,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeMuted: {
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroBadgeText: { color: '#F5D0FE', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  heroBadgeMutedText: { color: 'rgba(255,255,255,0.78)', fontSize: 10, fontWeight: '800' },
  hero: { gap: 4, marginTop: 4 },
  heading: { fontSize: 26, fontWeight: '900' },
  sub: { fontSize: 14, lineHeight: 20 },
  infoBanner: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  infoBannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  infoBannerCopyBlock: { flex: 1, gap: 4 },
  infoBannerTitle: { fontSize: 14, fontWeight: '900' },
  infoBannerCopy: { fontSize: 13, lineHeight: 18 },
  infoBannerAction: { fontSize: 13, fontWeight: '900' },
  heroHeadline: { color: '#FFFFFF', fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.4 },
  heroHeadlineAccent: { color: '#93C5FD' },
  heroSubline: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18, marginBottom: 2 },
  heroAura: { color: '#A5F3FC', fontWeight: '900' },
  cardHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  primaryJourneySetupStack: { gap: 10 },
  currentLocationButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  swapButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapButtonDesktop: { alignSelf: 'flex-start', marginTop: 32 },
  swapButtonMobile: { alignSelf: 'center' },
  swapIcon: { fontSize: 16, fontWeight: '900' },
  section: { gap: 10 },
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
  card: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    gap: 14,
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  routeCard: { overflow: 'visible' },
  searchFields: { gap: 8, overflow: 'visible', zIndex: 20, alignItems: 'stretch' },
  routeFieldsDesktop: { flexDirection: 'row' },
  routeFieldsMobile: { flexDirection: 'column' },
  routeFieldColumn: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '900' },
  linkAction: { fontSize: 13, fontWeight: '800' },
  travelModeBlock: { gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  travelModeTitle: { fontSize: 15, fontWeight: '900' },
  previewBlock: { gap: 10, marginTop: 4 },
  predictionSection: { gap: 12, marginTop: 6, borderRadius: 22, borderWidth: 1, padding: 18 },
  predictionSectionTitle: { fontSize: 18, fontWeight: '900' },
  predictionSectionHelper: { fontSize: 13, lineHeight: 18 },
  benchmarkStack: { gap: 8 },
  benchmarkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  benchmarkLabel: { fontSize: 13, fontWeight: '700' },
  benchmarkValue: { fontSize: 15, fontWeight: '800' },
  predictionInputLabel: { fontSize: 13, fontWeight: '800' },
  predictionInputBlock: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.24)',
    backgroundColor: 'rgba(17,24,39,0.72)',
    padding: 12,
  },
  predictionDateLabel: { fontSize: 12, lineHeight: 16, marginTop: -2 },
  shortcutRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcutRowMobile: { paddingRight: 12 },
  shortcutChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  shortcutChipDisabled: { opacity: 0.5 },
  shortcutChipText: { fontSize: 12, fontWeight: '800' },
  predictionComparison: { fontSize: 13, fontWeight: '700' },
  generatedTitle: { fontSize: 15, fontWeight: '900', lineHeight: 21 },
  generatedQuestion: { fontSize: 13, lineHeight: 18 },
  privacyNote: { fontSize: 12, fontWeight: '700' },
  inlinePrivacyNotice: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  inlinePrivacyTitle: { fontSize: 12, fontWeight: '800' },
  inlinePrivacyCopy: { fontSize: 12, lineHeight: 16 },
  routeEstimateCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  routeSummaryHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  routeSummaryHeaderCopy: { gap: 3 },
  routeSummaryIdentity: { gap: 4 },
  routeSummaryRoute: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  routeSummaryMeta: { fontSize: 13, lineHeight: 18 },
  routeEstimateHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  routeEstimateLabel: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeEstimateMetrics: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  routeEstimateValue: { flex: 1, fontSize: 18, fontWeight: '900' },
  routeEstimateArrival: { fontSize: 14, fontWeight: '800' },
  routeEstimateWarning: { fontSize: 12, lineHeight: 17 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionInputRow: { gap: 10 },
  optionInputField: { flex: 1 },
  optionRemoveButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionRemoveButtonText: { fontSize: 12, fontWeight: '800' },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
  predictionGrid: { gap: 10 },
  generatedBox: { borderRadius: 16, padding: 14, gap: 5 },
  addOptionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addOptionButtonText: { fontSize: 13, fontWeight: '800' },
  advancedToggle: { fontSize: 13, fontWeight: '800', paddingVertical: 4 },
  advancedStack: { gap: 10 },
  fieldHint: { fontSize: 12, lineHeight: 17 },
  finalSummaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    marginTop: 4,
  },
  finalSummaryMeta: { gap: 4 },
  finalSummaryRoute: { fontSize: 15, fontWeight: '900' },
  finalSummaryLine: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  finalSummaryCta: { width: '100%' },
  mobileStickyFooter: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
  },
  mobileStickyMeta: { gap: 2 },
  lockFieldWrap: { gap: 8 },
  lockTimeBlock: {
    borderRadius: 18,
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
