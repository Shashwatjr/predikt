import { BadRequestException } from '@nestjs/common';

export const MAX_ANALYTICS_RANGE_DAYS = 90;
export const DEFAULT_ANALYTICS_RANGE_DAYS = 7;

export type AnalyticsPeriod = {
  from: Date;
  to: Date;
};

export type AnalyticsQuery = AnalyticsPeriod & {
  category?: string;
  platform?: string;
};

export function parseAnalyticsQuery(query: {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  platform?: string;
}): AnalyticsQuery {
  const to = query.dateTo ? new Date(query.dateTo) : new Date();
  const from = query.dateFrom
    ? new Date(query.dateFrom)
    : new Date(to.getTime() - DEFAULT_ANALYTICS_RANGE_DAYS * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException('Invalid date range');
  }
  if (from > to) {
    throw new BadRequestException('dateFrom must be before dateTo');
  }

  const rangeDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (rangeDays > MAX_ANALYTICS_RANGE_DAYS) {
    throw new BadRequestException(`Date range cannot exceed ${MAX_ANALYTICS_RANGE_DAYS} days`);
  }

  return {
    from,
    to,
    category: query.category?.trim() || undefined,
    platform: query.platform?.trim() || undefined,
  };
}

export function conversionRate(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round((current / previous) * 1000) / 10;
}

export function buildEventWhere(period: AnalyticsQuery) {
  return {
    createdAt: { gte: period.from, lte: period.to },
    ...(period.category ? { category: period.category } : {}),
    ...(period.platform ? { platform: period.platform } : {}),
  };
}

export function buildRoomWhere(period: AnalyticsQuery) {
  return {
    createdAt: { gte: period.from, lte: period.to },
    ...(period.category ? { category: period.category } : {}),
  };
}
