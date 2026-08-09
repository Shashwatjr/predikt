import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { palette, radius, spacing, typography } from '../../theme/designSystem';
import type { AdminNavItem } from '../types/admin';

type NavLeaf = {
  key: AdminNavItem;
  label: string;
  helper?: string;
};

type NavGroup = {
  key: 'sam' | 'ai';
  label: string;
  helper: string;
  items: NavLeaf[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'sam',
    label: 'SAM',
    helper: 'Journey operations and governance',
    items: [
      { key: 'feedback', label: 'Data Intake', helper: 'Feedback and intake streams' },
      { key: 'rooms', label: 'Asset Inventory', helper: 'Rooms and operational assets' },
      { key: 'audit', label: 'Compliance Workbench', helper: 'Audit trail and review' },
      { key: 'moderation', label: 'ELP & Reporting', helper: 'Escalations and reports' },
      { key: 'flags', label: 'Administration', helper: 'Platform controls and flags' },
    ],
  },
  {
    key: 'ai',
    label: 'AI',
    helper: 'AI posture and usage controls',
    items: [
      { key: 'rooms', label: 'Registry', helper: 'Tracked AI systems and records' },
      { key: 'users', label: 'Access & Entitlements', helper: 'Owners, roles, approvals' },
      { key: 'moderation', label: 'Shadow AI', helper: 'Unapproved or risky usage' },
      { key: 'audit', label: 'Data & Knowledge', helper: 'Policies, lineage, controls' },
    ],
  },
];

type Props = {
  activeGroup: NavGroup['key'];
  active: AdminNavItem;
  onNavigate: (group: NavGroup['key'], item: AdminNavItem) => void;
  adminName: string;
  onLogout: () => void;
};

export default function AdminSidebar({
  activeGroup,
  active,
  onNavigate,
  adminName,
  onLogout,
}: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<NavGroup['key'], boolean>>({
    sam: true,
    ai: true,
  });

  const query = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      if (!query) return group;
      return {
        ...group,
        items: group.items.filter((item) => {
          const haystack =
            `${group.label} ${group.helper} ${item.label} ${item.helper ?? ''}`.toLowerCase();
          return haystack.includes(query);
        }),
      };
    }).filter((group) => group.items.length > 0 || group.label.toLowerCase().includes(query));
  }, [query]);

  const toggleGroup = (key: NavGroup['key']) => {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandBlock}>
        <Text style={styles.eyebrow}>VALUE</Text>
        <Text style={styles.brand}>Mission Control</Text>
        <Text style={styles.subtitle}>Unified operations</Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search workflows, controls, queues..."
          placeholderTextColor={palette.textMuted}
          style={styles.searchInput}
        />
      </View>

      <ScrollView style={styles.nav} contentContainerStyle={styles.navContent} showsVerticalScrollIndicator={false}>
        {filteredGroups.map((group) => {
          const isExpanded = expanded[group.key];
          const isGroupActive = activeGroup === group.key;
          const isOverviewActive = isGroupActive && active === 'overview';
          return (
            <View key={group.key} style={styles.groupBlock}>
              <Pressable
                onPress={() => onNavigate(group.key, 'overview')}
                style={[styles.groupHeader, isGroupActive && styles.groupHeaderActive]}
              >
                <View style={styles.groupHeaderCopy}>
                  <Text style={[styles.groupLabel, isGroupActive && styles.groupLabelActive]}>
                    {group.label}
                  </Text>
                  <Text
                    style={[
                      styles.groupHelper,
                      isOverviewActive && styles.groupHelperActive,
                    ]}
                  >
                    Overview
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => toggleGroup(group.key)} style={styles.groupToggle}>
                <Text style={styles.groupToggleText}>{isExpanded ? '−' : '+'}</Text>
              </Pressable>

              {isExpanded ? (
                <View style={styles.groupPanel}>
                  {group.items.map((item) => {
                    const isActive = isGroupActive && active === item.key;
                    return (
                      <Pressable
                        key={`${group.key}-${item.label}`}
                        onPress={() => onNavigate(group.key, item.key)}
                        style={[styles.navItem, isActive && styles.navItemActive]}
                      >
                        <View style={styles.navIcon}>
                          <Text style={[styles.navIconText, isActive && styles.navIconTextActive]}>
                            {isActive ? '◆' : '◇'}
                          </Text>
                        </View>
                        <View style={styles.navCopy}>
                          <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
                          {item.helper ? (
                            <Text style={[styles.navHelper, isActive && styles.navHelperActive]}>{item.helper}</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}

        {filteredGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptyCopy}>Try a broader search for SAM or AI workflows.</Text>
          </View>
        ) : null}
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
    width: 320,
    backgroundColor: '#081122',
    borderRightWidth: 1,
    borderRightColor: palette.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  brandBlock: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.label,
    color: '#93A4C3',
    letterSpacing: 2.2,
  },
  brand: {
    ...typography.h1,
    color: palette.textPrimary,
    fontSize: 22,
  },
  subtitle: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(15,21,39,0.85)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
  },
  searchIcon: {
    color: '#A8B5CF',
    fontSize: 18,
    lineHeight: 18,
  },
  searchInput: {
    flex: 1,
    color: palette.textPrimary,
    ...typography.body,
    paddingVertical: 0,
  },
  nav: {
    flex: 1,
  },
  navContent: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  groupBlock: {
    gap: spacing.sm,
  },
  groupHeader: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  groupHeaderActive: {
    backgroundColor: 'rgba(47,86,216,0.18)',
  },
  groupHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  groupLabel: {
    ...typography.label,
    color: '#D7E1F6',
    letterSpacing: 3,
  },
  groupLabelActive: {
    color: '#FFFFFF',
  },
  groupHelper: {
    ...typography.caption,
    color: '#8191AF',
  },
  groupHelperActive: {
    color: '#C9D5EC',
  },
  groupToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    backgroundColor: 'rgba(22,30,49,0.92)',
    alignSelf: 'flex-end',
  },
  groupToggleText: {
    color: '#C9D5EC',
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '700',
  },
  groupPanel: {
    borderRadius: radius.xl,
    backgroundColor: 'rgba(20,28,46,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.1)',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  navItemActive: {
    backgroundColor: '#2F56D8',
  },
  navIcon: {
    width: 20,
    alignItems: 'center',
  },
  navIconText: {
    color: '#90A2C2',
    fontSize: 12,
  },
  navIconTextActive: {
    color: '#FFFFFF',
  },
  navCopy: {
    flex: 1,
    gap: 2,
  },
  navLabel: {
    ...typography.body,
    color: '#D5DEEF',
    fontSize: 15,
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  navHelper: {
    ...typography.caption,
    color: '#8191AF',
  },
  navHelperActive: {
    color: 'rgba(255,255,255,0.76)',
  },
  emptyState: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(15,21,39,0.72)',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: palette.textPrimary,
  },
  emptyCopy: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    gap: spacing.xs,
  },
  adminName: {
    ...typography.caption,
    color: palette.textMuted,
  },
  logout: {
    ...typography.caption,
    color: palette.violet,
    fontWeight: '700',
  },
});
