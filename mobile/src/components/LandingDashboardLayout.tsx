import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { getLandingPalette, LandingPalette } from '../theme/landingPalette';
import { radius, spacing } from '../theme/designSystem';

export type LandingNavKey = 'home' | 'lobbies' | 'streams' | 'messages';

type NavItem = {
  key: LandingNavKey;
  label: string;
  icon: string;
};

type OnlineFriend = {
  id: string;
  name: string;
  status: string;
  level: number;
  online: boolean;
};

type ActiveLobby = {
  id: string;
  title: string;
  players: number;
  code: string;
  live?: boolean;
};

type Styles = ReturnType<typeof makeStyles>;

type Props = {
  children: React.ReactNode;
  activeNav: LandingNavKey;
  onNavPress: (key: LandingNavKey) => void;
  onJoinLobby: (code: string) => void;
  onlineFriends: OnlineFriend[];
  activeLobbies: ActiveLobby[];
};

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'lobbies', label: 'Lobbies', icon: '◎' },
  { key: 'streams', label: 'Streams', icon: '▶' },
  { key: 'messages', label: 'Messages', icon: '✉' },
];

const DESKTOP_BREAKPOINT = 1024;

function NavLink({
  item,
  active,
  onPress,
  styles,
}: {
  item: NavItem;
  active: boolean;
  onPress: () => void;
  styles: Styles;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <TouchableOpacity
      style={[
        styles.navItem,
        active && styles.navItemActive,
        hovered && !active && styles.navItemHover,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      {...(Platform.OS === 'web'
        ? {
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          }
        : {})}
    >
      <Text style={[styles.navIcon, active && styles.navIconActive]}>{item.icon}</Text>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
      {active ? <View style={styles.navActiveBar} /> : null}
    </TouchableOpacity>
  );
}

function PanelCard({ title, children, styles }: { title: string; children: React.ReactNode; styles: Styles }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function LandingDashboardLayout({
  children,
  activeNav,
  onNavPress,
  onJoinLobby,
  onlineFriends,
  activeLobbies,
}: Props) {
  const { width } = useWindowDimensions();
  const { isDark } = useTheme();
  const palette = getLandingPalette(isDark);
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  if (!isDesktop) {
    return <View style={styles.mobileShell}>{children}</View>;
  }

  return (
    <View style={styles.shell}>
      <View style={styles.leftRail}>
        <View style={styles.brandBlock}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>P</Text>
          </View>
          <View>
            <Text style={styles.brandName}>PREDIKT</Text>
            <Text style={styles.brandParent}>by Kriviksha</Text>
          </View>
        </View>

        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={activeNav === item.key}
              onPress={() => onNavPress(item.key)}
              styles={styles}
            />
          ))}
        </View>

        <View style={styles.railFooter}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeLabel}>GUEST</Text>
            <Text style={styles.levelBadgeValue}>LVL —</Text>
          </View>
          <Text style={styles.railFooterCopy}>Sign in to track Aura & streaks</Text>
        </View>
      </View>

      <View style={styles.centerColumn}>
        <ScrollView
          contentContainerStyle={styles.centerScroll}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>

      <View style={styles.rightRail}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rightScroll}>
          <PanelCard title="Online Friends" styles={styles}>
            <View style={styles.friendList}>
              {onlineFriends.map((friend) => (
                <View key={friend.id} style={styles.friendRow}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>{friend.name[0]}</Text>
                    {friend.online ? <View style={styles.onlineDot} /> : null}
                  </View>
                  <View style={styles.friendMeta}>
                    <Text style={styles.friendName}>{friend.name}</Text>
                    <Text style={styles.friendStatus}>{friend.status}</Text>
                  </View>
                  <View style={styles.levelPill}>
                    <Text style={styles.levelPillText}>LVL {friend.level}</Text>
                  </View>
                </View>
              ))}
            </View>
          </PanelCard>

          <PanelCard title="Active Game Lobbies" styles={styles}>
            <View style={styles.lobbyList}>
              {activeLobbies.map((lobby) => (
                <View key={lobby.id} style={styles.lobbyCard}>
                  <View style={styles.lobbyTop}>
                    <Text style={styles.lobbyTitle} numberOfLines={2}>
                      {lobby.title}
                    </Text>
                    {lobby.live ? (
                      <View style={styles.liveTag}>
                        <View style={styles.liveTagDot} />
                        <Text style={styles.liveTagText}>LIVE</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.lobbyMeta}>
                    {lobby.players} playing · {lobby.code}
                  </Text>
                  <TouchableOpacity
                    style={styles.joinLobbyBtn}
                    onPress={() => onJoinLobby(lobby.code)}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={palette.gradPrimary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.joinLobbyGradient}
                    >
                      <Text style={styles.joinLobbyText}>Join Lobby</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </PanelCard>
        </ScrollView>
      </View>
    </View>
  );
}

function makeStyles(p: LandingPalette) {
  return StyleSheet.create({
    mobileShell: { flex: 1, backgroundColor: p.bg },
    shell: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: p.bg,
      minHeight: '100%',
    },
    leftRail: {
      width: 210,
      borderRightWidth: 1,
      borderRightColor: p.border,
      backgroundColor: p.surface,
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg,
      justifyContent: 'space-between',
    },
    brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.xl },
    brandMark: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surfaceTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandMarkText: { color: p.coral, fontSize: 22, fontWeight: '900' },
    brandName: { color: p.text, fontSize: 14, fontWeight: '900', letterSpacing: 2.2 },
    brandParent: { color: p.textSoft, fontSize: 9, fontWeight: '700', marginTop: 2, letterSpacing: 0.4 },
    navList: { gap: 4, flex: 1 },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: 10,
      position: 'relative',
    },
    navItemHover: { backgroundColor: p.surfaceTint },
    navItemActive: { backgroundColor: p.coralSoft },
    navIcon: { color: p.textSoft, fontSize: 16, width: 18, textAlign: 'center' },
    navIconActive: { color: p.coral },
    navLabel: { color: p.textSoft, fontSize: 13, fontWeight: '700' },
    navLabelActive: { color: p.coral, fontWeight: '900' },
    navActiveBar: {
      position: 'absolute',
      left: 0,
      top: 8,
      bottom: 8,
      width: 3,
      borderRadius: 2,
      backgroundColor: p.coral,
    },
    railFooter: {
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingTop: spacing.md,
      gap: 8,
    },
    levelBadge: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: p.mint,
      backgroundColor: p.mintSoft,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
    },
    levelBadgeLabel: { color: p.mintText, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
    levelBadgeValue: { color: p.text, fontSize: 12, fontWeight: '800' },
    railFooterCopy: { color: p.textSoft, fontSize: 10, lineHeight: 14 },
    centerColumn: { flex: 1, minWidth: 0 },
    centerScroll: {
      width: '100%',
      maxWidth: 660,
      alignSelf: 'center',
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.huge,
      gap: spacing.md,
    },
    rightRail: {
      width: 270,
      borderLeftWidth: 1,
      borderLeftColor: p.border,
      backgroundColor: p.surface,
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.md,
    },
    rightScroll: { gap: spacing.md, paddingBottom: spacing.huge },
    panel: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surfaceTint,
      padding: spacing.md,
      gap: spacing.sm,
    },
    panelTitle: { color: p.text, fontSize: 13, fontWeight: '900', marginBottom: 2 },
    friendList: { gap: 8 },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: radius.md,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    friendAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    friendAvatarText: { color: p.text, fontSize: 13, fontWeight: '900' },
    onlineDot: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: p.online,
      borderWidth: 2,
      borderColor: p.surfaceTint,
    },
    friendMeta: { flex: 1, gap: 1 },
    friendName: { color: p.text, fontSize: 12, fontWeight: '800' },
    friendStatus: { color: p.textSoft, fontSize: 10, fontWeight: '600' },
    levelPill: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: p.peach,
      backgroundColor: p.amberBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    levelPillText: { color: p.amberText, fontSize: 9, fontWeight: '900' },
    lobbyList: { gap: 10 },
    lobbyCard: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
      padding: 10,
      gap: 8,
    },
    lobbyTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    lobbyTitle: { color: p.text, fontSize: 12, fontWeight: '800', flex: 1, lineHeight: 16 },
    liveTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: p.berry,
      backgroundColor: p.badgePinkBg,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    liveTagDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: p.berry },
    liveTagText: { color: p.berry, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
    lobbyMeta: { color: p.textSoft, fontSize: 10, fontWeight: '600' },
    joinLobbyBtn: { borderRadius: radius.sm, overflow: 'hidden' },
    joinLobbyGradient: {
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: radius.sm,
    },
    joinLobbyText: { color: p.onSurfaceDark, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  });
}
