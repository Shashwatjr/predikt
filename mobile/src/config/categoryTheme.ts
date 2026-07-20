export type CategoryKey =
  | 'arrival_time'
  | 'weather_rain'
  | 'food_eta'
  | 'whos_late'
  | 'gym_habit'
  | 'open_prediction';

export type CategoryTheme = {
  key: CategoryKey;
  label: string;
  icon: string;
  primaryColor: string;
  secondaryColor: string;
  gradient: [string, string];
  badgeStyle: { bg: string; border: string; text: string };
  emptyStateCopy: string;
  resultTitle: string;
  quickStartLabel: string;
};

export const CATEGORY_THEMES: Record<CategoryKey, CategoryTheme> = {
  arrival_time: {
    key: 'arrival_time',
    label: 'Travel ETA',
    icon: '🚗',
    primaryColor: '#22d3ee',
    secondaryColor: '#22c55e',
    gradient: ['#0ea5e9', '#22c55e'],
    badgeStyle: { bg: 'rgba(34,211,238,0.18)', border: 'rgba(34,211,238,0.45)', text: '#67e8f9' },
    emptyStateCopy: 'Start an arrival challenge and see who reads the traffic best.',
    resultTitle: 'Route Oracle moment',
    quickStartLabel: 'Travel ETA',
  },
  weather_rain: {
    key: 'weather_rain',
    label: 'Weather / Rain',
    icon: '🌧️',
    primaryColor: '#818cf8',
    secondaryColor: '#6366f1',
    gradient: ['#6366f1', '#4338ca'],
    badgeStyle: { bg: 'rgba(99,102,241,0.2)', border: 'rgba(129,140,248,0.45)', text: '#c7d2fe' },
    emptyStateCopy: 'Beat the forecast with your group.',
    resultTitle: 'Rain Oracle moment',
    quickStartLabel: 'Beat the Forecast',
  },
  food_eta: {
    key: 'food_eta',
    label: 'Delivery ETA',
    icon: '📦',
    primaryColor: '#fb923c',
    secondaryColor: '#f97316',
    gradient: ['#fb923c', '#ea580c'],
    badgeStyle: { bg: 'rgba(251,146,60,0.2)', border: 'rgba(251,146,60,0.45)', text: '#fed7aa' },
    emptyStateCopy: 'Turn delivery suspense into a playful ETA faceoff.',
    resultTitle: 'Beat the ETA moment',
    quickStartLabel: 'Delivery ETA',
  },
  whos_late: {
    key: 'whos_late',
    label: "Who's Late",
    icon: '⏰',
    primaryColor: '#f472b6',
    secondaryColor: '#fbbf24',
    gradient: ['#f472b6', '#fbbf24'],
    badgeStyle: { bg: 'rgba(244,114,182,0.2)', border: 'rgba(244,114,182,0.45)', text: '#fbcfe8' },
    emptyStateCopy: 'Call the late arrival without making it awkward.',
    resultTitle: 'Time Oracle moment',
    quickStartLabel: "Who's Late Today?",
  },
  gym_habit: {
    key: 'gym_habit',
    label: 'Gym / Habit',
    icon: '💪',
    primaryColor: '#84cc16',
    secondaryColor: '#22c55e',
    gradient: ['#84cc16', '#16a34a'],
    badgeStyle: { bg: 'rgba(132,204,22,0.2)', border: 'rgba(132,204,22,0.45)', text: '#d9f99d' },
    emptyStateCopy: 'Light accountability for habits — playful, not pressure.',
    resultTitle: 'Pattern Breaker moment',
    quickStartLabel: 'Habit Tracker',
  },
  open_prediction: {
    key: 'open_prediction',
    label: 'Custom Challenge',
    icon: '🎯',
    primaryColor: '#f59e0b',
    secondaryColor: '#ef4444',
    gradient: ['#f59e0b', '#ef4444'],
    badgeStyle: { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.45)', text: '#fde68a' },
    emptyStateCopy: 'Create your own question and let friends choose from the answers you define.',
    resultTitle: 'Custom Challenge reveal',
    quickStartLabel: 'Custom Challenge',
  },
};

export const CATEGORY_LIST = Object.values(CATEGORY_THEMES);

