/**
 * In-voice framing for the Oracle / Chaos Bot benchmark.
 *
 * This is presentation copy only — it wraps a value the app already has (a benchmark
 * time or an ETA string) in the bot's voice so a first-timer reads "the one to beat"
 * instead of a bare number. It is NOT the result-time commentary system
 * (see backend commentary.templates.ts): no LLM calls, no new commentary templates.
 */

/** "The bot guesses 11:18 — beat it?" — used where a concrete benchmark time exists. */
export function botGuessTeaser(timeLabel?: string | null): string | null {
  if (!timeLabel) return null;
  return `The bot guesses ${timeLabel} — beat it?`;
}

/** "The bot's read: 22 min. Think you're closer?" — used for a live ETA string. */
export function botEtaTeaser(etaLabel?: string | null): string | null {
  if (!etaLabel) return null;
  return `The bot's read: ${etaLabel}. Think you're closer?`;
}
