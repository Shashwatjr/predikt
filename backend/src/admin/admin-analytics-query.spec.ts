import { parseAnalyticsQuery, conversionRate, MAX_ANALYTICS_RANGE_DAYS } from './utils/analytics-query';

describe('analytics query helpers', () => {
  it('defaults to a 7-day range', () => {
    const period = parseAnalyticsQuery({});
    const days = (period.to.getTime() - period.from.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(6.9);
    expect(days).toBeLessThanOrEqual(7.1);
  });

  it('rejects ranges longer than the maximum', () => {
    const from = new Date('2026-01-01').toISOString();
    const to = new Date('2026-06-01').toISOString();
    expect(() => parseAnalyticsQuery({ dateFrom: from, dateTo: to })).toThrow(
      `Date range cannot exceed ${MAX_ANALYTICS_RANGE_DAYS} days`,
    );
  });

  it('calculates conversion rates', () => {
    expect(conversionRate(50, 100)).toBe(50);
    expect(conversionRate(0, 0)).toBeNull();
  });
});
