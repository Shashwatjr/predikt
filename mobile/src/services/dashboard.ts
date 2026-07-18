import api from './api';

export interface DashboardState {
  summary: any;
  recommendations: string[];
  activeRooms: any[];
  followingLeaderboard: any[];
  dailyChallenge: any | null;
  dailySpin: any | null;
  dropsNearUnlock: any[];
  activityFeed: any[];
  suggestedFollows: any[];
  activePredictions: any[];
}

const DASHBOARD_ENDPOINTS = [
  ['summary', '/dashboard/summary'],
  ['recommendations', '/dashboard/recommendations'],
  ['activeRooms', '/dashboard/active-rooms'],
  ['followingLeaderboard', '/dashboard/following-leaderboard'],
  ['dailyChallenge', '/dashboard/daily-challenge'],
  ['dailySpin', '/dashboard/daily-spin'],
  ['dropsNearUnlock', '/dashboard/drops-near-unlock'],
  ['activityFeed', '/dashboard/activity-feed'],
  ['suggestedFollows', '/dashboard/suggested-follows'],
  ['activePredictions', '/dashboard/active-predictions'],
] as const;

const LIST_FIELDS = new Set([
  'recommendations',
  'activeRooms',
  'followingLeaderboard',
  'dropsNearUnlock',
  'activityFeed',
  'suggestedFollows',
  'activePredictions',
]);

/**
 * Fetches every dashboard section independently so one failing endpoint
 * (e.g. drops-near-unlock) doesn't blank out sections that loaded fine.
 */
export async function fetchDashboardData(): Promise<{
  dashboard: DashboardState;
  failedSections: string[];
}> {
  const results = await Promise.allSettled(
    DASHBOARD_ENDPOINTS.map(([, url]) => api.get(url)),
  );

  const dashboard = {} as DashboardState;
  const failedSections: string[] = [];

  results.forEach((result, index) => {
    const [field] = DASHBOARD_ENDPOINTS[index];
    const fallback = LIST_FIELDS.has(field) ? [] : null;

    if (result.status === 'fulfilled') {
      const data = field === 'recommendations' ? result.value.data?.recommendations : result.value.data;
      (dashboard as any)[field] = data ?? fallback;
    } else {
      (dashboard as any)[field] = fallback;
      failedSections.push(field);
    }
  });

  return { dashboard, failedSections };
}

export interface ActivePredictionOrderItem {
  roomId: string;
  displayOrder: number;
  pinned: boolean;
}

export async function updateActivePredictionOrder(items: ActivePredictionOrderItem[]) {
  await api.patch('/dashboard/active-predictions/order', { items });
}

export async function clearActivePredictions(reason = 'mvp_pilot_clear_previous_predictions') {
  const response = await api.post('/dashboard/active-predictions/clear', { reason });
  return response.data as { success: boolean; clearedCount: number; reason?: string | null };
}

export async function fetchRoom(roomId: string) {
  const response = await api.get(`/rooms/${roomId}`);
  return response.data;
}