// ---------------------------------------------------------------------------
// Open-prediction subtypes — the single source of truth.
//
// `open_prediction` rooms come in two flavours: `custom_challenge` (creator
// defines the question + answers) and `sports`. Both share the open_prediction
// category and machinery, but differ in label, icon, Create-form placeholders,
// and Live / The Tea copy. Every surface must resolve presentation from here
// (via getRoomTheme / getOpenPredictionSubtypeConfig) rather than inlining a
// Sports theme locally — Sports must never render as "Custom Prediktion" 🏆.
// ---------------------------------------------------------------------------

export type OpenPredictionSubtype = 'custom_challenge' | 'sports';

export type OpenPredictionSubtypeConfig = {
  subtype: OpenPredictionSubtype;
  theme: CategoryTheme;
  /** Create-form placeholders. */
  titlePlaceholder: string;
  questionPlaceholder: string;
  /** Live-room banner copy (travel-free). */
  liveCopy: string;
  /** "The Tea" dashboard card copy (travel-free). */
  teaHeadline: string;
  teaBody: string;
};

const SPORTS_THEME: CategoryTheme = {
  key: 'open_prediction',
  label: 'Sports',
  icon: '⚽',
  primaryColor: '#22c55e',
  secondaryColor: '#0ea5e9',
  gradient: ['#16a34a', '#0ea5e9'],
  badgeStyle: { bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.45)', text: '#bbf7d0' },
  emptyStateCopy: 'Set up the matchup and let friends call the result.',
  resultTitle: 'Sports reveal',
  quickStartLabel: 'Sports',
};

export const OPEN_PREDICTION_SUBTYPES: Record<OpenPredictionSubtype, OpenPredictionSubtypeConfig> = {
  custom_challenge: {
    subtype: 'custom_challenge',
    theme: CATEGORY_THEMES.open_prediction,
    titlePlaceholder: "Tonight's big call",
    questionPlaceholder: 'What do you think happens?',
    liveCopy: 'The guesses are locked in. Time to reveal what actually happens.',
    teaHeadline: 'The calls are in.',
    teaBody: 'Now we find out what actually happens.',
  },
  sports: {
    subtype: 'sports',
    theme: SPORTS_THEME,
    titlePlaceholder: 'Argentina vs Spain',
    questionPlaceholder: 'Who will win?',
    liveCopy: 'Everyone has picked a side. Now the game decides who called it.',
    teaHeadline: 'The match is on.',
    teaBody: 'Everyone picked a side — now the game decides who called it.',
  },
};

/** Coerce any stored subtype/legacy template value into a known subtype. */
export function normalizeOpenPredictionSubtype(raw?: string | null): OpenPredictionSubtype {
  if (raw === 'sports') return 'sports';
  return 'custom_challenge';
}

/** Resolve the subtype of a room object (server `subtype`, then legacy fallbacks). */
export function resolveRoomSubtype(room: any): OpenPredictionSubtype | null {
  const category = room?.category ?? room?.templateKey ?? null;
  if (category !== 'open_prediction') return null;
  const raw =
    room?.subtype ??
    room?.scoringRule?.subtype ??
    room?.scoringRule?.genericTemplate ??
    null;
  return normalizeOpenPredictionSubtype(raw);
}

export function getOpenPredictionSubtypeConfig(
  subtype?: string | null,
): OpenPredictionSubtypeConfig {
  return OPEN_PREDICTION_SUBTYPES[normalizeOpenPredictionSubtype(subtype)];
}

export function getCategoryTheme(key?: string | null): CategoryTheme {
  if (key && key in CATEGORY_THEMES) {
    return CATEGORY_THEMES[key as CategoryKey];
  }
  return CATEGORY_THEMES.arrival_time;
}

/**
 * Subtype-aware theme resolver — the entry point screens should use for a room.
 * Open-prediction rooms resolve to their subtype theme (Custom Challenge vs
 * Sports); everything else falls back to its category theme.
 */
export function getRoomTheme(room: any): CategoryTheme {
  const subtype = resolveRoomSubtype(room);
  if (subtype) return OPEN_PREDICTION_SUBTYPES[subtype].theme;
  return getCategoryTheme(room?.category ?? room?.templateKey);
}
