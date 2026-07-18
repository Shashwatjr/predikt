import api from './api';
import { keyValueStore } from './keyValueStore';
import type { StoredSession } from './authStorage';

/**
 * Device-stored guest key. Sent on subsequent guest joins so the backend
 * recognises a returning guest and reuses their user row (and scoring history).
 */
const GUEST_KEY_STORAGE = 'predikt.guest.key.v1';

export async function getStoredGuestKey(): Promise<string | null> {
  try {
    return await keyValueStore.getItem(GUEST_KEY_STORAGE);
  } catch {
    return null;
  }
}

async function persistGuestKey(guestKey: string | null | undefined) {
  if (!guestKey) return;
  try {
    await keyValueStore.setItem(GUEST_KEY_STORAGE, guestKey);
  } catch {
    // Non-fatal: the guest simply won't be recognised on their next visit.
  }
}

/**
 * Creates (or reuses, via the stored guest key) a guest session so someone who
 * tapped an invite link can predict without registering. Returns a session
 * shaped like a normal auth session, ready to hand to AuthContext.login().
 */
export async function createGuestSession(
  handle: string,
  roomId?: string,
): Promise<StoredSession> {
  const guestKey = await getStoredGuestKey();
  const res = await api.post('/auth/guest', {
    handle: handle.trim(),
    ...(guestKey ? { guestKey } : {}),
    ...(roomId ? { roomId } : {}),
  });

  await persistGuestKey(res.data?.guestKey);

  return {
    accessToken: res.data.accessToken,
    accessTokenExpiresAt: res.data.accessTokenExpiresAt,
    refreshToken: res.data.refreshToken,
    refreshTokenExpiresAt: res.data.refreshTokenExpiresAt,
    user: res.data.user,
  };
}
