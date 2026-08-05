import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BrandLogo from './BrandLogo';
import JourneyNavIcon, { type JourneyNavIconName } from './JourneyNavIcon';
import { journeyPalette } from '../theme/journeyPalette';

export type JourneySidebarItem = 'Home' | 'StartJourney' | 'JoinJourney' | 'MyJourneys';

type Props = {
  active: JourneySidebarItem;
  onSelect: (item: JourneySidebarItem) => void;
  userName: string;
  onProfile: () => void;
};

const ITEMS: Array<{ key: JourneySidebarItem; label: string; icon: JourneyNavIconName }> = [
  { key: 'Home', label: 'Home', icon: 'home' },
  { key: 'StartJourney', label: 'Create a Room', icon: 'plus' },
  { key: 'JoinJourney', label: 'Join a Room', icon: 'link' },
  { key: 'MyJourneys', label: 'Your Journeys', icon: 'list' },
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
              <JourneyNavIcon
                name={item.icon}
                color={isActive ? journeyPalette.cyan : journeyPalette.textMuted}
              />
              <Text style={[styles.navLabel, isActive && styles.navTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.botCard}>
        <View style={styles.botBadge}>
          <Text style={styles.botBadgeIcon}>🤖</Text>
        </View>
        <Text style={styles.botTitle}>The bot joins too</Text>
        <Text style={styles.botCopy}>
          More friends, more fun, better predictions. Every challenge gets a playful benchmark.
        </Text>
        <Text style={styles.botSpark}>✦</Text>
      </View>

      {/* Slack lives here so the nav + bot card stay grouped under the logo and the
          profile row pins to the bottom — rather than `nav: flex 1` blowing a hole
          between the nav and the bot card. */}
      <View style={styles.spacer} />

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
    width: 268,
    paddingVertical: 34,
    paddingHorizontal: 20,
    borderRightWidth: 1,
    borderRightColor: journeyPalette.border,
    backgroundColor: journeyPalette.surface,
    gap: 26,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spacer: { flex: 1, minHeight: 24 },

  nav: { gap: 6 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  navItemActive: {
    backgroundColor: journeyPalette.glass,
    borderWidth: 1,
    borderColor: journeyPalette.borderSoft,
    // Offset the border so the active row doesn't shift its neighbours.
    marginVertical: -1,
  },
  navLabel: { color: journeyPalette.textSecondary, fontSize: 15, fontWeight: '600' },
  navTextActive: { color: journeyPalette.purpleLight },
  botCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: journeyPalette.border,
    backgroundColor: 'rgba(17,18,51,0.88)',
    padding: 20,
    gap: 14,
  },
  botBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderWidth: 1,
    borderColor: journeyPalette.borderStrong,
  },
  botBadgeIcon: { fontSize: 26 },
  botTitle: { color: journeyPalette.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: '900' },
  botCopy: { color: journeyPalette.textSecondary, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  botSpark: { color: '#FDE68A', fontSize: 18, fontWeight: '900', alignSelf: 'flex-end' },

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
