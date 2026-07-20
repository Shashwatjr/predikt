import { Platform } from 'react-native';
import { getRoomTheme } from '../config/categoryTheme';

type SafePreview = {
  roomTitle?: string;
  title?: string;
  question?: string;
  answerType?: string;
  category?: string;
  templateKey?: string;
  roomCategory?: string;
  subtype?: string | null;
  scoringRule?: any;
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
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'http://localhost:8081';
}

export function buildInviteUrl(inviteCode: string) {
  return `${getWebBaseUrl()}?joinCode=${encodeURIComponent(inviteCode)}`;
}

function safeChallengeLine(room: SafePreview) {
  const category = room.category ?? room.templateKey;
  if (category === 'weather_rain') return 'Beat the Forecast with me.';
  if (category === 'food_eta') return 'Beat the ETA with me.';
  if (category === 'open_prediction') {
    return `Join my ${getRoomTheme(room).label} room and make your call.`;
  }
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

export function buildSharePayload(room: SafePreview) {
  const category = room.category ?? room.templateKey;
  const inviteCode = room.inviteCode ?? '';
  const title = room.roomTitle ?? room.title ?? 'PREDIKT Room';
  const inviteUrl = buildInviteUrl(inviteCode);
  const lockTime = formatLockTime(room);
  const body = [
    `Join my PREDIKT room: ${title}`,
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
