import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cardStyle, palette, radius, spacing, typography } from '../../theme/designSystem';
import AdminFilterBar from '../components/AdminFilterBar';
import AdminMetricCard from '../components/AdminMetricCard';
import { adminApi, getAdminApiErrorMessage, periodQuery } from '../services/adminApi';
import type { DatePeriod, FunnelStage } from '../types/admin';

type Props = {
  scope?: 'sam' | 'ai';
};

type LeadershipMetric = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'warning' | 'success';
};

export default function AdminDashboardScreen({ scope = 'sam' }: Props) {
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

  const funnelMap = useMemo(
    () =>
      funnel.reduce<Record<string, FunnelStage>>((acc, stage) => {
        acc[stage.key] = stage;
        return acc;
      }, {}),
    [funnel],
  );

  const leadershipMetrics: LeadershipMetric[] = [
    {
      label: 'Journeys created',
      value: summary?.betaHealth?.roomsCreated ?? 0,
      hint: 'Total demand in period',
    },
    {
      label: 'Completion rate',
      value: `${summary?.betaHealth?.completionRate ?? 0}%`,
      hint: 'Created to completed',
      tone: (summary?.betaHealth?.completionRate ?? 0) >= 70 ? 'success' : 'warning',
    },
    {
      label: 'Guest upgrade',
      value: `${summary?.guestJourney?.guestUpgradeConversion ?? 0}%`,
      hint: 'Guest prediction to account',
      tone: (summary?.guestJourney?.guestUpgradeConversion ?? 0) >= 20 ? 'success' : 'default',
    },
    {
      label: 'Share conversion',
      value: `${sharing?.shareConversion ?? 0}%`,
      hint: 'Viewed result to shared result',
      tone: (sharing?.shareConversion ?? 0) >= 25 ? 'success' : 'default',
    },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.violet} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>LEADERSHIP OVERVIEW</Text>
        <Text style={styles.title}>Mission Control</Text>
        <Text style={styles.subtitle}>
          A single view for SAM operations and AI engagement with the original SAM dashboard kept
          intact inside its overview section.
        </Text>
      </View>

      <AdminFilterBar period={period} onChange={setPeriod} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        {leadershipMetrics.map((metric) => (
          <AdminMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            tone={metric.tone}
          />
        ))}
      </View>

      {scope === 'sam' ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>SAM</Text>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.sectionCopy}>
            Original operational dashboard for journey health, funnel movement, guest behavior, and
            moderation.
          </Text>

          <Text style={styles.subsectionTitle}>Beta health</Text>
          <View style={styles.grid}>
            <AdminMetricCard label="Rooms created" value={summary?.betaHealth?.roomsCreated ?? 0} />
            <AdminMetricCard label="Completed rooms" value={summary?.betaHealth?.completedRooms ?? 0} />
            <AdminMetricCard
              label="Completion rate"
              value={`${summary?.betaHealth?.completionRate ?? 0}%`}
              tone={(summary?.betaHealth?.completionRate ?? 0) >= 70 ? 'success' : 'warning'}
            />
            <AdminMetricCard
              label="Unresolved reports"
              value={summary?.betaHealth?.unresolvedReports ?? 0}
              tone="warning"
            />
          </View>

          <Text style={styles.subsectionTitle}>Invite funnel</Text>
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

          <Text style={styles.subsectionTitle}>Guest journey</Text>
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

          <Text style={styles.subsectionTitle}>Sharing and rematch</Text>
          <View style={styles.grid}>
            <AdminMetricCard label="Results viewed" value={sharing?.resultViewed ?? 0} />
            <AdminMetricCard label="Results shared" value={sharing?.resultShared ?? 0} />
            <AdminMetricCard label="Rematches" value={sharing?.rematchCreated ?? 0} />
            <AdminMetricCard label="Share conversion" value={`${sharing?.shareConversion ?? 0}%`} />
          </View>

          <Text style={styles.subsectionTitle}>Safety and moderation</Text>
          <View style={styles.grid}>
            <AdminMetricCard label="Reports opened" value={summary?.moderation?.reportsOpened ?? 0} />
            <AdminMetricCard label="Blocked users" value={summary?.moderation?.blockedUsers ?? 0} />
            <AdminMetricCard
              label="Auto-closed rooms"
              value={summary?.reliability?.roomsAutoClosed ?? 0}
            />
            <AdminMetricCard
              label="Abandoned rooms"
              value={summary?.reliability?.roomsAbandoned ?? 0}
            />
          </View>
        </View>
      ) : (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>AI</Text>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.sectionCopy}>
            Leadership view of prediction flow, result engagement, and repeat behavior.
          </Text>

          <View style={styles.grid}>
            <AdminMetricCard label="Invite opened" value={funnelMap.invite_opened?.count ?? 0} />
            <AdminMetricCard
              label="Preview loaded"
              value={funnelMap.invite_preview_loaded?.count ?? 0}
              hint={
                funnelMap.invite_preview_loaded?.conversionFromPrevious != null
                  ? `${funnelMap.invite_preview_loaded.conversionFromPrevious}% from opened`
                  : undefined
              }
            />
            <AdminMetricCard
              label="Predictions submitted"
              value={funnelMap.prediction_submitted?.count ?? 0}
              hint={
                funnelMap.prediction_submitted?.conversionFromPrevious != null
                  ? `${funnelMap.prediction_submitted.conversionFromPrevious}% from previous`
                  : undefined
              }
            />
            <AdminMetricCard label="Result viewed" value={funnelMap.result_viewed?.count ?? 0} />
            <AdminMetricCard label="Result shared" value={funnelMap.result_shared?.count ?? 0} />
            <AdminMetricCard label="Rematch created" value={funnelMap.rematch_created?.count ?? 0} />
            <AdminMetricCard
              label="Guest upgrades completed"
              value={summary?.guestJourney?.guestUpgradeCompleted ?? 0}
            />
            <AdminMetricCard
              label="Rematch conversion"
              value={`${sharing?.rematchConversion ?? 0}%`}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    ...cardStyle('elevated'),
    borderRadius: radius.xl,
    gap: spacing.xs,
    backgroundColor: '#0B1326',
  },
  eyebrow: {
    ...typography.label,
    color: '#91A5C8',
    letterSpacing: 2.2,
  },
  title: {
    ...typography.h1,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
    maxWidth: 680,
  },
  sectionCard: {
    ...cardStyle('default'),
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: '#91A5C8',
    letterSpacing: 2.6,
  },
  sectionTitle: {
    ...typography.h2,
    color: palette.textPrimary,
  },
  sectionCopy: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  subsectionTitle: {
    ...typography.h3,
    color: palette.textPrimary,
    marginTop: spacing.sm,
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
