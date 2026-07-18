import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '../../theme/designSystem';
import AdminTable from '../components/AdminTable';
import AdminConfirmDialog from '../components/AdminConfirmDialog';
import { adminApi, getAdminApiErrorMessage } from '../services/adminApi';

export default function AdminFeedbackScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.get('/admin/feedback');
      setRows(response.data.items ?? []);
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to load feedback'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmReview = async () => {
    if (!pendingId) return;
    setBusy(true);
    try {
      await adminApi.patch(`/admin/feedback/${pendingId}`, { status: 'reviewing' });
      setPendingId(null);
      await load();
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to update feedback'));
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
      <Text style={styles.title}>Feedback queue</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AdminTable
        rows={rows}
        emptyLabel="No feedback yet"
        columns={[
          { key: 'type', label: 'Type', render: (row) => <Text style={[styles.cell, row.type === 'safety_privacy' && styles.safety]}>{row.type}</Text> },
          { key: 'status', label: 'Status', render: (row) => <Text style={styles.cell}>{row.status}</Text> },
          { key: 'priority', label: 'Priority', render: (row) => <Text style={styles.cell}>{row.priority}</Text> },
          { key: 'preview', label: 'Preview', width: 260, render: (row) => <Text style={styles.cell}>{row.messagePreview}</Text> },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <Pressable onPress={() => setPendingId(row.feedbackId)}>
                <Text style={styles.action}>Review</Text>
              </Pressable>
            ),
          },
        ]}
      />
      <AdminConfirmDialog
        visible={!!pendingId}
        title="Mark as reviewing?"
        message="This moves the feedback item into the reviewing state."
        confirmLabel="Mark reviewing"
        loading={busy}
        onConfirm={confirmReview}
        onCancel={() => setPendingId(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, color: palette.textPrimary },
  cell: { ...typography.caption, color: palette.textPrimary },
  safety: { color: '#f59e0b', fontWeight: '700' },
  action: { ...typography.caption, color: palette.violet, fontWeight: '600' },
  error: { ...typography.caption, color: '#f87171' },
});
