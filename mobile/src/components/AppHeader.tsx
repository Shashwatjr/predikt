import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette, spacing, typography } from '../theme/designSystem';

type Props = {
  greeting?: string;
  subtitle?: string;
  aura?: number;
  streak?: number;
  onNotifications?: () => void;
  onProfile?: () => void;
  unreadCount?: number;
  rightSlot?: React.ReactNode;
};

export default function AppHeader({ greeting, subtitle, aura, streak, onNotifications, onProfile, unreadCount = 0, rightSlot }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoP}>P</Text>
        </View>
        <View style={styles.brandText}>
          <Text style={styles.wordmark}>My Prediktion</Text>
          {greeting ? <Text style={styles.greeting}>{greeting}</Text> : subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.right}>
        {typeof aura === 'number' ? (
          <View style={styles.statPill}>
            <Text style={styles.statText}>✨ {aura}</Text>
          </View>
        ) : null}
        {typeof streak === 'number' && streak > 0 ? (
          <View style={styles.statPill}>
            <Text style={styles.statText}>🔥 {streak}</Text>
          </View>
        ) : null}
        {rightSlot}
        {onNotifications ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onNotifications} accessibilityLabel="Notifications">
            <Text style={styles.icon}>🔔</Text>
            {unreadCount > 0 ? <View style={styles.dot} /> : null}
          </TouchableOpacity>
        ) : null}
        {onProfile ? (
          <TouchableOpacity style={styles.avatarBtn} onPress={onProfile} accessibilityLabel="Profile">
            <Text style={styles.icon}>👤</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.bgElevated,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoP: { color: palette.violet, fontSize: 22, fontWeight: '900' },
  brandText: { flex: 1 },
  wordmark: { color: palette.textPrimary, ...typography.micro, letterSpacing: 3 },
  greeting: { color: palette.textPrimary, ...typography.h3, marginTop: 2 },
  subtitle: { color: palette.textSecondary, ...typography.caption, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(34,211,238,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statText: { color: palette.textPrimary, fontSize: 11, fontWeight: '800' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  icon: { fontSize: 18 },
  dot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
});
