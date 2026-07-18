import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PENDING_JOIN_CODE_KEY = 'predikt.pendingJoinCode.v1';

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

/**
 * Resolves the invite code that should open the join/predict flow. On web, reads
 * `?joinCode=` from the URL (a WhatsApp-tapped link) and strips it afterwards so
 * it fires exactly once; otherwise falls back to a pending code saved during an
 * account login round-trip.
 */
export async function resolveInviteJoinCode(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('joinCode')?.trim().toUpperCase();
      if (code) {
        params.delete('joinCode');
        const query = params.toString();
        window.history.replaceState(
          {},
          '',
          window.location.pathname + (query ? `?${query}` : '') + window.location.hash,
        );
        return code;
      }
    } catch {
      // Fall through to pending storage.
    }
  }
  return consumePendingJoinCode();
}
