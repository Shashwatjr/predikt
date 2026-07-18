import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminApi, getAdminApiErrorMessage, setAdminAuthToken } from '../services/adminApi';
import type { AdminUser } from '../types/admin';

const ADMIN_SESSION_KEY = 'predikt.admin.session.v1';
const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

type AdminSession = {
  accessToken: string;
  admin: AdminUser;
};

type AdminAuthContextValue = {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(async () => {
    setAdmin(null);
    setAdminAuthToken(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
      if (window.location.pathname.startsWith('/admin')) {
        window.location.assign('/admin');
      }
    }
  }, []);

  const restore = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;
      const raw = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw) as AdminSession;
      setAdminAuthToken(session.accessToken);
      const me = await adminApi.get<AdminUser>('/admin/me');
      setAdmin(me.data);
    } catch {
      await clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    const interceptor = adminApi.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status;
        const message: string = error?.response?.data?.message ?? '';
        // 401 = expired/invalid token or a disabled admin (AdminAuthGuard). 403 with
        // "Admin access required" = the account lost portal access entirely (role
        // revoked / user token). Both mean the session is dead → sign out.
        // A 403 "Missing required admin permission" only denies THAT action, so the
        // session stays and the screen surfaces the error instead of logging out.
        if (status === 401 || (status === 403 && /admin access required/i.test(message))) {
          await clearSession();
        }
        throw error;
      },
    );
    return () => {
      adminApi.interceptors.response.eject(interceptor);
    };
  }, [clearSession]);

  useEffect(() => {
    if (typeof window === 'undefined' || !admin) return;

    let timeoutId: number | undefined;
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void clearSession();
      }, ADMIN_IDLE_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll'];
    for (const eventName of events) {
      window.addEventListener(eventName, resetTimer, { passive: true });
    }
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      for (const eventName of events) {
        window.removeEventListener(eventName, resetTimer);
      }
    };
  }, [admin, clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await adminApi.post<{ accessToken: string; admin: AdminUser }>('/admin/auth/login', {
      email,
      password,
    });
    const session: AdminSession = {
      accessToken: response.data.accessToken,
      admin: response.data.admin,
    };
    setAdminAuthToken(session.accessToken);
    setAdmin(session.admin);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    }
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      admin,
      isAuthenticated: !!admin,
      isLoading,
      login,
      logout,
    }),
    [admin, isLoading, login, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}

export { getAdminApiErrorMessage };
