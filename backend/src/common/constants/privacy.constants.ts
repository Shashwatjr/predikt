export const DEFAULT_LOCATION_PRIVACY_MODE = 'approximate_delayed';

export const LOCATION_SAFETY_DELAY_MINUTES = {
  private: 5,
  invite_only: 10,
  public: 15,
  sponsored: 15,
  publicTravel: 30,
} as const;

export const ROUTE_PARTICIPANT_SAFETY_MESSAGE =
  'Location shown with delay for safety.';

export const SAFE_AVATAR_KEYS = [
  'dot_hunter',
  'route_oracle',
  'delivery_whisperer',
  'gym_prophet',
  'chaos_caller',
  'comeback_artist',
  'crowd_puller',
  'time_sniper',
  'match_prophet',
  'streak_keeper',
] as const;

export const SAFE_BACKGROUND_KEYS = [
  'neon_city',
  'rainy_road',
  'delivery_dash',
  'food_street',
  'gym_arena',
  'cafe_clash',
  'stadium_pulse',
  'redemption_stage',
  'clean_dashboard',
  'city_pulse',
] as const;
