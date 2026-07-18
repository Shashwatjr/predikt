import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '../../theme/designSystem';
import { adminApi, getAdminApiErrorMessage } from '../services/adminApi';

export default function AdminFeatureFlagsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.get('/admin/system/feature-flags');
      setFlags(response.data.flags ?? {});
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Failed to load feature flags'));
    } finally {
      setLoading(false);
    }
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
      <Text style={styles.title}>Feature flags</Text>
      <Text style={styles.note}>Read-only operational visibility. Flags are controlled via env configuration.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {Object.entries(flags).map(([key, value]) => (
        <View key={key} style={styles.row}>
          <Text style={styles.key}>{key}</Text>
          <Text style={[styles.value, value ? styles.enabled : styles.disabled]}>
            {value ? 'enabled' : 'disabled'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, color: palette.textPrimary },
  note: { ...typography.caption, color: palette.textMuted, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  key: { ...typography.body, color: palette.textPrimary },
  value: { ...typography.caption, fontWeight: '700' },
  enabled: { color: '#22c55e' },
  disabled: { color: palette.textMuted },
  error: { ...typography.caption, color: '#f87171' },
});
