/**
 * Centralised mobile feature flags.
 *
 * Prime directive: nothing is deleted. Non-MVP screens stay registered in the
 * navigator and their code stays intact; these flags hide their entry points and
 * gate the category/mode pickers so the MVP surface is small and reversible.
 *
 * MVP scope (Play with Friends): categories `arrival_time` + `food_eta`, guest join,
 * rematch. Everything else is hidden.
 *
 * Override at build time with an `EXPO_PUBLIC_FEATURE_<NAME>` env var
 * (e.g. `EXPO_PUBLIC_FEATURE_LEADERBOARD=true`). Unset keeps the default below.
 */

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[`EXPO_PUBLIC_FEATURE_${name}`];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

/** Category keys shown in the create-room picker for the MVP. */
export const MVP_CATEGORY_KEYS = ['arrival_time', 'food_eta'] as const;
export type MvpCategoryKey = (typeof MVP_CATEGORY_KEYS)[number];

export const featureFlags = {
  // --- MVP loop (enabled) ---
  guestJoin: envFlag('GUEST_JOIN', true),
  rematch: envFlag('REMATCH', true),

  // --- Arrival checkpoint leaderboard v2 (mirror of the backend flag) ---
  // Enables the time-based 20/40/60/80/90/100 checkpoint timers, per-viewer blur
  // UI, Rizz-tier tags, and re-predict windows. OFF keeps the 50/80 client path.
  checkpointLeaderboardV2: envFlag('CHECKPOINT_LEADERBOARD_V2', false),

  // --- Categories ---
  categoryArrivalTime: envFlag('CATEGORY_ARRIVAL_TIME', true),
  categoryFoodEta: envFlag('CATEGORY_FOOD_ETA', true),
  categoryWeather: envFlag('CATEGORY_WEATHER', false),
  categoryWhosLate: envFlag('CATEGORY_WHOS_LATE', false),
  categoryGymHabit: envFlag('CATEGORY_GYM_HABIT', false),

  // --- Modes ---
  modeBeatTheBot: envFlag('MODE_BEAT_THE_BOT', false),
  modeChallengeYourself: envFlag('MODE_CHALLENGE_YOURSELF', false),

  // --- Non-MVP surfaces (hidden in nav / UI) ---
  rivalries: envFlag('RIVALRIES', false),
  missions: envFlag('MISSIONS', false),
  groupIdentity: envFlag('GROUP_IDENTITY', false),
  weeklyStory: envFlag('WEEKLY_STORY', false),
  leaderboard: envFlag('LEADERBOARD', false),
  notifications: envFlag('NOTIFICATIONS', false),
  personalityUnlock: envFlag('PERSONALITY_UNLOCK', false),
  momentCardExport: envFlag('MOMENT_CARD_EXPORT', false),

  // --- Admin portal (private beta operations) ---
  adminPortalEnabled: envFlag('ADMIN_PORTAL_ENABLED', false),
  adminAnalyticsEnabled: envFlag('ADMIN_ANALYTICS_ENABLED', true),
  adminFeedbackQueueEnabled: envFlag('ADMIN_FEEDBACK_QUEUE_ENABLED', true),
  adminModerationEnabled: envFlag('ADMIN_MODERATION_ENABLED', true),
  adminSystemHealthEnabled: envFlag('ADMIN_SYSTEM_HEALTH_ENABLED', true),
} as const;

export type FeatureFlags = typeof featureFlags;

/** True when a category key should appear in the MVP create-room picker. */
export function isCategoryEnabled(categoryKey: string | null | undefined): boolean {
  switch (categoryKey) {
    case 'arrival_time':
      return featureFlags.categoryArrivalTime;
    case 'food_eta':
      return featureFlags.categoryFoodEta;
    case 'weather_rain':
      return featureFlags.categoryWeather;
    case 'whos_late':
      return featureFlags.categoryWhosLate;
    case 'gym_habit':
      return featureFlags.categoryGymHabit;
    default:
      return false;
  }
}
