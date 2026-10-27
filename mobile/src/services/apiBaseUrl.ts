export const PRODUCTION_WEB_API_BASE_URL =
  'https://predikt-api-676327407919.asia-southeast1.run.app';

export function resolveApiBaseUrl(
  rawUrl: string | undefined,
  options: { platform: string; hostname?: string | null; fallback: string },
) {
  const hostname = options.hostname?.trim().toLowerCase() ?? '';
  if (options.platform === 'web' && hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return PRODUCTION_WEB_API_BASE_URL;
  }

  return sanitizeApiBaseUrl(rawUrl, options.fallback);
}

function sanitizeApiBaseUrl(rawUrl: string | undefined, fallback: string) {
  const trimmed = rawUrl?.trim();
  if (!trimmed || /YOUR_MAC_IP|<|>|\s/i.test(trimmed)) return fallback;

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return fallback;
    return trimmed.replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}
