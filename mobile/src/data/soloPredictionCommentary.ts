import api from '../services/api';

/**
 * Solo micro-prediction commentary CLIENT.
 *
 * The voice now lives in one place — the backend commentary engine
 * (backend/src/commentary/solo-commentary.templates.ts), served via
 * GET /commentary/solo. This module only fetches and formats for sharing.
 */

export type SoloPredictionDomain = 'weather' | 'commute' | 'day_pattern' | 'any';
export type SoloOutcome = 'nailed' | 'close' | 'off' | 'pending';

export type SoloCommentary = {
  key: string;
  domain: SoloPredictionDomain;
  outcome: SoloOutcome;
  line: string;
  personality: string;
};

/** Fetches a Chaos Bot line for a solo prediction from the backend voice engine. */
export async function fetchSoloCommentary(
  domain: SoloPredictionDomain,
  outcome: SoloOutcome,
  seed = 0,
): Promise<SoloCommentary> {
  const res = await api.get('/commentary/solo', { params: { domain, outcome, seed } });
  return res.data as SoloCommentary;
}

export { formatLineForShare as formatCommentaryForShare } from '../utils/shareLine';
