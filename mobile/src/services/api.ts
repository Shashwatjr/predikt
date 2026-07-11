import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';

/**
 * Expo web and iOS simulator can reach the local API through localhost.
 * Android emulator maps the host machine to 10.0.2.2.
 * Physical devices still need EXPO_PUBLIC_API_BASE_URL set to the laptop's LAN URL.
 */
const DEFAULT_API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

function resolveApiBaseUrl(rawUrl?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000';
    }
  }

  return sanitizeApiBaseUrl(rawUrl);
}

function sanitizeApiBaseUrl(rawUrl?: string) {
  const trimmed = rawUrl?.trim();
  if (!trimmed || /YOUR_MAC_IP|<|>|\s/i.test(trimmed)) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
      return DEFAULT_API_BASE_URL;
    }
    return trimmed.replace(/\/+$/, '');
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

if (__DEV__) {
  console.log('[PREDIKT_API] baseURL', API_BASE_URL);
}

type RefreshSessionResult = {
  accessToken: string;
} | null;

type AuthSessionManager = {
  getAccessToken: () => string | null;
  getAccessTokenExpiresAt: () => string | null;
  getRefreshToken: () => string | null;
  refreshSession: () => Promise<RefreshSessionResult>;
  clearSession: () => Promise<void>;
};

let authSessionManager: AuthSessionManager | null = null;
let inFlightRefresh: Promise<RefreshSessionResult> | null = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 12_000,
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export function registerAuthSessionManager(manager: AuthSessionManager | null) {
  authSessionManager = manager;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const responseMessage = error.response?.data?.message;
  if (Array.isArray(responseMessage)) {
    return responseMessage.join('\n');
  }

  if (typeof responseMessage === 'string') {
    return responseMessage;
  }

  if (error.response?.status === 429) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (error.request && !error.response) {
    return `Could not reach the API at ${API_BASE_URL}. Check that the backend is running and the API URL is reachable from this device.`;
  }

  return fallback;
}

function shouldSkipRefresh(url?: string) {
  if (!url) return false;
  return ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].some((path) =>
    url.includes(path),
  );
}

function isExpiringSoon(expiresAt: string | null) {
  if (!expiresAt) return false;
  const expiryMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryMs)) return false;
  return expiryMs - Date.now() < 60_000;
}

async function refreshViaSessionManager() {
  if (!authSessionManager) {
    return null;
  }

  if (!inFlightRefresh) {
    inFlightRefresh = authSessionManager
      .refreshSession()
      .catch(() => null)
      .finally(() => {
        inFlightRefresh = null;
      });
  }

  return inFlightRefresh;
}

api.interceptors.request.use(async (config) => {
  if (!authSessionManager || shouldSkipRefresh(config.url)) {
    return config;
  }

  const accessToken = authSessionManager.getAccessToken();
  const refreshToken = authSessionManager.getRefreshToken();
  const accessTokenExpiresAt = authSessionManager.getAccessTokenExpiresAt();

  if (!accessToken && !refreshToken) {
    return config;
  }

  if (refreshToken && isExpiringSoon(accessTokenExpiresAt)) {
    const refreshed = await refreshViaSessionManager();
    if (!refreshed?.accessToken) {
      return config;
    }
  }

  const tokenToUse = authSessionManager.getAccessToken();
  if (tokenToUse) {
    const headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);
    headers.set('Authorization', `Bearer ${tokenToUse}`);
    config.headers = headers;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      !authSessionManager ||
      !originalRequest ||
      originalRequest._retry ||
      error.response?.status !== 401 ||
      shouldSkipRefresh(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    if (!authSessionManager.getRefreshToken()) {
      await authSessionManager.clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const refreshed = await refreshViaSessionManager();

    if (!refreshed?.accessToken) {
      await authSessionManager.clearSession();
      return Promise.reject(error);
    }

    const headers =
      originalRequest.headers instanceof AxiosHeaders
        ? originalRequest.headers
        : new AxiosHeaders(originalRequest.headers);
    headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
    originalRequest.headers = headers;

    return api(originalRequest);
  },
);

export default api;
