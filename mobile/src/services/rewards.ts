import api from './api';

/**
 * Phase 1 rewards client. Three currencies, cleanly separated:
 *  - Aura: prediction skill (not spendable)
 *  - RIZZ: social influence (not spendable)
 *  - Gems: spendable rewards
 * Backed by GET /rewards/me, /rewards/history, /rewards/rules.
 */

export type RewardType = 'AURA' | 'RIZZ' | 'GEMS';

export interface RewardBalance {
  balance: number;
  lifetime: number;
}

export interface AuraBalance extends RewardBalance {
  weekly: number;
  rank?: number | null;
}

export interface RewardLedgerEntry {
  id: string;
  rewardType: RewardType;
  amount: number;
  balanceAfter: number;
  reasonCode: string;
  label: string;
  sourceType?: string | null;
  createdAt: string;
}

export interface NextMilestone {
  reasonCode: string;
  label: string;
  reward: number;
  rewardType: RewardType;
}

export interface RewardsMe {
  aura: AuraBalance;
  tier: unknown | null;
  rizz: RewardBalance;
  gems: RewardBalance;
  recentEntries: RewardLedgerEntry[];
  nextMilestone: NextMilestone | null;
}

export interface RewardsHistoryPage {
  entries: RewardLedgerEntry[];
  nextCursor: string | null;
}

export interface RewardRuleSummary {
  reasonCode: string;
  rewardType: RewardType;
  reward: number | null;
  label: string;
  description: string;
}

export async function fetchRewardsMe(): Promise<RewardsMe> {
  const res = await api.get('/rewards/me');
  return res.data as RewardsMe;
}

export async function fetchRewardsHistory(params?: {
  type?: RewardType;
  limit?: number;
  cursor?: string;
}): Promise<RewardsHistoryPage> {
  const res = await api.get('/rewards/history', { params });
  return res.data as RewardsHistoryPage;
}

export async function fetchRewardRules(): Promise<RewardRuleSummary[]> {
  const res = await api.get('/rewards/rules');
  return (res.data?.rules ?? []) as RewardRuleSummary[];
}

/** One-line tooltip copy per currency (Profile chips). */
export const REWARD_TOOLTIPS: Record<RewardType, string> = {
  AURA: 'Aura: prediction skill',
  RIZZ: 'RIZZ: social influence',
  GEMS: 'Gems: spendable rewards',
};

export const REWARD_META: Record<RewardType, { label: string; icon: string }> = {
  AURA: { label: 'Aura', icon: '✨' },
  RIZZ: { label: 'RIZZ', icon: '💫' },
  GEMS: { label: 'Gems', icon: '💎' },
};
