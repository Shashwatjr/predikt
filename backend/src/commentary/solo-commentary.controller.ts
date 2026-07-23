import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  pickSoloCommentary,
  SOLO_COMMENTARY_PERSONALITY,
  SOLO_DOMAINS,
  SOLO_OUTCOMES,
  SoloOutcome,
  SoloPredictionDomain,
} from './solo-commentary.templates';

/**
 * Serves solo micro-prediction commentary to the app. Public + template-only
 * (no user data, no LLM) — the app renders the returned line and attributes it to
 * "{personality} on My Prediktion".
 */
@Controller('commentary')
export class SoloCommentaryController {
  @Get('solo')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getSolo(
    @Query('domain') domain?: string,
    @Query('outcome') outcome?: string,
    @Query('seed') seed?: string,
  ) {
    const safeDomain: SoloPredictionDomain = SOLO_DOMAINS.includes(domain as SoloPredictionDomain)
      ? (domain as SoloPredictionDomain)
      : 'any';
    const safeOutcome: SoloOutcome = SOLO_OUTCOMES.includes(outcome as SoloOutcome)
      ? (outcome as SoloOutcome)
      : 'pending';
    const safeSeed = Number.parseInt(seed ?? '', 10);

    const template = pickSoloCommentary(safeDomain, safeOutcome, Number.isFinite(safeSeed) ? safeSeed : 0);
    return {
      key: template.key,
      domain: template.domain,
      outcome: template.outcome,
      line: template.line,
      personality: SOLO_COMMENTARY_PERSONALITY,
    };
  }
}
