import { Platform } from 'react-native';

const CANONICAL_WEB_BASE_URL = 'https://myprediktion.com';

type SafePreview = {
  roomTitle?: string;
  title?: string;
  question?: string;
  answerType?: string;
  category?: string;
  templateKey?: string;
  roomCategory?: string;
  inviteCode?: string;
  predictionCloseTime?: string;
  lockTime?: string;
  route?: {
    privacyMode?: string;
  } | null;
  routeSummary?: {
    startLabel?: string;
    destinationLabel?: string;
    travelMode?: string;
  } | null;
};

function getWebBaseUrl() {
  const envBase = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/+$/, '');
  const host = typeof window !== 'undefined' ? window.location?.hostname?.toLowerCase() ?? '' : '';
  if (host === 'myprediktion.com' || host === 'www.myprediktion.com') {
    return CANONICAL_WEB_BASE_URL;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return Platform.OS === 'web' ? CANONICAL_WEB_BASE_URL : 'http://localhost:8081';
}

export function buildInviteUrl(inviteCode: string, forwardedBy?: string | null) {
  const base = `${getWebBaseUrl()}?joinCode=${encodeURIComponent(inviteCode)}`;
  // When a non-creator forwards the link, tag it so the backend can record the
  // forward-share chain and credit the creator's "X invited N friends" banner.
  return forwardedBy ? `${base}&forwardedBy=${encodeURIComponent(forwardedBy)}` : base;
}

/**
 * Multi-recipient share: prefer the Web Share API where supported (lets the user
 * pick a WhatsApp group or any target); otherwise return false so the caller can
 * fall back to a prominent copy-the-link "paste in your group chat" path. We do
 * NOT attempt a native contact picker on web.
 */
export async function shareViaWebShareApi(payload: {
  shareTitle: string;
  shareText: string;
  inviteUrl: string;
}): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { share?: unknown }).share === 'function'
  ) {
    try {
      await (navigator as Navigator & {
        share: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
      }).share({ title: payload.shareTitle, text: payload.shareText, url: payload.inviteUrl });
      return true;
    } catch {
      // User cancelled or share failed — caller falls back to copy-the-link.
      return false;
    }
  }
  return false;
}

function safeChallengeLine(room: SafePreview) {
  const category = room.category ?? room.templateKey;
  if (category === 'weather_rain') return 'Beat the Forecast with me.';
  if (category === 'food_eta') return 'Beat the ETA with me.';
  if (category === 'open_prediction') return 'Join my Wild Cards room and make your call.';
  if (category === 'whos_late') return 'Friendly group arrival challenge.';
  if (category === 'gym_habit') return 'Positive habit challenge.';
  if (room.routeSummary) {
    return 'Predict this journey outcome with me.';
  }
  return room.question || 'Predict what happens next with me.';
}

function formatLockTime(room: SafePreview) {
  const value = room.lockTime || room.predictionCloseTime;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function buildSharePayload(room: SafePreview, forwardedBy?: string | null) {
  const category = room.category ?? room.templateKey;
  const inviteCode = room.inviteCode ?? '';
  const title = room.roomTitle ?? room.title ?? 'My Prediktion room';
  const inviteUrl = buildInviteUrl(inviteCode, forwardedBy);
  const lockTime = formatLockTime(room);
  const body = [
    `Join my room on My Prediktion: ${title}`,
    safeChallengeLine(room),
    category === 'open_prediction' ? 'Best call earns Gems. Late heat is pure Rizz.' : 'Closest guess wins Aura.',
    `Room code: ${inviteCode}`,
    lockTime ? `Lock time: ${lockTime}` : null,
    `Open: ${inviteUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    inviteUrl,
    shareTitle: title,
    shareText: body,
    copyText: body,
    instagramCaption: body,
    whatsappText: body,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(body)}`,
  };
}

export function buildManualWhatsAppUrl(phoneNumber: string, text: string) {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  const normalized = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export function isValidManualPhone(phoneNumber: string) {
  return /^\+?\d{8,15}$/.test(phoneNumber.trim());
}
