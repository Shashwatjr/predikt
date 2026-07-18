export type AdminUser = {
  adminUserId: string;
  name: string;
  role: string;
  status: string;
};

export type DatePeriod = 'today' | '7d' | '30d' | 'custom';

export type AnalyticsPeriod = {
  from: string;
  to: string;
};

export type Paginated<T> = {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
};

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
};

export type AdminNavItem =
  | 'overview'
  | 'rooms'
  | 'users'
  | 'feedback'
  | 'moderation'
  | 'audit'
  | 'health'
  | 'flags';
