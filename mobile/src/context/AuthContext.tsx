import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api, { registerAuthSessionManager, setAuthToken } from '../services/api';
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
  StoredSession,
} from '../services/authStorage';

export interface AuthUser {
  userId: string;
  name: string;
  email?: string | null;
  prediktHandle?: string | null;
  profileImage?: string | null;
  totalAura: number;
  weeklyAura: number;
  cloutBalance: number;
  creditBalance?: number;
  avatarKey?: string | null;
  selectedBackgroundKey?: string | null;
  aiPersonalisationOptOut?: boolean;
  currentStreak?: number;
  longestStreak?: number;
  lifetimeCloutEarned?: number;
  winsCount: number;
  predictionsMadeCount?: number;
  roomsCreatedCount?: number;
  predictionAccuracyScore?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshToken: string | null;
  refreshTokenExpiresAt: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (session: StoredSession) => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<{ accessToken: string } | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ApplySessionOptions = {
  persist?: boolean;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accessTokenExpiresAt, setAccessTokenExpiresAt] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [refreshTokenExpiresAt, setRefreshTokenExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<StoredSession | null>(null);
  const mountedRef = useRef(false);
  const isAuthenticated = !!accessToken && !!user;

  const applySession = useCallback(async (session: StoredSession, options: ApplySessionOptions = {}) => {
    if (!mountedRef.current) {
      throw new Error('Auth provider is not mounted');
    }

    if (options.persist !== false) {
      await saveStoredSession(session);
    }

    if (!mountedRef.current) {
      throw new Error('Auth provider is not mounted');
    }

    sessionRef.current = session;
    setUser(session.user);
    setAccessToken(session.accessToken);
    setAccessTokenExpiresAt(session.accessTokenExpiresAt);
    setRefreshToken(session.refreshToken);
    setRefreshTokenExpiresAt(session.refreshTokenExpiresAt);
    setAuthToken(session.accessToken);
  }, []);

  const clearSessionState = useCallback(async () => {
    sessionRef.current = null;

    if (mountedRef.current) {
      setUser(null);
      setAccessToken(null);
      setAccessTokenExpiresAt(null);
      setRefreshToken(null);
      setRefreshTokenExpiresAt(null);
    }

    setAuthToken(null);
    await clearStoredSession();
  }, []);

  const login = useCallback(async (session: StoredSession) => {
    await applySession(session);
  }, [applySession]);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      const nextUser = { ...currentUser, ...patch };
      if (sessionRef.current) {
        const nextSession = { ...sessionRef.current, user: nextUser };
        sessionRef.current = nextSession;
        void saveStoredSession(nextSession);
      }
      return nextUser;
    });
  }, []);

  const refreshSession = useCallback(async () => {
    const currentSession = sessionRef.current;
    const currentRefreshToken = currentSession?.refreshToken;

    if (!currentRefreshToken) {
      return null;
    }

    try {
      const response = await api.post('/auth/refresh', {
        refreshToken: currentRefreshToken,
      });

      const nextSession: StoredSession = {
        accessToken: response.data.accessToken,
        accessTokenExpiresAt: response.data.accessTokenExpiresAt,
        refreshToken: response.data.refreshToken,
        refreshTokenExpiresAt: response.data.refreshTokenExpiresAt,
        user: response.data.user,
      };

      await applySession(nextSession);
      return { accessToken: nextSession.accessToken };
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 401 || status === 403) {
        await clearSessionState();
      }
      return null;
    }
  }, [applySession, clearSessionState]);

  const logout = useCallback(async () => {
    const currentRefreshToken = sessionRef.current?.refreshToken;

    if (currentRefreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken: currentRefreshToken });
      } catch {
        // Local cleanup must still succeed if the session was already revoked or expired.
      }
    }

    await clearSessionState();
  }, [clearSessionState]);

  useEffect(() => {
    mountedRef.current = true;

    async function restoreSession() {
      try {
        const storedSession = await loadStoredSession();
        if (!mountedRef.current) return;

        if (!storedSession) {
          setIsLoading(false);
          return;
        }

        const accessExpiryMs = new Date(storedSession.accessTokenExpiresAt).getTime();
        const refreshExpiryMs = new Date(storedSession.refreshTokenExpiresAt).getTime();

        if (Number.isNaN(refreshExpiryMs)) {
          await clearSessionState();
          if (mountedRef.current) setIsLoading(false);
          return;
        }

        await applySession(storedSession, { persist: false });

        if (
          Number.isNaN(accessExpiryMs) ||
          accessExpiryMs <= Date.now() ||
          refreshExpiryMs <= Date.now()
        ) {
          await refreshSession();
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      mountedRef.current = false;
    };
  }, [applySession, clearSessionState, refreshSession]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[PREDIKT_AUTH] authenticated', isAuthenticated);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    registerAuthSessionManager({
      getAccessToken: () => sessionRef.current?.accessToken ?? accessToken,
      getAccessTokenExpiresAt: () =>
        sessionRef.current?.accessTokenExpiresAt ?? accessTokenExpiresAt,
      getRefreshToken: () => sessionRef.current?.refreshToken ?? refreshToken,
      refreshSession,
      clearSession: clearSessionState,
    });

    return () => {
      registerAuthSessionManager(null);
    };
  }, [
    accessToken,
    accessTokenExpiresAt,
    clearSessionState,
    refreshSession,
    refreshToken,
  ]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      isAuthenticated,
      isLoading,
      login,
      updateUser,
      logout,
      refreshSession,
    }),
    [
      user,
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      isAuthenticated,
      isLoading,
      login,
      updateUser,
      logout,
      refreshSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
