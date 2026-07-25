import { RewardType } from '@prisma/client';

/**
 * Central registry of Phase 1 reward reason codes. Controllers/services reference
 * these constants; amounts and caps live in the RewardRule table (seeded below),
 * never hardcoded in grant logic.
 */
export const RewardReason = {
  // AURA — prediction skill. Amounts are dynamic (computed by the scoring engine).
  AURA_MILESTONE_SCORE: 'AURA_MILESTONE_SCORE',
  AURA_MC_SCORE: 'AURA_MC_SCORE',
  AURA_COMPENSATION: 'AURA_COMPENSATION',
  AURA_ADMIN_ADJUSTMENT: 'AURA_ADMIN_ADJUSTMENT',
  // RIZZ — social influence. Never from prediction outcomes.
  RIZZ_UNIQUE_JOIN: 'RIZZ_UNIQUE_JOIN',
  RIZZ_REACTION_RECEIVED: 'RIZZ_REACTION_RECEIVED',
  RIZZ_REMATCH_COMPLETED: 'RIZZ_REMATCH_COMPLETED',
  RIZZ_VERIFIED_SHARE: 'RIZZ_VERIFIED_SHARE',
  RIZZ_ADMIN_ADJUSTMENT: 'RIZZ_ADMIN_ADJUSTMENT',
  // GEMS — spendable. Never grants prediction advantage.
  GEM_FIRST_PREDICTION: 'GEM_FIRST_PREDICTION',
  GEM_FIRST_WIN: 'GEM_FIRST_WIN',
  GEM_MILESTONE_BADGE: 'GEM_MILESTONE_BADGE',
  GEM_REFERRAL_COMPLETED: 'GEM_REFERRAL_COMPLETED',
  GEM_ADMIN_ADJUSTMENT: 'GEM_ADMIN_ADJUSTMENT',
} as const;

export type RewardReasonCode =
  (typeof RewardReason)[keyof typeof RewardReason];

/** Admin-adjustment reason code per currency. */
export const ADMIN_REASON_BY_TYPE: Record<RewardType, RewardReasonCode> = {
  AURA: RewardReason.AURA_ADMIN_ADJUSTMENT,
  RIZZ: RewardReason.RIZZ_ADMIN_ADJUSTMENT,
  GEMS: RewardReason.GEM_ADMIN_ADJUSTMENT,
};

/**
 * Optional per-rule configuration stored in RewardRule.configJson.
 *  - rejectSelf: skip when the actor is the beneficiary.
 *  - requiresOtherUser: caller must assert a distinct second participant.
 *  - dynamic: amount is supplied by the caller (baseAmount ignored); hides the
 *    numeric reward from the public /rewards/rules summary.
 *  - publicVisible: include in /rewards/rules (default true).
 *  - badgeKeys / badgeAmounts: allowlist + per-badge Gem amounts for badge grants.
 */
export interface RewardRuleConfig {
  rejectSelf?: boolean;
  requiresOtherUser?: boolean;
  dynamic?: boolean;
  publicVisible?: boolean;
  badgeKeys?: string[];
  badgeAmounts?: Record<string, number>;
}

export interface RewardRuleSeed {
  reasonCode: RewardReasonCode;
  rewardType: RewardType;
  baseAmount: number;
  enabled: boolean;
  dailyCap: number | null;
  perSourceCap: number | null;
  config: RewardRuleConfig;
  label: string;
  description: string;
}

/** Badges that grant Gems when unlocked (allowlist + amounts). */
export const GEM_BADGE_AMOUNTS: Record<string, number> = {
  bot_beater: 15,
  eta_sniper: 15,
  group_oracle: 10,
  route_oracle: 10,
  human_edge: 10,
};

/**
 * Phase 1 rule seed. Amounts/caps are intentionally conservative and fully
 * reconfigurable at runtime by editing these rows. See
 * docs/reward-system-phase1-contract.md for rationale.
 */
