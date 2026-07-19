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
    label: 'Custom Prediktion',
    icon: '🏆',
    primaryColor: '#f59e0b',
    secondaryColor: '#ef4444',
    gradient: ['#f59e0b', '#ef4444'],
    badgeStyle: { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.45)', text: '#fde68a' },
    emptyStateCopy: 'Open a free-play room with your own question and prediction options.',
    resultTitle: 'Custom Prediktion reveal',
    quickStartLabel: 'Custom Prediktion',
  },
};

export const CATEGORY_LIST = Object.values(CATEGORY_THEMES);

export function getCategoryTheme(key?: string | null): CategoryTheme {
  if (key && key in CATEGORY_THEMES) {
    return CATEGORY_THEMES[key as CategoryKey];
  }
  return CATEGORY_THEMES.arrival_time;
}
