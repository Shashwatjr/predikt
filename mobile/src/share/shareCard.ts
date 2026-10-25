const CANONICAL_WEB_BASE_URL = 'https://myprediktion.com';

const BLOCKED_KEY = /lat|lng|longitude|latitude|token|authorization|password|secret|coordinate/i;
const BLOCKED_TEXT = /bearer\s|access[_-]?token|refresh[_-]?token|latitude|longitude/i;

export type ShareCard = {
  title: string;
  text: string;
  url: string;
  revealPlaces: boolean;
};

function cleanCode(inviteCode: string) {
  return inviteCode.trim().toUpperCase();
}

export function normalizeWebBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (/^https:\/\/www\.myprediktion\.com$/i.test(trimmed)) return CANONICAL_WEB_BASE_URL;
  return trimmed;
}

export function buildInviteUrl(webBaseUrl: string, inviteCode: string, forwardedBy?: string | null) {
  const base = `${normalizeWebBaseUrl(webBaseUrl)}?joinCode=${encodeURIComponent(cleanCode(inviteCode))}`;
  return forwardedBy ? `${base}&forwardedBy=${encodeURIComponent(forwardedBy)}` : base;
}

function safeLine(value?: string | null) {
  const text = value?.trim();
  if (!text || BLOCKED_TEXT.test(text)) return null;
  return text;
}

export function buildInviteShareCard(input: {
  inviteCode: string;
  webBaseUrl: string;
  forwardedBy?: string | null;
  lockLabel?: string | null;
  revealPlaces?: boolean;
  startLabel?: string | null;
  destinationLabel?: string | null;
}): ShareCard {
  const revealPlaces = input.revealPlaces === true;
  const url = buildInviteUrl(input.webBaseUrl, input.inviteCode, input.forwardedBy);
  const lines = [
    'Join a room on My Prediktion.',
    'Exact location is hidden.',
    revealPlaces ? safeLine(input.startLabel ? `From ${input.startLabel}` : null) : null,
    revealPlaces ? safeLine(input.destinationLabel ? `To ${input.destinationLabel}` : null) : null,
    `Room code: ${cleanCode(input.inviteCode)}`,
    safeLine(input.lockLabel ? `Lock time: ${input.lockLabel}` : null),
    `Open: ${url}`,
  ].filter((line): line is string => !!line);

  return {
    title: 'Join a room on My Prediktion',
    text: lines.join('\n'),
    url,
    revealPlaces,
  };
}

export function buildResultShareCard(input: {
  inviteCode: string;
  webBaseUrl: string;
  outcome?: string | null;
  forwardedBy?: string | null;
}): ShareCard {
  const url = buildInviteUrl(input.webBaseUrl, input.inviteCode, input.forwardedBy);
  const outcome = safeLine(input.outcome);
  const lines = [
    'My Prediktion result',
    outcome,
    'Exact location is hidden.',
    `Room code: ${cleanCode(input.inviteCode)}`,
    `Open: ${url}`,
  ].filter((line): line is string => !!line);
  return {
    title: 'My Prediktion result',
    text: lines.join('\n'),
    url,
    revealPlaces: false,
  };
}

export function omitProtectedShareFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => omitProtectedShareFields(item));
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (BLOCKED_KEY.test(key)) continue;
    if (key === 'startLabel' || key === 'destinationLabel' || key === 'question') continue;
    next[key] = omitProtectedShareFields(entry);
  }
  return next;
}
