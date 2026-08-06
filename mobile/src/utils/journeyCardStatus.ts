/**
 * Pure status/label logic for Journey Home cards.
 *
 * Deliberately free of React and react-native imports so it can be unit tested
 * directly — the rendering side (colours, styles) stays in ActivePredictionCard.
 */

export const SETTLED_STATUSES = ['result_ready', 'completed', 'reached', 'cancelled'];
export const ENDED_JOURNEY_STATUSES = [
  'auto_closed',
  'abandoned',
  'plan_changed',
  'cancelled_by_host',
];

/**
 * Journey Home cards sit three-across in a grid, so each one is ~370px wide and
 * the route line only has room for roughly two lines. 16 characters per place
 * keeps "A → B" inside that budget; the untruncated labels remain on the room
 * screen itself.
 */
export const JOURNEY_HOME_PLACE_MAX = 16;

export type JourneyPillTone = 'live' | 'wait' | 'done' | 'neutral';

export function capWithEllipsis(text: string, max: number) {
  const value = text.trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Takes the first comma-separated component of a place label, then caps it. */
export function shortenJourneyPlaceLabel(label?: string | null, max = 24) {
  const raw = (label ?? '').trim();
  if (!raw) return '';
  const [primary] = raw.split(',').map((part) => part.trim()).filter(Boolean);
  return capWithEllipsis(primary || raw, max);
}

export function formatJourneyRoute(
  startLabel?: string | null,
  destinationLabel?: string | null,
  max?: number,
) {
  const start = shortenJourneyPlaceLabel(startLabel, max) || 'Start';
  const destination = shortenJourneyPlaceLabel(destinationLabel, max) || 'Destination';
  return `${start} → ${destination}`;
}

/**
 * Status pill tone. Three meanings map to three accents and are used the same way
 * everywhere: green = running now, orange = waiting on the viewer, cyan = settled.
 * Anything else is neutral and leans on the card's status sentence instead.
 */
export function journeyPillTone(status: string, hasSubmittedPrediction: boolean): JourneyPillTone {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'live') return 'live';
  if (SETTLED_STATUSES.includes(normalized)) return 'done';
  if (normalized === 'predictions_open' && !hasSubmittedPrediction) return 'wait';
  return 'neutral';
}

/**
 * Short pill label. The pill is a glanceable state marker, so it stays two words
 * at most — the full sentence still renders under it as the card's status line
 * whenever the pill doesn't already say it.
 */
export function journeyPillLabel(
  tone: JourneyPillTone,
  status: string,
  hasSubmittedPrediction: boolean,
  journeyStatus?: string | null,
): string {
  if (tone === 'live') return 'Live';
  if (tone === 'done') return 'Result ready';
  if (tone === 'wait') return 'Waiting';

  const normalized = String(status ?? '').toLowerCase();
  const journey = String(journeyStatus ?? '').toLowerCase();
  if (normalized === 'predictions_open' && hasSubmittedPrediction) return 'Locked in';
  if (normalized === 'predictions_locked') return 'Closed';
  if (ENDED_JOURNEY_STATUSES.includes(journey)) return 'Ended';
  return 'Ready';
}

/**
 * The card only prints its full status sentence when the pill's short label
 * doesn't already convey it — otherwise "Result ready" appeared twice in a row.
 */
export function shouldShowStatusSentence(tone: JourneyPillTone) {
  return tone === 'neutral';
}
