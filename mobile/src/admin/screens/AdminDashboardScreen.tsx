import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '../../theme/designSystem';
import AdminFilterBar from '../components/AdminFilterBar';
import AdminMetricCard from '../components/AdminMetricCard';
import { adminApi, getAdminApiErrorMessage, periodQuery } from '../services/adminApi';
import type { DatePeriod, FunnelStage } from '../types/admin';

export default function AdminDashboardScreen() {
  const [period, setPeriod] = useState<DatePeriod>('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [sharing, setSharing] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = periodQuery(period);
    const results = await Promise.allSettled([
      adminApi.get('/admin/analytics/summary', { params: query }),
      adminApi.get('/admin/analytics/funnel', { params: query }),
      adminApi.get('/admin/analytics/sharing', { params: query }),
    ]);

    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      setError(getAdminApiErrorMessage(failed.reason, 'Some analytics failed to load'));
    }

    if (results[0].status === 'fulfilled') setSummary(results[0].value.data);
    if (results[1].status === 'fulfilled') setFunnel(results[1].value.data.stages ?? []);
    if (results[2].status === 'fulfilled') setSharing(results[2].value.data);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.violet} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Overview</Text>
      <AdminFilterBar period={period} onChange={setPeriod} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>Beta health</Text>
      <View style={styles.grid}>
        <AdminMetricCard label="Rooms created" value={summary?.betaHealth?.roomsCreated ?? 0} />
        <AdminMetricCard label="Completed rooms" value={summary?.betaHealth?.completedRooms ?? 0} />
        <AdminMetricCard
          label="Completion rate"
          value={`${summary?.betaHealth?.completionRate ?? 0}%`}
        />
        <AdminMetricCard
          label="Unresolved reports"
          value={summary?.betaHealth?.unresolvedReports ?? 0}
          tone="warning"
        />
      </View>

      <Text style={styles.section}>Invite funnel</Text>
      <View style={styles.grid}>
        {funnel.map((stage) => (
          <AdminMetricCard
            key={stage.key}
            label={stage.label}
            value={stage.count}
            hint={
              stage.conversionFromPrevious != null
                ? `${stage.conversionFromPrevious}% from previous`
                : undefined
            }
          />
        ))}
      </View>

      <Text style={styles.section}>Guest journey</Text>
      <View style={styles.grid}>
        <AdminMetricCard label="Guest users" value={summary?.guestJourney?.guestUsers ?? 0} />
        <AdminMetricCard
          label="Guest predictions"
          value={summary?.guestJourney?.guestPredictions ?? 0}
        />
        <AdminMetricCard
          label="Upgrade conversion"
          value={`${summary?.guestJourney?.guestUpgradeConversion ?? 0}%`}
        />
      </View>

      <Text style={styles.section}>Sharing and rematch</Text>
      <View style={styles.grid}>
        <AdminMetricCard label="Results viewed" value={sharing?.resultViewed ?? 0} />
        <AdminMetricCard label="Results shared" value={sharing?.resultShared ?? 0} />
        <AdminMetricCard label="Rematches" value={sharing?.rematchCreated ?? 0} />
        <AdminMetricCard
          label="Share conversion"
          value={`${sharing?.shareConversion ?? 0}%`}
        />
      </View>

      <Text style={styles.section}>Safety and moderation</Text>
      <View style={styles.grid}>
        <AdminMetricCard label="Reports opened" value={summary?.moderation?.reportsOpened ?? 0} />
        <AdminMetricCard label="Blocked users" value={summary?.moderation?.blockedUsers ?? 0} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: palette.textPrimary,
  },
  section: {
    ...typography.h3,
    color: palette.textPrimary,
    marginTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: '#f87171',
  },
});
