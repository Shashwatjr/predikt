import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '../../theme/designSystem';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Web-compatible confirmation dialog. React Native's `Alert.alert` is a no-op on
 * Expo web, so destructive admin actions used it and silently never confirmed.
 * This renders a real overlay via `Modal` (supported by react-native-web) so the
 * confirm step actually appears and gates the action.
 */
export default function AdminConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel}>
        {/* Stop propagation so taps inside the card don't dismiss. */}
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={loading} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, tone === 'danger' && styles.confirmDanger, loading && styles.disabled]}
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={[styles.confirmText, tone === 'danger' && styles.confirmDangerText]}>
                {loading ? 'Working…' : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,8,22,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.h3, color: palette.textPrimary },
  message: { ...typography.body, color: palette.textSecondary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  cancelText: { ...typography.caption, color: palette.textSecondary, fontWeight: '700' },
  confirmBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(34,211,238,0.2)',
  },
  confirmDanger: { backgroundColor: 'rgba(239,68,68,0.18)' },
  disabled: { opacity: 0.6 },
  confirmText: { ...typography.caption, color: palette.violetLight, fontWeight: '800' },
  confirmDangerText: { color: '#f87171' },
});
