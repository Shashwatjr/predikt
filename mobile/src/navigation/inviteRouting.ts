/**
 * Invite URL parsing and entry states.
 * AppNavigator stays unchanged. The integration owner can pass
 * inviteStateFromPath to NavigationContainer linking.getStateFromPath.
 */

export type InviteEntryState =
  | 'invalid'
  | 'expired'
  | 'closed'
  | 'private'
  | 'open'
  | 'watch'
  | 'completed';

export type InviteSelection = {
  joinCode: string | null;
  forwardedBy: string | null;
};

export type InvitePreviewShape = {
  status?: string | null;
  visibility?: string | null;
  journeyStatus?: string | null;
  lockTime?: string | null;
  predictionCloseTime?: string | null;
  safePreview?: {
    status?: string | null;
    visibility?: string | null;
    journeyStatus?: string | null;
    noStartCutoffAt?: string | null;
    cancelledAt?: string | null;
    autoClosedAt?: string | null;
  } | null;
};

export type InviteEntry = {
  state: InviteEntryState;
  title: string;
  body: string;
  allowJoin: boolean;
};

const INVITE_CODE = /^[A-Z0-9]{4,12}$/;
const ENDED_JOURNEY = new Set([
  'auto_closed',
  'abandoned',
  'plan_changed',
  'cancelled_by_host',
  'cancelled',
]);

export function parseInviteTarget(input: string): InviteSelection {
  const url = new URL(input, 'http://localhost');
  const params = new URLSearchParams(url.search);
  const queryCode = params.get('joinCode')?.trim().toUpperCase() ?? '';
  let joinCode = queryCode;
  const parts = url.pathname.split('/').filter(Boolean);
  if (!joinCode && parts[0]?.toLowerCase() === 'join' && parts[1]) {
    joinCode = decodeURIComponent(parts[1]).trim().toUpperCase();
  }
  if (joinCode && !INVITE_CODE.test(joinCode)) joinCode = '';

  const forwardedRaw = params.get('forwardedBy')?.trim() ?? '';
  const forwardedBy =
    forwardedRaw &&
    forwardedRaw.length <= 80 &&
    !/[\s<>]/.test(forwardedRaw) &&
    !/token|bearer|secret/i.test(forwardedRaw)
      ? forwardedRaw
      : null;

  return { joinCode: joinCode || null, forwardedBy };
}

export function selectInviteForLoad(
  fromUrl: InviteSelection,
  stored: InviteSelection | null,
  navigationType: string,
): InviteSelection {
  if (fromUrl.joinCode) {
    const sameRoom = stored?.joinCode === fromUrl.joinCode;
    return {
      joinCode: fromUrl.joinCode,
      forwardedBy: fromUrl.forwardedBy ?? (sameRoom ? stored?.forwardedBy ?? null : null),
    };
  }
  if (navigationType === 'reload' && stored?.joinCode) return stored;
  return { joinCode: null, forwardedBy: null };
}

function normalizeStatus(status?: string | null) {
  const value = (status ?? '').toLowerCase();
  return value === 'prediction_open' ? 'predictions_open' : value;
}

function past(value: string | null | undefined, now: number) {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time < now;
}

export function classifyInvitePreview(
  preview: InvitePreviewShape | null,
  httpStatus?: number,
  now = Date.now(),
): InviteEntryState {
  if (!preview || httpStatus === 400 || httpStatus === 404) return 'invalid';
  const status = normalizeStatus(preview.status ?? preview.safePreview?.status);
  const journey = (preview.journeyStatus ?? preview.safePreview?.journeyStatus ?? '').toLowerCase();
  const visibility = (preview.visibility ?? preview.safePreview?.visibility ?? '').toLowerCase();
  const ended = ENDED_JOURNEY.has(journey);
  if (
    status !== 'completed' &&
    (status === 'cancelled' ||
      ended ||
      !!preview.safePreview?.cancelledAt ||
      !!preview.safePreview?.autoClosedAt)
  ) {
    return 'closed';
  }
  const neverStarted = status === 'created' || status === '';
  if (
    status === 'expired' ||
    journey === 'expired' ||
    (neverStarted &&
      (past(preview.lockTime, now) ||
        past(preview.predictionCloseTime, now) ||
        past(preview.safePreview?.noStartCutoffAt, now)))
  ) {
    return 'expired';
  }
  if (visibility === 'private') return 'private';
  if (status === 'completed') return 'completed';
  if (status === 'live' || status === 'predictions_locked') return 'watch';
  if (status === 'predictions_open' || status === 'created') return 'open';
  return 'closed';
}

export function describeInviteEntry(input: {
  preview: InvitePreviewShape | null;
  httpStatus?: number;
  now?: number;
}): InviteEntry {
  const state = classifyInvitePreview(input.preview, input.httpStatus, input.now);
  if (state === 'invalid') {
    return {
      state,
      title: 'Room unavailable',
      body: 'No room with that invite code. Check it and try again.',
      allowJoin: false,
    };
  }
  if (state === 'expired') {
    return {
      state,
      title: 'Invite expired',
      body: 'This invite has expired.',
      allowJoin: false,
    };
  }
  if (state === 'closed') {
    return {
      state,
      title: 'Room closed',
      body: 'This room is closed.',
      allowJoin: false,
    };
  }
  if (state === 'private') {
    return {
      state,
      title: 'Private room',
      body: 'This room is private.',
      allowJoin: false,
    };
  }
  if (state === 'watch') {
    return {
      state,
      title: 'Predictions closed',
      body: 'Predictions are closed. You can still open the room.',
      allowJoin: true,
    };
  }
  if (state === 'completed') {
    return {
      state,
      title: 'Result ready',
      body: 'This room has a result.',
      allowJoin: true,
    };
  }
  return {
    state,
    title: 'Join the room',
    body: 'You can join this room.',
    allowJoin: true,
  };
}

export function readHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const status = (error as { response?: { status?: unknown } }).response?.status;
  return typeof status === 'number' ? status : undefined;
}

/** Plain state for a future NavigationContainer linking.getStateFromPath. */
export function inviteStateFromPath(path: string) {
  const parsed = parseInviteTarget(path);
  if (!parsed.joinCode) return null;
  return {
    routes: [{ name: 'JoinRoom' as const, params: { joinCode: parsed.joinCode } }],
  };
}
