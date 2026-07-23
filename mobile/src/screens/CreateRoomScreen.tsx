import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import RoutePreviewCard from '../components/RoutePreviewCard';
import RouteMapPreview from '../components/RouteMapPreview';
import StepProgress from '../components/StepProgress';
import CategoryTile from '../components/CategoryTile';
import CategoryVotePrompt from '../components/CategoryVotePrompt';
import ModeCard from '../components/ModeCard';
import PrivacyModeSelector from '../components/PrivacyModeSelector';
import {
  getCategoryTheme,
  CATEGORY_LIST,
  CategoryTheme,
  getOpenPredictionSubtypeConfig,
  OpenPredictionSubtype,
} from '../config/categoryTheme';
import { featureFlags, isCategoryEnabled } from '../config/featureFlags';
import { voteCategoryInterest } from '../utils/categoryInterest';
import { layout, palette } from '../theme/designSystem';

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
        placeholder="2026-07-19"
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
const visibilities = ['invite_only', 'private', 'public'] as const;
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
    icon: '🎯',
    label: 'Custom Challenge',
    helper: 'Create your own question and let friends choose from the answers you define.',
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
  { key: 'custom_challenge', label: 'Custom Challenge', title: 'Tonight’s big call', question: 'What do you think happens?' },
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
  // Single source of truth — the Sports theme lives in categoryTheme.ts.
  const sportsCategoryTheme: CategoryTheme = getOpenPredictionSubtypeConfig('sports').theme;

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
    useState<(typeof genericRoomTemplates)[number]['key']>('custom_challenge');
  const [genericDeliveryProvider, setGenericDeliveryProvider] =
    useState<(typeof genericDeliveryProviders)[number] | ''>('Zomato');
  const [genericDeliveryProviderOther, setGenericDeliveryProviderOther] = useState('');

  // The room-type toggle (Custom Challenge / Sports) drives the subtype; it also
  // feeds the subtype-specific placeholders, labels and copy from the single
  // source of truth in categoryTheme.ts.
  const openPredictionSubtype: OpenPredictionSubtype =
    genericTemplate === 'sports' ? 'sports' : 'custom_challenge';
  const openPredictionConfig = getOpenPredictionSubtypeConfig(openPredictionSubtype);

  function applySportsPreset() {
    setSelectedCategory('sports_prediction');
    setOpenPredictionTitle('Argentina vs Spain');
    setOpenPredictionQuestion('Who will win?');
    setOpenPredictionOptions(['Argentina', 'Spain', 'Draw']);
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
      setGenericTemplate('custom_challenge');
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
      setOpenPredictionTitle('Argentina vs Spain');
      setOpenPredictionQuestion('Who will win?');
      setOpenPredictionOptions(['Argentina', 'Spain', 'Draw']);
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
      navigation.navigate('Prediction', {
        roomId: res.data.roomId,
        room: res.data,
        startJourneyAfterSubmit: true,
        startDelayMinutes,
        navigateToRoomCreatedAfterSubmit: true,
      });
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
        ? `Delivery ETA Prediktion: ${placeholderTitle.trim()}`
        : placeholderPreset.title;
    }
    if (selectedCategory === 'gym_habit') {
      return placeholderLabel.trim()
        ? `${placeholderLabel.trim()} Prediktion`
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
      return Alert.alert('ETA needed', message);
    }
    if (isFoodEta && !predictedDate) {
      const message = 'Add your own predicted delivery time too.';
      setCreateError(message);
      return Alert.alert('Prediction needed', message);
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
      Alert.alert('Create failed', message);
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
      return Alert.alert('Invalid date', message);
    }

    const title = openPredictionTitle.trim();
    const question = openPredictionQuestion.trim();
    if (!title) {
      const message = 'Add a room title first.';
      setCreateError(message);
      return Alert.alert('Title needed', message);
    }
    if (!question) {
      const message = 'Add the prediction question first.';
      setCreateError(message);
      return Alert.alert('Question needed', message);
    }

    const options = openPredictionOptions.map((option) => option.trim()).filter(Boolean);
    if (openPredictionAnswerType === 'multiple_choice' && options.length < 2) {
      const message = 'Add at least two prediction options.';
      setCreateError(message);
      return Alert.alert('Options needed', message);
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
          // Reliable subtype persisted in the round-tripped scoringRule JSON.
          subtype: openPredictionSubtype,
          rewardMode: 'gems_rizz_no_aura',
        },
        outcomeSource: 'creator_attest',
        confidenceLevel: 'creator_attested',
      });
      navigation.navigate('RoomCreated', { room: res.data });
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Could not create the open prediction room. Try again in a moment.');
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
          What do you want to <Text style={styles.heroHeadlineAccent}>Predikt?</Text>
        </Text>
        <Text style={styles.heroSubline}>
          Pick a moment, invite friends, closest guess wins <Text style={styles.heroAura}>Aura.</Text>
        </Text>
        <StepProgress current={createStep} total={stepLabels.length} labels={stepLabels} />
      </LinearGradient>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Privacy</Text>
        <PrivacyModeSelector
          value={visibility}
          onChange={setVisibility}
          onLearnMore={() =>
            Alert.alert(
              'Ghost Mode',
              'Your exact GPS and raw movement stay private. Friends only see privacy-safe progress and your final result — never your live location.',
            )
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Category</Text>
        <View style={styles.categoryGrid}>
          {[
            sportsCategoryTheme,
            ...categoryTiles
              .map((tile) => {
                if (tile.key === 'sports_prediction') {
                  return null;
                }
                return getCategoryTheme(tile.key);
              })
              .filter((theme): theme is CategoryTheme => theme != null && isCategoryEnabled(theme.key)),
          ].map((theme) => {
            if (theme === sportsCategoryTheme) {
              return (
                <CategoryTile
                  key="sports-preset"
                  theme={theme}
                  badge="POPULAR"
                  locked={false}
                  selected={selectedCategory === 'sports_prediction'}
                  onPress={() => onCategorySelect('sports_prediction')}
                />
              );
            }
            return (
              <CategoryTile
                key={theme.key}
                theme={theme}
                badge={theme.key === 'arrival_time' ? 'POPULAR' : undefined}
                locked={false}
                selected={selectedCategory === theme.key}
                onPress={() => onCategorySelect(theme.key as (typeof categoryTiles)[number]['key'])}
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
              <PrimaryButton label="Create Prediktion" onPress={handleCreateArrivalRoom} loading={createLoading} icon="🎯" />
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
          <PrimaryButton label="Create Prediktion" onPress={handleCreateWeatherRoom} loading={createLoading} icon="🌧️" />
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
              {providerTimingMode(
                deliveryProviderPreset === 'Other' ? deliveryProviderOther.trim() || 'Other' : deliveryProviderPreset,
              ) === 'time_only' ? (
                <LockDateTimeField
                  value={deliveryVendorEtaDateTime}
                  onChange={setDeliveryVendorEtaDateTime}
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
                    />
                  ) : null}
                </View>
              )}
              <LockDateTimeField
                value={placeholderPredictionValue}
                onChange={setPlaceholderPredictionValue}
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
          <PrimaryButton label="Create Prediktion" onPress={handleCreatePlaceholderRoom} loading={createLoading} icon="✨" />
        </View>
      ) : null}

      {selectedCategory === 'open_prediction' || selectedCategory === 'sports_prediction' ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {openPredictionConfig.theme.label}
          </Text>
          <Text style={[styles.generatedQuestion, { color: colors.textSecondary }]}>
            {openPredictionSubtype === 'sports'
              ? 'Set up the matchup and let friends call the result.'
              : 'Create your own question and let friends choose from the answers you define.'}
          </Text>
          <TextInputField
            label="Room title"
            value={openPredictionTitle}
            onChangeText={setOpenPredictionTitle}
            placeholder={openPredictionConfig.titlePlaceholder}
          />
          <TextInputField
            label="Question"
            value={openPredictionQuestion}
            onChangeText={setOpenPredictionQuestion}
            placeholder={openPredictionConfig.questionPlaceholder}
          />

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Room type</Text>
          <View style={styles.optionRow}>
            {[
              { key: 'custom_challenge', label: 'Custom Challenge' },
              { key: 'sports', label: 'Sports' },
            ].map((styleOption) => (
              <TouchableOpacity
                key={styleOption.key}
                style={[
                  styles.chip,
                  {
                    borderColor: openPredictionSubtype === styleOption.key ? colors.purple : colors.border,
                    backgroundColor: openPredictionSubtype === styleOption.key ? colors.purpleDim : colors.surfaceHigh,
                  },
                ]}
                onPress={() => applyGenericTemplate(styleOption.key as 'custom_challenge' | 'sports')}
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
                      placeholder={index === 0 ? 'Argentina' : index === 1 ? 'Spain' : `Option ${index + 1}`}
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
                  Creator-attest only. No screenshot upload in MVP.
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
            label={`Create ${openPredictionConfig.theme.label}`}
            onPress={handleCreateOpenPredictionRoom}
            loading={createLoading}
            icon={openPredictionConfig.theme.icon}
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
  generatedBox: { borderRadius: 12, padding: 12, gap: 4 },
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
