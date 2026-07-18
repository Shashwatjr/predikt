import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '../../theme/designSystem';
import AdminTable from '../components/AdminTable';
import AdminConfirmDialog from '../components/AdminConfirmDialog';
import { adminApi, getAdminApiErrorMessage } from '../services/adminApi';

export default function AdminUsersScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.get('/admin/operations/users', { params: { page } });
      setRows(response.data.items ?? []);
      setTotal(response.data.total ?? 0);
      setPageSize(response.data.pageSize ?? 0);
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (row: any) => {
    try {
      const response = await adminApi.get(`/admin/operations/users/${row.userId}`);
      setSelected(response.data);
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to load user detail'));
    }
  };

  const performDisable = async () => {
    if (!selected) return;
    setConfirmBusy(true);
    try {
      await adminApi.post(`/admin/operations/users/${selected.userId}/disable`, {
        reason: 'Disabled from admin portal',
      });
      setConfirmVisible(false);
      await openDetail(selected);
      await load();
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to disable account'));
    } finally {
      setConfirmBusy(false);
    }
  };

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
      <Text style={styles.title}>Users</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AdminTable
        rows={rows}
        onRowPress={openDetail}
        columns={[
          { key: 'id', label: 'ID', render: (row) => <Text style={styles.cell}>{row.shortId}</Text> },
          { key: 'handle', label: 'Handle', render: (row) => <Text style={styles.cell}>{row.handle}</Text> },
          { key: 'type', label: 'Type', render: (row) => <Text style={styles.cell}>{row.accountType}</Text> },
          { key: 'status', label: 'Status', render: (row) => <Text style={styles.cell}>{row.status}</Text> },
          { key: 'rooms', label: 'Rooms', render: (row) => <Text style={styles.cell}>{row.roomCount}</Text> },
          { key: 'reports', label: 'Reports', render: (row) => <Text style={styles.cell}>{row.reportCount ?? 0}</Text> },
        ]}
      />
      <View style={styles.pagination}>
        <Pressable disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
          <Text style={styles.pageAction}>Previous</Text>
        </Pressable>
        <Text style={styles.pageLabel}>Page {page} · {total} total</Text>
        <Pressable disabled={!hasNextPage} onPress={() => setPage((p) => p + 1)}>
          <Text style={[styles.pageAction, !hasNextPage && styles.pageActionDisabled]}>Next</Text>
        </Pressable>
      </View>

      {selected ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>User detail</Text>
          <Text style={styles.detailText}>Handle: {selected.handle}</Text>
          <Text style={styles.detailText}>Type: {selected.accountType}</Text>
          <Text style={styles.detailText}>Status: {selected.status}</Text>
          <Text style={styles.detailText}>Email: {selected.email ?? 'hidden in list view'}</Text>
          <Text style={styles.detailText}>Aura: {selected.auraBalance}</Text>
          <Pressable onPress={() => setConfirmVisible(true)} style={styles.dangerButton}>
            <Text style={styles.dangerText}>Disable account</Text>
          </Pressable>
        </View>
      ) : null}

      <AdminConfirmDialog
        visible={confirmVisible}
        title="Disable account?"
        message={`This disables ${selected?.handle ?? 'this account'} without deleting their data. They will be signed out and unable to play until re-enabled.`}
        confirmLabel="Disable account"
        tone="danger"
        loading={confirmBusy}
        onConfirm={performDisable}
        onCancel={() => setConfirmVisible(false)}
      />
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
  dangerButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  dangerText: { ...typography.caption, color: '#f87171', fontWeight: '700' },
});
