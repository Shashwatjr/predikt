import { Linking, Platform } from 'react-native';
import { buildInviteShareCard, normalizeWebBaseUrl } from '../share/shareCard';

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

export function currentShareWebBaseUrl() {
  return getWebBaseUrl();
}

function getWebBaseUrl() {
  const envBase = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim();
  if (envBase) return normalizeWebBaseUrl(envBase);
  const host = typeof window !== 'undefined' ? window.location?.hostname?.toLowerCase() ?? '' : '';
  if (host === 'myprediktion.com' || host === 'www.myprediktion.com') {
    return CANONICAL_WEB_BASE_URL;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return CANONICAL_WEB_BASE_URL;
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

function formatLockTime(room: SafePreview) {
  const value = room.lockTime || room.predictionCloseTime;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function buildSharePayload(room: SafePreview, forwardedBy?: string | null) {
  const inviteCode = room.inviteCode ?? '';
  const lockTime = formatLockTime(room);
  const card = buildInviteShareCard({
    inviteCode,
    webBaseUrl: getWebBaseUrl(),
    forwardedBy,
    lockLabel: lockTime,
  });
  const body = card.text;

  return {
    inviteUrl: card.url,
    shareTitle: card.title,
    shareText: body,
    copyText: body,
    instagramCaption: body,
    whatsappText: body,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(body)}`,
    telegramUrl: `https://t.me/share/url?url=${encodeURIComponent(card.url)}&text=${encodeURIComponent(body.replace(`Open: ${card.url}`, '').trim())}`,
    twitterUrl: `https://twitter.com/intent/tweet?url=${encodeURIComponent(card.url)}&text=${encodeURIComponent(body.replace(`Open: ${card.url}`, '').trim())}`,
    facebookUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(card.url)}`,
    smsUrl: `sms:?body=${encodeURIComponent(body)}`,
    emailUrl: `mailto:?subject=${encodeURIComponent(card.title)}&body=${encodeURIComponent(body)}`,
  };
}

/** A resolved openURL means only that the OS accepted the request, not that a message was sent. */
export async function openShareUrl(url: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // RN Web's Linking ignores a blocked popup. Keep a handle so we can report failure.
      const popup = window.open('about:blank', '_blank');
      if (!popup) return false;
      popup.opener = null;
      popup.location.href = url;
    } else {
      await Linking.openURL(url);
    }
    return true;
  } catch {
    return false;
  }
}

export async function openWhatsAppWithText(text: string): Promise<boolean> {
  return openShareUrl(`https://wa.me/?text=${encodeURIComponent(text)}`);
}

export function buildManualWhatsAppUrl(phoneNumber: string, text: string) {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  const normalized = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export function isValidManualPhone(phoneNumber: string) {
  return /^\+?\d{8,15}$/.test(phoneNumber.trim());
}
