import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '../../theme/designSystem';
import type { AdminNavItem } from '../types/admin';

const NAV_ITEMS: { key: AdminNavItem; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'users', label: 'Users' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'moderation', label: 'Moderation' },
  { key: 'audit', label: 'Audit' },
  { key: 'health', label: 'System Health' },
  { key: 'flags', label: 'Feature Flags' },
];

type Props = {
  active: AdminNavItem;
  onNavigate: (item: AdminNavItem) => void;
  adminName: string;
  onLogout: () => void;
};

export default function AdminSidebar({ active, onNavigate, adminName, onLogout }: Props) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>PREDIKT Admin</Text>
        <Text style={styles.subtitle}>Private beta operations</Text>
      </View>
      <ScrollView style={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => onNavigate(item.key)}
            style={[styles.navItem, active === item.key && styles.navItemActive]}
          >
            <Text style={[styles.navLabel, active === item.key && styles.navLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.adminName}>{adminName}</Text>
        <Pressable onPress={onLogout}>
          <Text style={styles.logout}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: '#0b1220',
    borderRightWidth: 1,
    borderRightColor: palette.border,
    paddingVertical: spacing.lg,
  },
  brandBlock: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  brand: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
  nav: {
    flex: 1,
  },
  navItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  navItemActive: {
    backgroundColor: 'rgba(34,211,238,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: palette.violet,
  },
  navLabel: {
    ...typography.body,
    color: palette.textMuted,
  },
  navLabelActive: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  adminName: {
    ...typography.caption,
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
  logout: {
    ...typography.caption,
    color: palette.violet,
    fontWeight: '600',
  },
});
