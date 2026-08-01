import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BrandLogo from './BrandLogo';
import { journeyPalette } from '../theme/journeyPalette';

export type JourneySidebarItem = 'Home' | 'StartJourney' | 'MyJourneys';

type Props = {
  active: JourneySidebarItem;
  onSelect: (item: JourneySidebarItem) => void;
  userName: string;
  onProfile: () => void;
};

const ITEMS: Array<{ key: JourneySidebarItem; label: string; icon: string }> = [
  { key: 'Home', label: 'Home', icon: '⌂' },
  { key: 'StartJourney', label: 'Start a Journey', icon: '+' },
  { key: 'MyJourneys', label: 'My Journeys', icon: '🧭' },
];

/** Desktop-only left rail. Mobile uses BottomNav instead — same screen, same data. */
export default function JourneySidebar({ active, onSelect, userName, onProfile }: Props) {
  return (
    <View style={styles.rail}>
      <View style={styles.brandRow}>
        <BrandLogo height={44} />
      </View>

      <View style={styles.nav}>
        {ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={[styles.navItem, isActive && styles.navItemActive]}
            >
              <Text style={[styles.navIcon, isActive && styles.navTextActive]}>{item.icon}</Text>
              <Text style={[styles.navLabel, isActive && styles.navTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={onProfile} accessibilityRole="button" style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(userName || 'P').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.profileName} numberOfLines={1}>
            {userName || 'Your profile'}
          </Text>
          <Text style={styles.profileHint}>View profile</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 248,
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderRightWidth: 1,
    borderRightColor: journeyPalette.border,
    backgroundColor: journeyPalette.surface,
    gap: 28,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  nav: { gap: 4, flex: 1 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navItemActive: { backgroundColor: 'rgba(139,92,246,0.16)' },
  navIcon: { color: journeyPalette.textMuted, fontSize: 16, width: 18, textAlign: 'center' },
  navLabel: { color: journeyPalette.textSecondary, fontSize: 14, fontWeight: '700' },
  navTextActive: { color: journeyPalette.purpleLight },

  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: journeyPalette.border,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(59,130,246,0.22)',
    borderWidth: 1,
    borderColor: journeyPalette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: journeyPalette.textPrimary, fontSize: 14, fontWeight: '800' },
  profileText: { flex: 1 },
  profileName: { color: journeyPalette.textPrimary, fontSize: 13, fontWeight: '700' },
  profileHint: { color: journeyPalette.textMuted, fontSize: 11, fontWeight: '600' },
});
