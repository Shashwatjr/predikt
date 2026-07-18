import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '../../theme/designSystem';
import AdminTable from '../components/AdminTable';
import { adminApi, getAdminApiErrorMessage } from '../services/adminApi';

export default function AdminRoomsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.get('/admin/operations/rooms', { params: { page } });
      setRows(response.data.items ?? []);
      setTotal(response.data.total ?? 0);
      setPageSize(response.data.pageSize ?? 0);
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to load rooms'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (row: any) => {
    try {
      const response = await adminApi.get(`/admin/operations/rooms/${row.roomId}`);
      setSelected(response.data);
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to load room detail'));
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
      <Text style={styles.title}>Rooms</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AdminTable
        rows={rows}
        onRowPress={openDetail}
        columns={[
          { key: 'code', label: 'Code', render: (row) => <Text style={styles.cell}>{row.roomCode}</Text> },
          { key: 'category', label: 'Category', render: (row) => <Text style={styles.cell}>{row.category}</Text> },
          { key: 'creator', label: 'Creator', render: (row) => <Text style={styles.cell}>{row.creatorType}</Text> },
          { key: 'status', label: 'Status', render: (row) => <Text style={styles.cell}>{row.status}</Text> },
          { key: 'participants', label: 'Participants', render: (row) => <Text style={styles.cell}>{row.participantCount}</Text> },
          { key: 'predictions', label: 'Predictions', render: (row) => <Text style={styles.cell}>{row.predictionCount}</Text> },
          { key: 'reports', label: 'Reports', render: (row) => <Text style={styles.cell}>{row.reportCount}</Text> },
        ]}
      />
      <View style={styles.pagination}>
        <Pressable disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
          <Text style={styles.pageAction}>Previous</Text>
        </Pressable>
        <Text style={styles.pageLabel}>
          Page {page} · {total} total
        </Text>
        <Pressable disabled={!(pageSize > 0 && page * pageSize < total)} onPress={() => setPage((p) => p + 1)}>
          <Text style={[styles.pageAction, !(pageSize > 0 && page * pageSize < total) && styles.pageActionDisabled]}>Next</Text>
        </Pressable>
      </View>

      {selected ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>Room detail (safe projection)</Text>
          <Text style={styles.detailText}>Status: {selected.status}</Text>
          <Text style={styles.detailText}>Category: {selected.category}</Text>
          <Text style={styles.detailText}>Participants: {selected.participantCount}</Text>
          <Text style={styles.detailText}>Predictions: {selected.predictionCount}</Text>
          <Text style={styles.detailText}>Outcome: {selected.outcomeSource ?? 'pending'}</Text>
          <Text style={styles.detailNote}>
            Coordinates, guest keys, and hidden predictions are not shown.
          </Text>
        </View>
      ) : null}
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
  detail: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.surface,
  },
  detailTitle: { ...typography.h3, color: palette.textPrimary, marginBottom: spacing.sm },
  detailText: { ...typography.body, color: palette.textMuted, marginBottom: spacing.xs },
  detailNote: { ...typography.caption, color: palette.textMuted, marginTop: spacing.sm },
});
