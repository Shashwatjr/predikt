export type BadgeKey =
  | 'bot_beater'
  | 'human_edge'
  | 'dot_bonus'
  | 'comeback_unlocked'
  | 'comeback_winner'
  | 'group_oracle'
  | 'chaos_survivor'
  | 'prediction_streak'
  | 'pattern_breaker'
  | 'route_oracle'
  | 'eta_sniper'
  | 'traffic_oracle'
  | 'orr_survivor'
  | 'airport_ace'
  | 'rain_oracle'
  | 'forecast_beater'
  | 'monsoon_streak'
  | 'eta_master'
  | 'delivery_oracle'
  | 'beat_the_eta'
  | 'time_oracle'
  | 'late_legend'
  | 'group_chaos'
  | 'consistency_streak'
  | 'comeback_solo';

export type BadgeDefinition = {
  badgeKey: BadgeKey;
  title: string;
  description: string;
  icon: string;
};

export const BADGE_CATALOG: Record<BadgeKey, BadgeDefinition> = {
  bot_beater: { badgeKey: 'bot_beater', title: 'Bot Beater', description: 'Beat Oracle Bot on a room result.', icon: '🤖' },
  human_edge: { badgeKey: 'human_edge', title: 'Human Edge', description: 'Outpredicted the benchmark with instinct.', icon: '⚡' },
  dot_bonus: { badgeKey: 'dot_bonus', title: 'Dot Bonus', description: 'Landed within the tightest accuracy window.', icon: '🎯' },
  comeback_unlocked: { badgeKey: 'comeback_unlocked', title: 'Comeback Unlocked', description: 'Ready for a playful rematch.', icon: '🔁' },
  comeback_winner: { badgeKey: 'comeback_winner', title: 'Comeback Winner', description: 'Won the room after a prior miss.', icon: '👑' },
  group_oracle: { badgeKey: 'group_oracle', title: 'Group Oracle', description: 'Top read in a group room.', icon: '🧿' },
  chaos_survivor: { badgeKey: 'chaos_survivor', title: 'Chaos Survivor', description: 'Stayed sharp through a chaotic room.', icon: '🌀' },
  prediction_streak: { badgeKey: 'prediction_streak', title: 'Prediction Streak', description: 'Kept the prediction streak alive.', icon: '🔥' },
  pattern_breaker: { badgeKey: 'pattern_breaker', title: 'Pattern Breaker', description: 'Broke the expected habit pattern.', icon: '💪' },
  route_oracle: { badgeKey: 'route_oracle', title: 'Route Oracle', description: 'Closest arrival read on a route room.', icon: '🛣️' },
  eta_sniper: { badgeKey: 'eta_sniper', title: 'ETA Sniper', description: 'Nailed the arrival window.', icon: '🕐' },
  traffic_oracle: { badgeKey: 'traffic_oracle', title: 'Traffic Oracle', description: 'Read the traffic better than the benchmark.', icon: '🚦' },
  orr_survivor: { badgeKey: 'orr_survivor', title: 'ORR Survivor', description: 'Survived the outer ring road chaos.', icon: '🛣️' },
  airport_ace: { badgeKey: 'airport_ace', title: 'Airport Ace', description: 'Closest airport arrival call.', icon: '✈️' },
  rain_oracle: { badgeKey: 'rain_oracle', title: 'Rain Oracle', description: 'Closest rain timing read.', icon: '🌧️' },
  forecast_beater: { badgeKey: 'forecast_beater', title: 'Forecast Beater', description: 'Beat the forecast benchmark.', icon: '☔' },
  monsoon_streak: { badgeKey: 'monsoon_streak', title: 'Monsoon Streak', description: 'Another sharp weather read.', icon: '🌦️' },
  eta_master: { badgeKey: 'eta_master', title: 'ETA Master', description: 'Called the food ETA closest.', icon: '🍕' },
  delivery_oracle: { badgeKey: 'delivery_oracle', title: 'Delivery Oracle', description: 'Sharpest delivery timing read.', icon: '📦' },
  beat_the_eta: { badgeKey: 'beat_the_eta', title: 'Beat the ETA', description: 'Beat the delivery benchmark.', icon: '⏱️' },
  time_oracle: { badgeKey: 'time_oracle', title: 'Time Oracle', description: 'Sharpest group timing read.', icon: '⏰' },
  late_legend: { badgeKey: 'late_legend', title: 'Late Legend', description: 'Called the late arrival closest.', icon: '😅' },
  group_chaos: { badgeKey: 'group_chaos', title: 'Group Chaos', description: 'Owned the group timing moment.', icon: '👥' },
  consistency_streak: { badgeKey: 'consistency_streak', title: 'Consistency Streak', description: 'Kept the habit streak going.', icon: '🏋️' },
  comeback_solo: { badgeKey: 'comeback_solo', title: 'Comeback Solo', description: 'Personal habit comeback unlocked.', icon: '💫' },
};

export const CATEGORY_WINNER_BADGE: Record<string, BadgeKey> = {
  arrival_time: 'route_oracle',
  weather_rain: 'rain_oracle',
  food_eta: 'eta_master',
  whos_late: 'time_oracle',
  gym_habit: 'pattern_breaker',
};
