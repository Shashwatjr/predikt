import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '../../theme/designSystem';
import AdminTable from '../components/AdminTable';
import AdminConfirmDialog from '../components/AdminConfirmDialog';
import { adminApi, getAdminApiErrorMessage } from '../services/adminApi';

export default function AdminModerationScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.get('/admin/moderation/queue');
      setRows(response.data.items ?? []);
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to load moderation queue'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmResolve = async () => {
    if (!pendingReportId) return;
    setBusy(true);
    try {
      await adminApi.patch(`/admin/moderation/reports/${pendingReportId}`, {
        status: 'resolved',
        resolution: 'Reviewed in admin portal',
      });
      setPendingReportId(null);
      await load();
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to resolve report'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.violet} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Moderation queue</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AdminTable
        rows={rows}
        emptyLabel="No moderation items"
        columns={[
          { key: 'type', label: 'Type', render: (row) => <Text style={styles.cell}>{row.reportType}</Text> },
          { key: 'reason', label: 'Reason', width: 200, render: (row) => <Text style={styles.cell}>{row.reason ?? '—'}</Text> },
          { key: 'status', label: 'Status', render: (row) => <Text style={styles.cell}>{row.status}</Text> },
          { key: 'priority', label: 'Priority', render: (row) => <Text style={styles.cell}>{row.priority}</Text> },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <Pressable onPress={() => setPendingReportId(row.reportId)}>
                <Text style={styles.action}>Resolve</Text>
              </Pressable>
            ),
          },
        ]}
      />
      <AdminConfirmDialog
        visible={!!pendingReportId}
        title="Resolve this report?"
        message="This marks the report resolved and removes it from the moderation queue."
        confirmLabel="Resolve"
        loading={busy}
        onConfirm={confirmResolve}
        onCancel={() => setPendingReportId(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, color: palette.textPrimary },
  cell: { ...typography.caption, color: palette.textPrimary },
  action: { ...typography.caption, color: palette.violet, fontWeight: '600' },
  error: { ...typography.caption, color: '#f87171' },
});
