import { BadRequestException } from '@nestjs/common';
import {
  BANNED_BETTING_TERMS,
  POLICY_BLOCK_MESSAGE,
} from '../constants/policy.constants';

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findBannedBettingTerms(input?: string | null) {
  if (!input) return [];
  const normalized = input.toLowerCase();
  return BANNED_BETTING_TERMS.filter((term) => {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
    return pattern.test(normalized);
  });
}

export function hasBannedBettingKeyword(input?: string | null) {
  return findBannedBettingTerms(input).length > 0;
}

export function assertNoBannedBettingKeywords(fields: Record<string, unknown>) {
  // Safety guardrail: block betting-like copy at write time so positioning does not drift
  // toward wagering semantics as creators edit rooms, profiles, or results.
  const blocked = Object.entries(fields).flatMap(([field, value]) => {
    if (typeof value !== 'string') return [];
    return findBannedBettingTerms(value).map((term) => ({ field, term }));
  });

  if (blocked.length) {
    throw new BadRequestException({
      message: POLICY_BLOCK_MESSAGE,
      blockedTerms: blocked,
    });
  }
}
