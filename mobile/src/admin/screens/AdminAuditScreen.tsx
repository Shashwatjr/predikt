import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '../../theme/designSystem';
import AdminTable from '../components/AdminTable';
import { adminApi, getAdminApiErrorMessage } from '../services/adminApi';

export default function AdminAuditScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.get('/admin/audit-logs/search', { params: { page } });
      setRows(response.data.items ?? []);
      setTotal(response.data.total ?? 0);
      setPageSize(response.data.pageSize ?? 0);
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to load audit logs'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasNextPage = pageSize > 0 && page * pageSize < total;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.violet} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Audit log</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AdminTable
        rows={rows}
        emptyLabel="No audit events"
        columns={[
          { key: 'action', label: 'Action', width: 180, render: (row) => <Text style={styles.cell}>{row.action}</Text> },
          { key: 'actor', label: 'Actor', render: (row) => <Text style={styles.cell}>{row.actorType}</Text> },
          { key: 'target', label: 'Target', render: (row) => <Text style={styles.cell}>{row.targetType ?? '—'}</Text> },
          { key: 'result', label: 'Result', render: (row) => <Text style={styles.cell}>{row.result}</Text> },
          { key: 'time', label: 'Time', width: 180, render: (row) => <Text style={styles.cell}>{String(row.timestamp)}</Text> },
        ]}
      />
      <View style={styles.pagination}>
        <Pressable disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
          <Text style={[styles.pageAction, page <= 1 && styles.pageActionDisabled]}>Previous</Text>
        </Pressable>
        <Text style={styles.pageLabel}>Page {page}{total ? ` · ${total} total` : ''}</Text>
        <Pressable disabled={!hasNextPage} onPress={() => setPage((p) => p + 1)}>
          <Text style={[styles.pageAction, !hasNextPage && styles.pageActionDisabled]}>Next</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, color: palette.textPrimary },
  cell: { ...typography.caption, color: palette.textPrimary },
  error: { ...typography.caption, color: '#f87171' },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageAction: { ...typography.caption, color: palette.violet, fontWeight: '600' },
  pageActionDisabled: { color: palette.textMuted, opacity: 0.5 },
  pageLabel: { ...typography.caption, color: palette.textMuted },
});
