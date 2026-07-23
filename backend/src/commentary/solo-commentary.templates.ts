/**
 * Chaos Bot — solo micro-prediction responses (weather / commute / day pattern).
 *
 * The reward in My Prediktion is Chaos Bot's line, not the score. These solo lines live
 * here — one place for the voice — and are served to the app via GET /commentary/solo.
 *
 * Voice: subtle sarcasm, warm not cruel, ONE sharp quotable line. Never punch down —
 * the target is the world (weather, traffic, the day), never the user. Template-based
 * on purpose; the consistent, recognisable voice IS the product. No LLM.
 */

export type SoloPredictionDomain = 'weather' | 'commute' | 'day_pattern' | 'any';

/** How the solo prediction turned out. `pending` = made, not yet resolved. */
export type SoloOutcome = 'nailed' | 'close' | 'off' | 'pending';

export type SoloCommentaryTemplate = {
  key: string;
  domain: SoloPredictionDomain;
  outcome: SoloOutcome;
  line: string;
};

/** Brand voice name used for attribution: "— Chaos Bot on My Prediktion". */
export const SOLO_COMMENTARY_PERSONALITY = 'Chaos Bot';

export const SOLO_DOMAINS: SoloPredictionDomain[] = ['weather', 'commute', 'day_pattern', 'any'];
export const SOLO_OUTCOMES: SoloOutcome[] = ['nailed', 'close', 'off', 'pending'];

export const SOLO_PREDICTION_COMMENTARY: SoloCommentaryTemplate[] = [
  // --- Weather ---
  { key: 'weather-nailed', domain: 'weather', outcome: 'nailed', line: 'You called the rain before the clouds committed. Unsettling accuracy.' },
  { key: 'weather-close', domain: 'weather', outcome: 'close', line: 'Off by one drizzle. The sky rounded up.' },
  { key: 'weather-off', domain: 'weather', outcome: 'off', line: 'The forecast betrayed us both. You were just braver about it.' },
  { key: 'weather-pending', domain: 'weather', outcome: 'pending', line: 'Prediction in. Now we wait for the sky to have an opinion.' },
  { key: 'weather-nailed-2', domain: 'weather', outcome: 'nailed', line: 'Correct again. The weather app took notes.' },

  // --- Commute ---
  { key: 'commute-nailed', domain: 'commute', outcome: 'nailed', line: 'Nailed the ETA. Traffic is taking it personally.' },
  { key: 'commute-close', domain: 'commute', outcome: 'close', line: 'Close. Traffic added a plot twist near the exit.' },
  { key: 'commute-off', domain: 'commute', outcome: 'off', line: 'The commute took the scenic route. Nobody approved that itinerary.' },
  { key: 'commute-pending', domain: 'commute', outcome: 'pending', line: 'Locked in. The road has been notified.' },
  { key: 'commute-nailed-2', domain: 'commute', outcome: 'nailed', line: 'You predicted traffic and traffic still tried something. Respect the read.' },

  // --- Day pattern ---
  { key: 'day-nailed', domain: 'day_pattern', outcome: 'nailed', line: 'You forecast your own day and got it right. Suspiciously self-aware.' },
  { key: 'day-close', domain: 'day_pattern', outcome: 'close', line: 'Roughly right. The day improvised the middle part.' },
  { key: 'day-off', domain: 'day_pattern', outcome: 'off', line: 'The day had other plans. It rarely files them in advance.' },
  { key: 'day-pending', domain: 'day_pattern', outcome: 'pending', line: 'Bold forecast. The day has been served notice.' },
  { key: 'day-close-2', domain: 'day_pattern', outcome: 'close', line: 'Predicting your own Monday is confidence or a dare. We allowed it.' },

  // --- Any domain ---
  { key: 'any-pending', domain: 'any', outcome: 'pending', line: 'Prediction placed. The universe will respond when it feels like it.' },
  { key: 'any-nailed', domain: 'any', outcome: 'nailed', line: 'Called it. Frame this one.' },
  { key: 'any-off', domain: 'any', outcome: 'off', line: 'Wrong, but with conviction. That is half the fun.' },
];

/**
 * Picks a Chaos Bot line for a solo prediction. Prefers a domain-specific line for
 * the outcome; falls back to a domain-agnostic line, then any line for the outcome.
 * `seed` (e.g. a prediction id hash) keeps the choice stable across requests.
 */
export function pickSoloCommentary(
  domain: SoloPredictionDomain,
  outcome: SoloOutcome,
  seed = 0,
): SoloCommentaryTemplate {
  const domainMatches = SOLO_PREDICTION_COMMENTARY.filter(
    (t) => t.domain === domain && t.outcome === outcome,
  );
  const anyMatches = SOLO_PREDICTION_COMMENTARY.filter(
    (t) => t.domain === 'any' && t.outcome === outcome,
  );
  const outcomeMatches = SOLO_PREDICTION_COMMENTARY.filter((t) => t.outcome === outcome);
  const pool = domainMatches.length ? domainMatches : anyMatches.length ? anyMatches : outcomeMatches;
  if (!pool.length) return SOLO_PREDICTION_COMMENTARY[0];
  const index = Math.abs(Math.trunc(seed)) % pool.length;
  return pool[index];
}
