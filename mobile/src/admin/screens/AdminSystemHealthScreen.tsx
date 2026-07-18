import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '../../theme/designSystem';
import AdminMetricCard from '../components/AdminMetricCard';
import { adminApi, getAdminApiErrorMessage } from '../services/adminApi';

export default function AdminSystemHealthScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      adminApi.get('/admin/system/health'),
      adminApi.get('/admin/system/version'),
    ]);
    if (results[0].status === 'fulfilled') setHealth(results[0].value.data);
    if (results[1].status === 'fulfilled') setVersion(results[1].value.data);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') {
      setError(getAdminApiErrorMessage(failed.reason, 'Failed to load system health'));
    }
    setLoading(false);
  }, []);

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
      <Text style={styles.title}>System health</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.grid}>
        <AdminMetricCard
          label="API reachable"
          value={health?.backend?.apiReachable ? 'Yes' : 'No'}
          tone={health?.backend?.apiReachable ? 'success' : 'warning'}
        />
        <AdminMetricCard
          label="Database reachable"
          value={health?.backend?.databaseReachable ? 'Yes' : 'No'}
          tone={health?.backend?.databaseReachable ? 'success' : 'warning'}
        />
        <AdminMetricCard label="Environment" value={health?.backend?.environment ?? 'unknown'} />
        <AdminMetricCard label="Uptime (s)" value={health?.backend?.uptimeSeconds ?? 0} />
        <AdminMetricCard label="Version" value={version?.version ?? 'unknown'} />
        <AdminMetricCard label="Build" value={version?.build ?? 'local'} />
      </View>

      <Text style={styles.section}>Product services</Text>
      <View style={styles.grid}>
        <AdminMetricCard label="Room creation" value={`${health?.productServices?.roomCreationHealth ?? 0}%`} />
        <AdminMetricCard label="Invite preview" value={`${health?.productServices?.invitePreviewSuccess ?? 0}%`} />
        <AdminMetricCard label="Prediction submit" value={`${health?.productServices?.predictionSubmissionSuccess ?? 0}%`} />
        <AdminMetricCard label="Result finalize" value={`${health?.productServices?.resultFinalizationSuccess ?? 0}%`} />
        <AdminMetricCard label="Rematch" value={`${health?.productServices?.rematchSuccess ?? 0}%`} />
        <AdminMetricCard label="Guest upgrade" value={`${health?.productServices?.guestUpgradeSuccess ?? 0}%`} />
      </View>

      <Text style={styles.section}>Error rates</Text>
      <View style={styles.grid}>
        <AdminMetricCard label="Auth failures" value={health?.errorRates?.recentAuthFailures ?? 0} />
        <AdminMetricCard label="Failed lifecycle" value={health?.errorRates?.failedLifecycleEvaluations ?? 0} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, color: palette.textPrimary },
  section: { ...typography.h3, color: palette.textPrimary, marginTop: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { ...typography.caption, color: '#f87171' },
});
