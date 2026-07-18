import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthUser } from '../context/AuthContext';

export interface StoredSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: AuthUser;
}

const SESSION_STORAGE_KEY = 'predikt.auth.session.v1';
const SESSION_METADATA_STORAGE_KEY = 'predikt.auth.session.metadata.v1';
const ACCESS_TOKEN_STORAGE_KEY = 'predikt.auth.accessToken.v1';
const REFRESH_TOKEN_STORAGE_KEY = 'predikt.auth.refreshToken.v1';

type StoredSessionMetadata = Pick<
  StoredSession,
  'accessTokenExpiresAt' | 'refreshTokenExpiresAt' | 'user'
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!isRecord(value) || !isRecord(value.user)) return false;
  return (
    typeof value.accessToken === 'string' &&
    typeof value.accessTokenExpiresAt === 'string' &&
    typeof value.refreshToken === 'string' &&
    typeof value.refreshTokenExpiresAt === 'string' &&
    typeof value.user.userId === 'string' &&
    typeof value.user.name === 'string'
  );
}

function parseStoredSession(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseNativeSessionMetadata(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.user)) return null;
    if (
      typeof parsed.accessTokenExpiresAt !== 'string' ||
      typeof parsed.refreshTokenExpiresAt !== 'string' ||
      typeof parsed.user.userId !== 'string' ||
      typeof parsed.user.name !== 'string'
    ) {
      return null;
    }

    return parsed as StoredSessionMetadata;
  } catch {
    return null;
  }
}

async function readWebSession() {
  return AsyncStorage.getItem(SESSION_STORAGE_KEY);
}

async function writeWebSession(serialized: string) {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, serialized);
}

async function clearWebSession() {
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
}

async function readNativeSession(): Promise<StoredSession | null> {
  const [metadataRaw, accessToken, refreshToken] = await Promise.all([
    AsyncStorage.getItem(SESSION_METADATA_STORAGE_KEY),
    SecureStore.getItemAsync(ACCESS_TOKEN_STORAGE_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY),
  ]);
  const metadata = parseNativeSessionMetadata(metadataRaw);

  if (metadata && accessToken && refreshToken) {
    return { ...metadata, accessToken, refreshToken };
  }

  const legacySession = parseStoredSession(await SecureStore.getItemAsync(SESSION_STORAGE_KEY));
  if (legacySession) {
    try {
      await writeNativeSession(legacySession);
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
      return legacySession;
    } catch {
      // Migration failed (e.g. keychain write error); fall back to the legacy
      // session as-is rather than losing the user's sign-in state.
      return legacySession;
    }
  }

  if (metadataRaw || accessToken || refreshToken) {
    await clearNativeSession();
  }

  return null;
}

async function writeNativeSession(session: StoredSession) {
  const metadata: StoredSessionMetadata = {
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    user: session.user,
  };

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_STORAGE_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken),
  ]);
  await AsyncStorage.setItem(SESSION_METADATA_STORAGE_KEY, JSON.stringify(metadata));
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

async function clearNativeSession() {
  await Promise.all([
    AsyncStorage.removeItem(SESSION_METADATA_STORAGE_KEY),
    SecureStore.deleteItemAsync(ACCESS_TOKEN_STORAGE_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY),
    SecureStore.deleteItemAsync(SESSION_STORAGE_KEY),
  ]);
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  if (Platform.OS !== 'web') {
    return readNativeSession();
  }

  const session = parseStoredSession(await readWebSession());
  if (!session) {
    await clearStoredSession();
    return null;
  }

  return session;
}

export async function saveStoredSession(session: StoredSession) {
  const serialized = JSON.stringify(session);
  if (Platform.OS === 'web') {
    await writeWebSession(serialized);
    return;
  }
  await writeNativeSession(session);
}

export async function clearStoredSession() {
  if (Platform.OS === 'web') {
    await clearWebSession();
    return;
  }
  await clearNativeSession();
}

export const authStorageMetadata = {
  sessionStorageKey: SESSION_STORAGE_KEY,
  nativeMetadataStorageKey: SESSION_METADATA_STORAGE_KEY,
  nativeStorage: 'expo-secure-store',
  nativeMetadataStorage: '@react-native-async-storage/async-storage',
  webStorage: '@react-native-async-storage/async-storage',
} as const;
