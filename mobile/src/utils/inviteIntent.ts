import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  parseInviteTarget,
  selectInviteForLoad,
  type InviteSelection,
} from '../navigation/inviteRouting';

const PENDING_JOIN_CODE_KEY = 'predikt.pendingJoinCode.v1';
const PENDING_FORWARDED_BY_KEY = 'predikt.pendingForwardedBy.v1';
const WEB_INVITE_KEY = 'predikt.webInvite.v1';

export async function savePendingJoinCode(joinCode: string) {
  const normalized = joinCode.trim().toUpperCase();
  if (!normalized) return;
  await AsyncStorage.setItem(PENDING_JOIN_CODE_KEY, normalized);
}

export async function consumePendingJoinCode() {
  const value = await AsyncStorage.getItem(PENDING_JOIN_CODE_KEY);
  if (value) {
    await AsyncStorage.removeItem(PENDING_JOIN_CODE_KEY);
  }
  return value;
}

export async function savePendingForwardedBy(userId: string) {
  const normalized = userId.trim();
  if (!normalized) return;
  await AsyncStorage.setItem(PENDING_FORWARDED_BY_KEY, normalized);
}

function readStoredWebInvite(): InviteSelection | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(WEB_INVITE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { joinCode?: string; forwardedBy?: string | null };
    if (!parsed.joinCode) return null;
    return { joinCode: parsed.joinCode, forwardedBy: parsed.forwardedBy ?? null };
  } catch {
    return null;
  }
}

function writeStoredWebInvite(selection: InviteSelection) {
  if (typeof sessionStorage === 'undefined' || !selection.joinCode) return;
  sessionStorage.setItem(
    WEB_INVITE_KEY,
    JSON.stringify({ joinCode: selection.joinCode, forwardedBy: selection.forwardedBy }),
  );
}

function currentNavigationType() {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return 'navigate';
  }
  const entry = performance.getEntriesByType('navigation')[0] as { type?: string } | undefined;
  return entry?.type ?? 'navigate';
}

function currentWebInvite(): InviteSelection {
  const params = new URLSearchParams(window.location.search);
  const queryCode = params.get('joinCode')?.trim().toUpperCase() || null;
  const parsed = parseInviteTarget(window.location.href);
  return selectInviteForLoad(
    {
      joinCode: queryCode && !parsed.joinCode ? null : parsed.joinCode,
      forwardedBy: parsed.forwardedBy,
    },
    readStoredWebInvite(),
    currentNavigationType(),
  );
}

/**
 * Resolves the `forwardedBy` userId from a forwarded invite link so the join call
 * can record the forward-share chain. The query stays in the URL so a refresh
 * still has it. A login round-trip can also restore the AsyncStorage copy.
 */
export async function resolveForwardedBy(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const selected = currentWebInvite();
      if (selected.joinCode) writeStoredWebInvite(selected);
      if (selected.forwardedBy) return selected.forwardedBy;
    } catch {
      // Fall through to pending storage.
    }
  }
  const value = await AsyncStorage.getItem(PENDING_FORWARDED_BY_KEY);
  if (value) {
    await AsyncStorage.removeItem(PENDING_FORWARDED_BY_KEY);
  }
  return value;
}

/**
 * Resolves the invite code that should open the join/predict flow. On web, reads
 * `?joinCode=` from the URL (a WhatsApp-tapped link) or `/join/:code`. The query
 * is left in place so refresh keeps it. A reload with an empty URL restores the
 * last code from this tab. Account login still uses the pending AsyncStorage copy.
 */
export async function resolveInviteSelection(): Promise<InviteSelection> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const selected = currentWebInvite();
      if (selected.joinCode) {
        writeStoredWebInvite(selected);
        return selected;
      }
    } catch {
      // Fall through to pending storage.
    }
  }
  return { joinCode: await consumePendingJoinCode(), forwardedBy: null };
}

export async function resolveInviteJoinCode(): Promise<string | null> {
  const selected = await resolveInviteSelection();
  return selected.joinCode;
}