export const PHASE1_REWARD_RULES: RewardRuleSeed[] = [
  // ---- AURA (wraps existing scoring; amounts dynamic) ----
  {
    reasonCode: RewardReason.AURA_MILESTONE_SCORE,
    rewardType: 'AURA',
    baseAmount: 0,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    config: { dynamic: true, publicVisible: false },
    label: 'Prediction score',
    description: 'Aura earned from the accuracy of a timed prediction.',
  },
  {
    reasonCode: RewardReason.AURA_MC_SCORE,
    rewardType: 'AURA',
    baseAmount: 0,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    config: { dynamic: true, publicVisible: false },
    label: 'Prediction score',
    description: 'Aura earned from a multiple-choice prediction.',
  },
  {
    reasonCode: RewardReason.AURA_COMPENSATION,
    rewardType: 'AURA',
    baseAmount: 5,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    config: { publicVisible: false },
    label: 'Participation',
    description: 'Aura for a room that closed without a result.',
  },
  {
    reasonCode: RewardReason.AURA_ADMIN_ADJUSTMENT,
    rewardType: 'AURA',
    baseAmount: 0,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    config: { dynamic: true, publicVisible: false },
    label: 'Admin adjustment',
    description: 'Manual Aura adjustment by an administrator.',
  },
  // ---- RIZZ (social; never from prediction outcomes) ----
  {
    reasonCode: RewardReason.RIZZ_UNIQUE_JOIN,
    rewardType: 'RIZZ',
    baseAmount: 5,
    enabled: true,
    dailyCap: 100,
    perSourceCap: null,
    config: { rejectSelf: true, publicVisible: true },
    label: 'New participant',
    description: 'Someone new joins a room you created.',
  },
  {
    reasonCode: RewardReason.RIZZ_REACTION_RECEIVED,
    rewardType: 'RIZZ',
    baseAmount: 2,
    enabled: true,
    dailyCap: 50,
    perSourceCap: null,
    config: { rejectSelf: true, publicVisible: true },
    label: 'Reaction received',
    description: 'Another player reacts to your result.',
  },
  {
    reasonCode: RewardReason.RIZZ_REMATCH_COMPLETED,
    rewardType: 'RIZZ',
    baseAmount: 10,
    enabled: true,
    dailyCap: 50,
    perSourceCap: null,
    config: { requiresOtherUser: true, publicVisible: true },
    label: 'Rematch completed',
    description: 'A rematch you ran finishes with other players.',
  },
  {
    reasonCode: RewardReason.RIZZ_VERIFIED_SHARE,
    rewardType: 'RIZZ',
    baseAmount: 3,
    enabled: true,
    dailyCap: 9,
    perSourceCap: null,
    config: { rejectSelf: false, publicVisible: true },
    label: 'Shared a room',
    description: 'You shared a room with others.',
  },
  {
    reasonCode: RewardReason.RIZZ_ADMIN_ADJUSTMENT,
    rewardType: 'RIZZ',
    baseAmount: 0,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    config: { dynamic: true, publicVisible: false },
    label: 'Admin adjustment',
    description: 'Manual RIZZ adjustment by an administrator.',
  },
  // ---- GEMS (spendable; no prediction advantage) ----
  {
    reasonCode: RewardReason.GEM_FIRST_PREDICTION,
    rewardType: 'GEMS',
    baseAmount: 20,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    config: { publicVisible: true },
    label: 'First prediction',
    description: 'Make your first prediction.',
  },
  {
    reasonCode: RewardReason.GEM_FIRST_WIN,
    rewardType: 'GEMS',
    baseAmount: 50,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    config: { publicVisible: true },
    label: 'First win',
    description: 'Win your first room.',
  },
  {
    reasonCode: RewardReason.GEM_MILESTONE_BADGE,
    rewardType: 'GEMS',
    baseAmount: 0,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    config: {
      dynamic: true,
      publicVisible: true,
      badgeKeys: Object.keys(GEM_BADGE_AMOUNTS),
      badgeAmounts: GEM_BADGE_AMOUNTS,
    },
    label: 'Badge unlocked',
    description: 'Earn a selected milestone badge.',
  },
  {
    // Seeded but DISABLED — no referral pipeline exists yet (Phase 1 open item #3).
    reasonCode: RewardReason.GEM_REFERRAL_COMPLETED,
    rewardType: 'GEMS',
    baseAmount: 100,
    enabled: false,
    dailyCap: null,
    perSourceCap: null,
    config: { publicVisible: true },
    label: 'Referral completed',
    description: 'A friend you referred joins Predikt.',
  },
  {
    reasonCode: RewardReason.GEM_ADMIN_ADJUSTMENT,
    rewardType: 'GEMS',
    baseAmount: 0,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    config: { dynamic: true, publicVisible: false },
    label: 'Admin adjustment',
    description: 'Manual Gem adjustment by an administrator.',
  },
];
