/** Coordinate-only labels are not human-readable place names. Keep real addresses verbatim. */
export function safeLocationLabel(value: string, key = ''): string {
  const number = '[+-]?\\d{1,3}(?:\\.\\d+)?';
  const component = `${number}\\s*(?:°\\s*)?(?:[NSEW])?`;
  const pair = new RegExp(`^(?:geo:|loc:)?\\s*[\\[(]?\\s*(?:lat(?:itude)?\\s*[:=]\\s*)?${component}\\s*[,;]\\s*(?:(?:lon(?:gitude)?|lng)\\s*[:=]\\s*)?${component}\\s*[\\])]?\\s*$`, 'i');
  const point = new RegExp(`^POINT\\s*\\(\\s*${number}\\s+${number}\\s*\\)$`, 'i');
  const spaced = /^[+-]?\d{1,3}\.\d+\s+[+-]?\d{1,3}\.\d+$/;
  const dms = /^\d{1,3}°\s*\d{1,2}['′]\s*\d{1,2}(?:\.\d+)?["″]\s*[NS]\s*[,; ]+\s*\d{1,3}°\s*\d{1,2}['′]\s*\d{1,2}(?:\.\d+)?["″]\s*[EW]$/i;
  const text = value.trim();
  if (![pair, point, spaced, dms].some((pattern) => pattern.test(text))) return value;
  return /start|origin/i.test(key) ? 'Selected start'
    : /destination|end/i.test(key) ? 'Selected destination' : 'Selected location';
}

/** Project old stored labels as well as new data without changing stored records. */
export function safeLocationLabels<T>(value: T, key = ''): T {
  if (typeof value === 'string') return safeLocationLabel(value, key) as T;
  if (Array.isArray(value)) return value.map((entry) => safeLocationLabels(entry, key)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([name, entry]) =>
      [name, safeLocationLabels(entry, name)])) as T;
  }
  return value;
}
