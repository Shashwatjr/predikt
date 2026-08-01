import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from '../components/PrimaryButton';
import LandingDashboardLayout, { LandingNavKey } from '../components/LandingDashboardLayout';
import { CATEGORY_THEMES } from '../config/categoryTheme';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getLandingPalette, LandingPalette } from '../theme/landingPalette';
import { radius, spacing } from '../theme/designSystem';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Landing'> };

// Simplified data for the new design
const howItWorksSteps = [
  {
    icon: '✍️',
    title: 'Create a Room',
    description: 'Start a lobby for any moment, like your commute or coffee run.',
  },
  {
    icon: '🔗',
    title: 'Invite Your Friends',
    description: 'Share a simple code. Guests can join without signing up.',
  },
  {
    icon: '🏆',
    title: 'Predict & Win',
    description: 'Closest guess wins Aura points. See the story unfold in The Tea.',
  },
];

const socialProofExample = {
  id: '1',
  code: 'ARR4K2',
  category: 'arrival_time',
  author: 'Maya K.',
  question: 'Will I beat the 9:15 standup?',
  status: 'predicting',
  avatars: ['M', 'A', 'R'],
  count: 7,
  timeAgo: 'just now',
  pulse: '+3 predicting',
};


export default function LandingScreenV2({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const p = getLandingPalette(isDark);
  const styles = useMemo(() => makeStyles(p), [p]);
  const [activeNav, setActiveNav] = useState<LandingNavKey>('home');
  const [showJoinCode, setShowJoinCode] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1024;


  function handleCreateFlow() {
    navigation.navigate(isAuthenticated ? 'CreateRoom' : 'Register');
  }

  function handleJoinLobby(code: string) {
    navigation.navigate('JoinRoom', { joinCode: code });
  }

  function handleNavPress(key: LandingNavKey) {
    setActiveNav(key);
    if (key === 'home') return;
    if (key === 'lobbies') {
      navigation.navigate('JoinRoom');
      return;
    }
    // Simplified nav actions for v2
  }

  const feedContent = (
    <>
      {/* Simplified Header */}
      <View style={[styles.mobileHeader, isDesktop && styles.mobileHeaderDesktop]}>
        {!isDesktop && (
          <Text style={styles.brandLogoText}>My Prediktion</Text>
        )}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.navigate('Help')}>
            <Text style={styles.ghostBtnText}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* V2 Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>NO BETTING · NO GPS · JUST FOR FUN</Text>
        </View>
        <Text style={styles.headline}>
          The social prediction game for you and your friends.
        </Text>
        <Text style={styles.subtext}>
          Turn your everyday ETAs and moments into a fun, friendly challenge. Who knows the future best?
        </Text>
        <View style={styles.heroCtas}>
          <TouchableOpacity style={styles.ctaPrimaryWrap} onPress={handleCreateFlow}>
            <LinearGradient colors={p.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaPrimary}>
              <Text style={styles.ctaPrimaryText}>Create Your First Prediktion</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary} onPress={() => setShowJoinCode((current) => !current)}>
            <Text style={styles.ctaSecondaryText}>Have a code? Join a room</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* V2 "How It Works" Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.howItWorksContainer}>
          {howItWorksSteps.map((step, index) => (
            <View key={index} style={styles.howItWorksCard}>
              <Text style={styles.howItWorksIcon}>{step.icon}</Text>
              <Text style={styles.howItWorksTitle}>{step.title}</Text>
              <Text style={styles.howItWorksDescription}>{step.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* V2 "See it in Action" Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>See It in Action</Text>
        <TouchableOpacity
            style={styles.feedCard}
            activeOpacity={0.92}
            onPress={() => handleJoinLobby(socialProofExample.code)}
        >
            <View style={styles.feedCardTop}>
            <View style={styles.feedAuthorRow}>
                <View style={styles.feedAvatar}>
                <Text style={styles.feedAvatarText}>{socialProofExample.avatars[0]}</Text>
                </View>
                <View>
                <Text style={styles.feedAuthor}>{socialProofExample.author}</Text>
                <Text style={styles.feedTime}>{socialProofExample.timeAgo}</Text>
                </View>
            </View>
            <View style={[styles.statusBadge, { borderColor: p.berry, backgroundColor: `${p.berry}22` }]}>
                <Text style={[styles.statusBadgeText, { color: p.berry }]}>LIVE</Text>
            </View>
            </View>
            <Text style={styles.feedQuestion}>{socialProofExample.question}</Text>
            <View style={styles.feedFooter}>
            <Text style={styles.feedCode}>{socialProofExample.code}</Text>
            <Text style={styles.feedMeta}>
                {socialProofExample.count} players · {socialProofExample.pulse}
            </Text>
            </View>
        </TouchableOpacity>
      </View>
      
      {/* V2 Final CTA */}
      <LinearGradient colors={p.gradFinal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.finalCta}>
        <Text style={styles.finalTitle}>Ready to Play?</Text>
        <Text style={styles.finalCopy}>Spin up a squad lobby in 30 seconds. The next moment is yours to predict.</Text>
        <View style={styles.finalBtnRow}>
          <TouchableOpacity style={styles.finalBtnSolid} onPress={handleCreateFlow}>
            <Text style={styles.finalBtnSolidText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Legal Footer */}
      <View style={styles.legalRow}>
        {[
          { label: 'Help', action: () => navigation.navigate('Help') },
          { label: 'Privacy', action: () => navigation.navigate('Legal', { slug: 'privacy', title: 'Privacy Policy' }) },
          { label: 'Terms', action: () => navigation.navigate('Legal', { slug: 'terms', title: 'Terms' }) },
        ].map((link) => (
          <TouchableOpacity key={link.label} onPress={link.action}>
            <Text style={styles.legalText}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    <LandingDashboardLayout
      activeNav={activeNav}
      onNavPress={handleNavPress}
      onJoinLobby={handleJoinLobby}
      onlineFriends={[]}
      activeLobbies={[]}
    >
        <ScrollView
          contentContainerStyle={styles.mobileScroll}
          showsVerticalScrollIndicator={false}
        >
          {feedContent}
        </ScrollView>
    </LandingDashboardLayout>
  );
}

function makeStyles(p: LandingPalette) {
  return StyleSheet.create({
    mobileScroll: {
        paddingTop: spacing.huge,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.huge,
        gap: spacing.xxl, // Increased gap for more breathing room
        backgroundColor: p.bg,
    },
    mobileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    mobileHeaderDesktop: { justifyContent: 'flex-end' },
    brandLogoText: { color: p.text, fontSize: 22, fontWeight: '900' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ghostBtn: {
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: p.border,
        backgroundColor: p.surface,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    ghostBtnText: { color: p.textSoft, fontSize: 12, fontWeight: '800' },
    loginBtn: {
        borderRadius: radius.pill,
        backgroundColor: p.coralSoft,
        borderWidth: 1,
        borderColor: p.coral,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    loginBtnText: { color: p.coral, fontSize: 12, fontWeight: '900' },
    
    // V2 Hero Section
    heroSection: {
        alignItems: 'center',
        textAlign: 'center',
        gap: spacing.md,
        paddingVertical: spacing.xl,
    },
    heroBadge: {
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: p.mint,
        backgroundColor: p.mintSoft,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginBottom: spacing.sm,
    },
    heroBadgeText: { 
        color: p.mintText, 
        fontSize: 10, 
        fontWeight: '900', 
        letterSpacing: 0.6 
    },
    headline: {
        color: p.text,
        fontSize: 34,
        lineHeight: 40,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: -0.8,
    },
    subtext: {
        color: p.textSoft,
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center',
        maxWidth: 500,
        marginVertical: spacing.sm,
    },
    heroCtas: { 
        flexDirection: 'column', 
        gap: 12, 
        width: '100%', 
        maxWidth: 320, 
        marginTop: spacing.md,
        alignSelf: 'center' 
    },
    ctaPrimaryWrap: { 
        borderRadius: radius.lg, // Larger radius
        overflow: 'hidden',
        width: '100%',
    },
    ctaPrimary: { 
        paddingVertical: 16, // Taller button
        alignItems: 'center' 
    },
    ctaPrimaryText: { 
        color: p.onSurfaceDark, 
        fontSize: 16, 
        fontWeight: '900' 
    },
    ctaSecondary: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    ctaSecondaryText: { 
        color: p.text, 
        fontSize: 14, 
        fontWeight: '700',
        textDecorationLine: 'underline',
    },

    // V2 Section
    section: {
        gap: spacing.lg,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderColor: p.border,
    },
    sectionTitle: { 
        color: p.text, 
        fontSize: 24, 
        fontWeight: '900',
        textAlign: 'center'
    },
    
    // V2 How It Works
    howItWorksContainer: {
        gap: spacing.lg,
    },
    howItWorksCard: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: p.border,
        backgroundColor: p.surface,
        padding: spacing.lg,
        gap: 8,
        alignItems: 'center',
        textAlign: 'center'
    },
    howItWorksIcon: {
        fontSize: 32,
        marginBottom: spacing.xs,
    },
    howItWorksTitle: {
        color: p.text,
        fontSize: 18,
        fontWeight: '900',
    },
    howItWorksDescription: {
        color: p.textSoft,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },

    // V2 Feed Card (Social Proof)
    feedCard: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: p.border,
        backgroundColor: p.surface,
        padding: spacing.lg,
        gap: 8,
    },
    feedCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    feedAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    feedAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: p.surfaceTint,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: p.border,
    },
    feedAvatarText: { color: p.text, fontSize: 14, fontWeight: '900' },
    feedAuthor: { color: p.text, fontSize: 13, fontWeight: '800' },
    feedTime: { color: p.textSoft, fontSize: 11, fontWeight: '600' },
    statusBadge: {
        borderRadius: radius.pill,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    statusBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    feedQuestion: { color: p.text, fontSize: 16, fontWeight: '800', lineHeight: 22 },
    feedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    feedCode: { color: p.coral, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
    feedMeta: { color: p.textSoft, fontSize: 11, fontWeight: '700' },

    // V2 Final CTA
    finalCta: {
        borderRadius: radius.lg,
        padding: spacing.xl,
        gap: 12,
        alignItems: 'center',
        textAlign: 'center',
    },
    finalTitle: { 
        color: '#FFFFFF', 
        fontSize: 26, 
        fontWeight: '900', 
        letterSpacing: -0.4,
        textAlign: 'center',
    },
    finalCopy: { 
        color: 'rgba(255,255,255,0.9)', 
        fontSize: 15, 
        lineHeight: 21,
        textAlign: 'center',
        maxWidth: 400,
    },
    finalBtnRow: { 
        flexDirection: 'row', 
        gap: 10, 
        marginTop: 8 
    },
    finalBtnSolid: {
        backgroundColor: '#FFFFFF',
        borderRadius: radius.lg,
        paddingHorizontal: 24,
        paddingVertical: 14,
    },
    finalBtnSolidText: { 
        color: p.onSurfaceDark, 
        fontWeight: '900', 
        fontSize: 15 
    },

    // Legal Footer
    legalRow: { 
        flexDirection: 'row', 
        justifyContent: 'center', 
        flexWrap: 'wrap', 
        gap: spacing.lg, 
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderColor: p.border, 
    },
    legalText: { color: p.textSoft, fontSize: 12, fontWeight: '700' },
  });
}
