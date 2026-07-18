import api from './api';

export interface ProfileStats {
  totalAura: number;
  weeklyAura: number;
  cloutBalance: number;
  creditBalance?: number;
  lifetimeCloutEarned: number;
  winsCount: number;
  predictionsMadeCount: number;
  roomsCreatedCount: number;
  predictionAccuracyScore: number;
  currentStreak: number;
  longestStreak: number;
  reliabilityScore?: number;
  reliabilityEvents?: number;
  recentReliability?: Array<{
    eventType: string;
    pointsDelta: number;
    reason: string;
    createdAt: string;
  }>;
}

export interface FollowingEntry {
  userId: string;
  name: string;
  prediktHandle?: string | null;
  weeklyAura?: number;
  cloutBalance?: number;
}

export interface ProfileBadge {
  badgeKey: string;
  title: string;
  icon?: string | null;
}

function normalizeFollowingEntry(entry: any): FollowingEntry {
  return {
    userId: entry.following?.userId ?? entry.userId,
    name: entry.following?.name ?? entry.name,
    prediktHandle: entry.following?.prediktHandle ?? entry.prediktHandle,
    weeklyAura: entry.following?.weeklyAura ?? entry.weeklyAura,
    cloutBalance: entry.following?.cloutBalance ?? entry.cloutBalance,
  };
}

export async function fetchProfileOverview() {
  const [statsRes, followingRes, badgesRes] = await Promise.all([
    api.get('/users/me/stats'),
    api.get('/users/me/following'),
    api.get('/users/me/badges').catch(() => ({ data: [] })),
  ]);

  return {
    stats: statsRes.data as ProfileStats,
    following: ((followingRes.data ?? []) as any[]).map(normalizeFollowingEntry),
    badges: (badgesRes.data ?? []) as ProfileBadge[],
  };
}

export async function saveProfileIdentity(patch: { name: string; prediktHandle: string }) {
  const res = await api.patch('/users/me/profile', patch);
  return res.data;
}

export async function requestDataExport() {
  await api.post('/privacy/data-export-request');
}

export async function requestDataDeletion() {
  await api.post('/privacy/data-deletion-request');
}

export async function optOutAiPersonalisation() {
  const res = await api.patch('/privacy/ai-personalisation-opt-out', { optOut: true });
  return res.data;
}

export async function unfollowUser(targetUserId: string) {
  await api.delete(`/users/${targetUserId}/follow`);
}

export async function saveCommentaryPreference(patch: { enabled?: boolean; aiOptOut?: boolean }) {
  const res = await api.patch('/users/me/commentary-preference', patch);
  return {
    enabled: res.data.enabled ?? res.data.commentaryEnabled ?? true,
    aiOptOut: res.data.aiOptOut ?? res.data.aiCommentaryOptOut ?? false,
  };
}
