import api from './api';

export interface UserNotification {
  notificationId: string;
  roomId?: string | null;
  type: string;
  title: string;
  body: string;
  status: 'unread' | 'read' | 'archived';
  severity: 'info' | 'success' | 'warning' | 'action_required';
  actionLabel?: string | null;
  actionTarget?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  readAt?: string | null;
}

export async function fetchNotifications() {
  const response = await api.get<UserNotification[]>('/notifications');
  return response.data;
}

export async function fetchUnreadNotificationCount() {
  const response = await api.get<{ count: number }>('/notifications/unread-count');
  return response.data.count;
}

export async function markNotificationRead(notificationId: string) {
  const response = await api.patch<UserNotification>(`/notifications/${notificationId}/read`);
  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await api.patch<{ success: boolean; readAt: string }>('/notifications/read-all');
  return response.data;
}
