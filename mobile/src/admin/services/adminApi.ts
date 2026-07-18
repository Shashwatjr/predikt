import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('Missing EXPO_PUBLIC_API_BASE_URL for admin API');
}

export const adminApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export function setAdminAuthToken(token: string | null) {
  if (token) {
    adminApi.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete adminApi.defaults.headers.common.Authorization;
  }
}

export function getAdminApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    if (error.response?.status === 401) return 'Admin session expired. Please sign in again.';
    if (error.response?.status === 403) return 'You do not have permission to access the admin portal.';
  }
  return fallback;
}

export function periodQuery(period: string, customFrom?: string, customTo?: string) {
  const now = new Date();
  const to = customTo ? new Date(customTo) : now;
  let from = new Date(to);

  if (period === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (period === '30d') {
    from.setDate(from.getDate() - 30);
  } else if (period === 'custom' && customFrom) {
    from = new Date(customFrom);
  } else {
    from.setDate(from.getDate() - 7);
  }

  return {
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
  };
}
