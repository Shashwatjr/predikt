/**
 * Centralised backend feature flags.
 *
 * Prime directive: nothing is deleted. Non-MVP surfaces stay in the codebase and
 * remain reachable in principle; these flags disable them at the edges (guards,
 * allowlists, short-circuits) so they are reversible by flipping a single value.
 *
 * MVP scope (Play with Friends): categories `arrival_time` + `food_eta`, guest join,
 * rematch. Everything else is disabled here and hidden in the mobile app.
 *
 * A flag may be overridden at runtime with an env var of the same SCREAMING_SNAKE
 * name prefixed with `FEATURE_` (e.g. `FEATURE_REMATCH=false`). Unset env vars keep
 * the default below.
 */

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[`FEATURE_${name}`];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

/** Room categories that may be created/played in the MVP. */
export const MVP_CATEGORIES = ['arrival_time', 'food_eta'] as const;
export type MvpCategory = (typeof MVP_CATEGORIES)[number];

/** Social modes allowed in the MVP. */
export const MVP_MODES = ['friends'] as const;

export const featureFlags = {
  // --- MVP loop (enabled) ---
  guestJoin: envFlag('GUEST_JOIN', true),
  rematch: envFlag('REMATCH', true),

  // --- Arrival checkpoint leaderboard v2 (disabled = keep the 0/50/80/100 path) ---
  // Gates the time-based 20/40/60/80/90/100 checkpoint cadence, per-viewer blur,
  // Rizz-tier late predictions, and the reworked start/lock/scoring rules. When
  // OFF, the original client-progress checkpoint flow runs unchanged.
  checkpointLeaderboardV2: envFlag('CHECKPOINT_LEADERBOARD_V2', false),

  // --- Categories (disabled = not creatable/playable) ---
  categoryArrivalTime: envFlag('CATEGORY_ARRIVAL_TIME', true),
  categoryFoodEta: envFlag('CATEGORY_FOOD_ETA', true),
  categoryWeather: envFlag('CATEGORY_WEATHER', false),
  categoryWhosLate: envFlag('CATEGORY_WHOS_LATE', false),
  categoryGymHabit: envFlag('CATEGORY_GYM_HABIT', false),

  // --- Modes (disabled) ---
  modeBeatTheBot: envFlag('MODE_BEAT_THE_BOT', false),
  modeChallengeYourself: envFlag('MODE_CHALLENGE_YOURSELF', false),

  // --- Non-MVP surfaces (disabled) ---
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

/** True when a room category is allowed to be created/played in the MVP. */
export function isCategoryEnabled(category: string | null | undefined): boolean {
  switch (category) {
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
      // Legacy/internal categories (journey, delivery, custom, brand_room, …) are
      // not part of the MVP category picker but remain valid for existing rooms.
      return true;
  }
}
