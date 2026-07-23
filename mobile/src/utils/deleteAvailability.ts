/**
 * Formats a room's `deletable.availableAt` (an ISO string from the API) into a
 * short, device-timezone helper line for the disabled Delete button:
 *   • within a day  → "Available in Xh"
 *   • further out   → "Available at <local date/time>"
 * Returns null when there is nothing to show (already available or unset).
 */
export function formatDeleteAvailability(
  availableAt: string | null | undefined,
): string | null {
  if (!availableAt) return null;
  const target = new Date(availableAt).getTime();
  if (Number.isNaN(target)) return null;

  const diffMs = target - Date.now();
  if (diffMs <= 0) return null;

  const hours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (hours <= 24) {
    return `Available in ${hours}h`;
  }

  const local = new Date(target).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return `Available at ${local}`;
}

export default formatDeleteAvailability;
