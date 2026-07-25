/**
 * Helpers for turning long OSM/Nominatim `display_name` labels into short,
 * human-friendly display strings for room titles and prediction questions.
 *
 * OSM `display_name` is comma-separated, most-specific first, e.g.
 *   "Cubbon Park, Sampangi Rama Nagara, Bengaluru, Bangalore Urban, Karnataka, 560001, India"
 * The primary place name is the first segment; postal code and country are the
 * trailing segments. We keep the primary name, drop postal + country noise, and
 * hard-cap the result so it can never overflow the create-room validators
 * (title <= 120, question <= 160). The full label is still persisted verbatim on
 * the room record (startingPointLabel / destinationLabel) — this only shapes the
 * generated display strings.
 */

const ELLIPSIS = '…';

/** True when a label segment is only a postal code (digits, spaces, hyphens). */
function isPostalCode(segment: string): boolean {
  return /^\d[\d\s-]*\d$/.test(segment) || /^\d+$/.test(segment);
}

/**
 * Shorten an OSM comma-separated place label: keep the primary (most-specific)
 * place name, drop the trailing country and any trailing postal codes. Always
 * preserves at least the primary name so callers never get an empty string.
 */
export function shortenPlaceLabel(label: string | null | undefined): string {
  const raw = (label ?? '').trim();
  if (!raw) return '';

  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) return raw;

  const kept = [...parts];

  // Drop the trailing country segment (last part) — but only if doing so still
  // leaves the primary name plus at least one locality segment.
  if (kept.length >= 3) {
    kept.pop();
  }

  // Drop trailing postal codes, never dropping the primary name (index 0).
  while (kept.length > 1 && isPostalCode(kept[kept.length - 1])) {
    kept.pop();
  }

  return kept.join(', ');
}

/**
 * Hard-cap a string to `max` characters, appending an ellipsis when truncated.
 * The returned string length never exceeds `max`.
 */
export function capWithEllipsis(text: string, max: number): string {
  const value = (text ?? '').trim();
  if (max <= 0) return '';
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + ELLIPSIS;
}
