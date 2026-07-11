import { BadRequestException } from '@nestjs/common';
import { CommentaryInput } from './commentary.types';

const ALLOWED_PERSONALITIES = new Set([
  'Oracle',
  'Chaos',
  'Best Friend',
  'Gen Z',
  'Indian Mom',
  'Corporate Manager',
  'Traffic Cop',
  'Bangalore Guru',
]);

const BLOCKED_TERMS = [
  'kill',
  'die',
  'suicide',
  'self-harm',
  'nude',
  'sexual',
  'harass',
  'humiliat',
  'ugly',
  'fat',
  'disabled',
  'disability',
  'religion',
  'race',
  'gender',
  'sexuality',
  'health',
  'politic',
  'violence',
  'drunk',
  'high',
  'speed wins',
  'bet',
  'wager',
  'stake',
  'odds',
  'payout',
  'jackpot',
  'wallet',
  'cash prize',
  'gambling',
];

const SAFE_MODE_RESULT_TYPES = new Set([
  'cancelled',
  'abandoned',
  'disputed',
  'auto_closed',
  'emergency',
  'safety_incident',
]);

export function validatePersonality(personality: string | undefined | null): string {
  if (!personality || !ALLOWED_PERSONALITIES.has(personality)) {
    throw new BadRequestException('Unsupported personality');
  }
  return personality;
}

export function isSafeCommentaryText(text: string | undefined | null): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return !BLOCKED_TERMS.some((term) => normalized.includes(term));
}

export function sanitizeInput(input: CommentaryInput) {
  const safe = {
    ...input,
    winnerHandle: input.winnerHandle ? input.winnerHandle.replace(/[^\w@.]/g, '') : null,
    winnerPredictionLabel: input.winnerPredictionLabel ?? null,
    actualOutcomeLabel: input.actualOutcomeLabel ?? null,
    differenceLabel: input.differenceLabel ?? null,
    biggestNearMissLabel: input.biggestNearMissLabel ?? null,
    baselineLabel: input.baselineLabel ?? null,
    oracleBotLabel: input.oracleBotLabel ?? null,
    roomTitle: input.roomTitle ? input.roomTitle.slice(0, 80) : null,
    badgeLabel: input.badgeLabel ? input.badgeLabel.slice(0, 40) : null,
  };

  if (!safe.roomId) {
    throw new BadRequestException('roomId is required');
  }

  return safe;
}

export function buildNeutralCommentary() {
  return {
    headline: 'Fair reset, no drama',
    punchline: 'Plans changed. This PREDIKT closed fairly, and nobody’s prediction counted as a loss.',
    supportingLine: 'Everyone gets a fair reset.',
  };
}

export function shouldForceNeutralMode(input: CommentaryInput) {
  return Boolean(input.safeMode) || SAFE_MODE_RESULT_TYPES.has(input.resultType);
}

export function fallbackCategoryLine(category: string | undefined | null) {
  switch (category) {
    case 'weather_rain':
      return 'Forecast energy stayed playful and fair.';
    case 'food_eta':
      return 'Delivery drama created a story, not a loss.';
    case 'whos_late':
      return 'Group chaos stayed friendly.';
    case 'gym_habit':
      return 'Progress still counts, even when the room gets messy.';
    default:
      return 'Closest guess still earned the moment.';
  }
}
