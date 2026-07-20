import {
  getRoomTheme,
  getOpenPredictionSubtypeConfig,
  resolveRoomSubtype,
} from '../config/categoryTheme';

type DashboardSummary = {
  currentStreak?: number;
  weeklyAura?: number;
  totalAura?: number;
};

type ActivePrediction = {
  roomId: string;
  title?: string;
  roomTitle?: string;
  category?: string;
  subtype?: string | null;
  scoringRule?: any;
  templateKey?: string;
  status?: string;
  hasSubmittedPrediction?: boolean;
  participantCount?: number;
  liveProgress?: {
    progressLabel?: string | null;
    statusLabel?: string | null;
  };
};

type LeaderboardEntry = {
  rank?: number;
  name?: string;
  prediktHandle?: string | null;
  weeklyAura?: number;
};

export type TodaysTea = {
  category: 'arrival' | 'weather' | 'food' | 'whos_late' | 'gym' | 'group' | 'solo' | 'oracle' | 'streak' | 'comeback';
  label: string;
  icon: string;
  accent: [string, string];
  headline: string;
  body: string;
  kicker: string;
};

type Inputs = {
  userName?: string | null;
  summary?: DashboardSummary | null;
  activePredictions?: ActivePrediction[];
  followingLeaderboard?: LeaderboardEntry[];
};

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? 'friend';
}

function buildOnboardingTea(name?: string | null): TodaysTea {
  return {
    category: 'solo',
    label: 'Onboarding Tea',
    icon: '☕',
    accent: ['#22D3EE', '#22d3ee'],
    headline: `Fresh start, ${firstName(name)}.`,
    body: 'No prediction history yet. Perfect. Your legacy remains fully editable.',
    kicker: 'Start one room and give tomorrow something to talk about.',
  };
}

export function buildTodaysTea({ userName, summary, activePredictions = [], followingLeaderboard = [] }: Inputs): TodaysTea {
  if (activePredictions.length === 0 && (summary?.currentStreak ?? 0) === 0 && (summary?.weeklyAura ?? 0) === 0) {
    return buildOnboardingTea(userName);
  }

  const pendingPrediction = activePredictions.find((room) => !room.hasSubmittedPrediction);
  if (pendingPrediction) {
    const theme = getRoomTheme(pendingPrediction);
    return {
      category: 'oracle',
      label: 'Oracle Tea',
      icon: theme.icon,
      accent: theme.gradient,
      headline: 'Oracle Bot has noticed the hesitation.',
      body: `${pendingPrediction.title ?? pendingPrediction.roomTitle ?? 'A room'} is still waiting for your call.`,
      kicker: 'Confidence looks better when submitted.',
    };
  }

  const liveRoom = activePredictions.find((room) => room.status === 'live');
  if (liveRoom) {
    const theme = getRoomTheme(liveRoom);
    const roomName = liveRoom.title ?? liveRoom.roomTitle ?? 'That room';
    const subtype = resolveRoomSubtype(liveRoom);
    if (subtype) {
      // Open-prediction rooms have no journey — use travel-free subtype copy.
      const config = getOpenPredictionSubtypeConfig(subtype);
      return {
        category: 'group',
        label: `${theme.label} Tea`,
        icon: theme.icon,
        accent: theme.gradient,
        headline: config.teaHeadline,
        body: `${roomName} is live. ${config.teaBody}`,
        kicker: 'A calm prediction now would look extremely intentional.',
      };
    }
    return {
      category: liveRoom.category === 'food_eta' ? 'food' : liveRoom.category === 'weather_rain' ? 'weather' : 'arrival',
      label: `${theme.label} Tea`,
      icon: theme.icon,
      accent: theme.gradient,
      headline: liveRoom.liveProgress?.statusLabel ?? 'Today feels suspiciously in motion.',
      body: `${roomName} is live. ${liveRoom.liveProgress?.progressLabel ?? 'The plot is advancing.'}`,
      kicker: 'A calm prediction now would look extremely intentional.',
    };
  }

  if ((summary?.currentStreak ?? 0) >= 5) {
    return {
      category: 'streak',
      label: 'Streak Tea',
      icon: '🔥',
      accent: ['#f97316', '#fbbf24'],
      headline: 'Your streak is getting ideas.',
      body: `${summary?.currentStreak} days in and the consistency is starting to look a little rehearsed.`,
      kicker: 'Keep going. Let the numbers become a personality trait.',
    };
  }

  if ((summary?.weeklyAura ?? 0) > 0) {
    return {
      category: 'comeback',
      label: 'Comeback Tea',
      icon: '✨',
      accent: ['#22c55e', '#22d3ee'],
      headline: 'Your comeback arc has entered production.',
      body: `You are sitting on +${summary?.weeklyAura ?? 0} Aura this week. Modesty can review the tape later.`,
      kicker: 'One more clean win and this stops being a coincidence.',
    };
  }

  const leaderboardTop = followingLeaderboard[0];
  if (leaderboardTop?.weeklyAura && leaderboardTop.weeklyAura > 0) {
    return {
      category: 'group',
      label: 'Group Tea',
      icon: '👥',
      accent: ['#ec4899', '#22D3EE'],
      headline: 'The leaderboard has started murmuring.',
      body: `${leaderboardTop.prediktHandle ? `@${leaderboardTop.prediktHandle}` : leaderboardTop.name ?? 'Someone'} is currently ahead. Respectfully, this feels temporary.`,
      kicker: 'A well-timed prediction is still the fastest form of diplomacy.',
    };
  }

  return {
    category: 'solo',
    label: 'Solo Tea',
    icon: '☕',
    accent: ['#6366f1', '#22d3ee'],
    headline: 'Today’s confidence level: suspiciously high.',
    body: 'Nothing dramatic has happened yet, which is exactly how dramatic days begin.',
    kicker: 'Open a room before reality gets any new ideas.',
  };
}
