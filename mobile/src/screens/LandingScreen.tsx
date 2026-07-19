import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from '../components/PrimaryButton';
import TextInputField from '../components/TextInputField';
import LandingDashboardLayout, { LandingNavKey } from '../components/LandingDashboardLayout';
import CategoryVotePrompt from '../components/CategoryVotePrompt';
import { CATEGORY_THEMES, CATEGORY_LIST, CategoryTheme } from '../config/categoryTheme';
import { featureFlags, isCategoryEnabled } from '../config/featureFlags';
import { voteCategoryInterest } from '../utils/categoryInterest';
import { RootStackParamList } from '../navigation/types';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { savePendingJoinCode } from '../utils/inviteIntent';
import { getLandingPalette, LandingPalette } from '../theme/landingPalette';
import { radius, spacing } from '../theme/designSystem';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Landing'> };
type MvpFeatureKey = 'arrival_time' | 'food_eta';
type PlayMode = 'friends' | 'solo' | 'bot';

const MVP_FEATURES: MvpFeatureKey[] = ['arrival_time', 'food_eta'];

const playModes: Array<{
  key: PlayMode;
  icon: string;
  label: string;
  tag: string;
  copy: string;
}> = [
  {
    key: 'friends',
    icon: '👥',
    label: 'Squad Up',
    tag: 'GROUP',
    copy: 'Create a lobby, share the code, and see who reads the moment best.',
  },
  {
    key: 'solo',
    icon: '🔮',
    label: 'Go Solo',
    tag: 'SOLO',
    copy: 'No crew? Challenge yourself — commute, delivery, habits. Stack streaks.',
  },
  {
    key: 'bot',
    icon: '🤖',
    label: 'Beat the Bot',
    tag: 'SOON',
    copy: 'Oracle Bot sets the benchmark. Out-predict the machine.',
  },
];

const feedMoments: Array<{
  id: string;
  code: string;
  category: MvpFeatureKey;
  author: string;
  question: string;
  status: 'predicting' | 'locked' | 'result_soon';
  avatars: string[];
  count: number;
  timeAgo: string;
  pulse: string;
  solo?: boolean;
}> = [
  {
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
  },
  {
    id: '2',
    code: 'FOOD9X',
    category: 'food_eta',
    author: 'Priya S.',
    question: 'Biryani lands before the movie?',
    status: 'locked',
    avatars: ['P', 'K', 'S', 'D'],
    count: 11,
    timeAgo: '2m ago',
    pulse: 'locked in',
  },
  {
    id: '3',
    code: 'SOLO7M',
    category: 'arrival_time',
    author: 'You?',
    question: 'Cab hits office by 8:40 — solo streak day 5',
    status: 'result_soon',
    avatars: ['Y'],
    count: 1,
    timeAgo: '4m ago',
    pulse: 'solo run',
    solo: true,
  },
];

const onlineFriends = [
  { id: '1', name: 'Arjun', status: 'In Food ETA lobby', level: 14, online: true },
  { id: '2', name: 'Neha', status: 'Solo streak · day 8', level: 22, online: true },
  { id: '3', name: 'Rohan', status: 'Away · 12m ago', level: 9, online: false },
  { id: '4', name: 'Kavya', status: 'Watching live reveal', level: 17, online: true },
];

const activeLobbies = [
  { id: '1', title: 'Office arrival read — who nails traffic?', players: 7, code: 'ARR4K2', live: true },
  { id: '2', title: 'Dinner ETA faceoff before movie night', players: 11, code: 'FOOD9X', live: true },
  { id: '3', title: 'Solo commute challenge · morning run', players: 1, code: 'SOLO7M', live: false },
];

const vibeTicker = [
  '847 lobbies active across 12 cities',
  '2.4k predictions locked in today',
  'Solo streaks trending — 340 players on a run',
  'New Aura records set in arrival challenges',
];

export default function LandingScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const p = getLandingPalette(isDark);
  const styles = useMemo(() => makeStyles(p), [p]);
  const enabledFeatures = MVP_FEATURES.filter((key) => isCategoryEnabled(key));
  const [activeFeature, setActiveFeature] = useState<MvpFeatureKey>(enabledFeatures[0] ?? 'arrival_time');
  const [activeMode, setActiveMode] = useState<PlayMode>('solo');
  const [activeNav, setActiveNav] = useState<LandingNavKey>('home');
  const [tickerIndex, setTickerIndex] = useState(0);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [invitePreview, setInvitePreview] = useState<any>(null);
  const [gatePrompt, setGatePrompt] = useState<string | null>(null);
  const [votePromptCategory, setVotePromptCategory] = useState<CategoryTheme | null>(null);
  const feedRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  // The desktop shell already shows PREDIKT branding in its left rail, so the
  // in-content header collapses to just its actions there to avoid a double logo.
  const isDesktop = Platform.OS === 'web' && width >= 1024;

  const activeTheme = CATEGORY_THEMES[activeFeature];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const code = new URLSearchParams(window.location.search).get('joinCode')?.trim().toUpperCase();
    if (!code) return;
    setJoinCode(code);
    setShowJoinCode(true);
    void api.get(`/rooms/invite/${code}`).then((res) => setInvitePreview(res.data)).catch(() => null);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % vibeTicker.length);
    }, 3400);
    return () => clearInterval(timer);
  }, []);

  function promptLogin(message: string) {
    setGatePrompt(message);
  }

  function handleCreateFlow() {
    navigation.navigate(isAuthenticated ? 'CreateRoom' : 'Register');
  }

  function handleSoloFlow() {
    navigation.navigate(isAuthenticated ? 'Home' : 'Login');
  }

  function handleModePress(mode: PlayMode) {
    setActiveMode(mode);
    if (mode === 'friends') {
      handleCreateFlow();
      return;
    }
    if (mode === 'solo') {
      handleSoloFlow();
      return;
    }
    promptLogin('Beat the Bot is rolling out soon — log in for early access.');
  }

  function handleNavPress(key: LandingNavKey) {
    setActiveNav(key);
    if (key === 'home') return;
    if (key === 'lobbies') {
      navigation.navigate('JoinRoom');
      return;
    }
    if (key === 'streams') {
      promptLogin('Sign in to follow live prediction streams and room alerts.');
      return;
    }
    promptLogin('Sign in to message friends and share your prediction clips.');
  }

  function handleJoinLobby(code: string) {
    navigation.navigate('JoinRoom', { joinCode: code });
  }

  function statusMeta(status: (typeof feedMoments)[number]['status']) {
    if (status === 'predicting') return { text: 'LIVE', color: p.berry };
    if (status === 'locked') return { text: 'LOCKED', color: p.coral };
    return { text: 'REVEAL', color: p.mintText };
  }

  const feedContent = (
    <>
      <View style={[styles.mobileHeader, isDesktop && styles.mobileHeaderDesktop]}>
        {isDesktop ? null : (
          <View style={styles.brandRow}>
            <View style={styles.betaRow}>
              <View style={styles.betaPill}>
                <Text style={styles.betaPillText}>BETA</Text>
              </View>
              <Text style={styles.betaCopy}>Early access build</Text>
            </View>
            <LinearGradient
              colors={p.gradPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.brandLogoGradient}
            >
              <Text style={styles.brandLogoText}>PREDIKT</Text>
            </LinearGradient>
            <Text style={styles.tagline}>by Kriviksha · predict · play · connect</Text>
          </View>
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

      <View style={styles.tickerBar}>
        <View style={styles.tickerDot} />
        <Text style={styles.tickerText}>{vibeTicker[tickerIndex]}</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroBubbleLarge} />
        <View style={styles.heroBubbleSmall} />
        <View style={styles.heroBadgeRow}>
          <View style={styles.badgePurple}>
            <Text style={styles.badgePurpleText}>SOLO MODE</Text>
          </View>
          <View style={styles.badgeCyan}>
            <Text style={styles.badgeCyanText}>NO BETTING · NO GPS</Text>
          </View>
        </View>
        <Text style={styles.headline}>
          Everyday moments.{'\n'}
          <Text style={styles.headlineAccent}>Serious fun.</Text>
        </Text>
        <Text style={styles.subtext}>
          PREDIKT turns arrivals, food ETAs, and daily calls into quick social challenges — squad up with friends or go solo and build your streak.
        </Text>
        <View style={styles.heroHighlight}>
          <Text style={styles.heroHighlightTitle}>Clear, quick, playful</Text>
          <Text style={styles.heroHighlightCopy}>Create a room, lock your guess, and wait for the reveal. No clutter. No weird setup.</Text>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>30s</Text>
            <Text style={styles.statLabel}>to launch</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>Solo</Text>
            <Text style={styles.statLabel}>or squad</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>Aura</Text>
            <Text style={styles.statLabel}>on every win</Text>
          </View>
        </View>
        <View style={styles.heroCtas}>
          <TouchableOpacity style={styles.ctaPrimaryWrap} onPress={handleCreateFlow}>
            <LinearGradient colors={p.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaPrimary}>
              <Text style={styles.ctaPrimaryText}>Create Lobby</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary} onPress={handleSoloFlow}>
            <Text style={styles.ctaSecondaryText}>{isAuthenticated ? 'Play Solo' : 'Sign in for Solo'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionEyebrow}>PLAY YOUR WAY</Text>
        <Text style={styles.sectionTitle}>Squad, solo, or bot</Text>
      </View>
      <View style={styles.modeRow}>
        {playModes.map((mode) => {
          const selected = activeMode === mode.key;
          return (
            <TouchableOpacity
              key={mode.key}
              style={[styles.modeCard, selected && styles.modeCardSelected]}
              onPress={() => handleModePress(mode.key)}
              activeOpacity={0.9}
            >
              <View style={styles.modeCardTop}>
                <Text style={styles.modeIcon}>{mode.icon}</Text>
                <View style={styles.modeTag}>
                  <Text style={styles.modeTagText}>{mode.tag}</Text>
                </View>
              </View>
              <Text style={styles.modeLabel}>{mode.label}</Text>
              <Text style={styles.modeCopy}>{mode.copy}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeMode === 'solo' ? (
        <View style={styles.soloBanner}>
          <View style={styles.soloBannerBadge}>
            <Text style={styles.soloBannerBadgeText}>SOLO HIGHLIGHT</Text>
          </View>
          <Text style={styles.soloBannerTitle}>Your read. Your streak. Your Aura.</Text>
          <Text style={styles.soloBannerCopy}>
            Challenge yourself on commutes, deliveries, or habits — no lobby required. Perfect when the group chat is dead but your competitive energy isn't.
          </Text>
          <TouchableOpacity onPress={handleSoloFlow}>
            <Text style={styles.soloBannerLink}>{isAuthenticated ? 'Start a solo streak →' : 'Sign in to play solo →'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionEyebrow}>LIVE FEED</Text>
        <Text style={styles.sectionTitle}>Happening now</Text>
      </View>
      <View style={styles.feedList}>
        {feedMoments.map((moment) => {
          const theme = CATEGORY_THEMES[moment.category];
          const status = statusMeta(moment.status);
          return (
            <TouchableOpacity
              key={moment.id}
              style={styles.feedCard}
              activeOpacity={0.92}
              onPress={() => handleJoinLobby(moment.code)}
            >
              <View style={styles.feedCardTop}>
                <View style={styles.feedAuthorRow}>
                  <View style={[styles.feedAvatar, moment.solo && styles.feedAvatarSolo]}>
                    <Text style={styles.feedAvatarText}>{moment.avatars[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.feedAuthor}>{moment.author}</Text>
                    <Text style={styles.feedTime}>{moment.timeAgo}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { borderColor: status.color, backgroundColor: `${status.color}22` }]}>
                  <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.text}</Text>
                </View>
              </View>
              <Text style={styles.feedQuestion}>{moment.question}</Text>
              <View style={styles.feedFooter}>
                <Text style={styles.feedCode}>{moment.code}</Text>
                <Text style={styles.feedMeta}>
                  {moment.count} {moment.count === 1 ? 'player' : 'players'} · {moment.pulse}
                </Text>
              </View>
              <Text style={styles.feedCategory}>
                {theme.icon} {theme.quickStartLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionEyebrow}>CHALLENGE TYPES</Text>
        <Text style={styles.sectionTitle}>Pick your vibe</Text>
      </View>
      <View style={styles.categoryList}>
        {CATEGORY_LIST.map((theme) => {
          const enabled = isCategoryEnabled(theme.key);
          const selected = enabled && activeFeature === (theme.key as MvpFeatureKey);
          return (
            <TouchableOpacity
              key={theme.key}
              style={[styles.categoryCard, selected && styles.categoryCardSelected, !enabled && styles.categoryCardLocked]}
              onPress={() =>
                enabled ? setActiveFeature(theme.key as MvpFeatureKey) : setVotePromptCategory(theme)
              }
            >
              <Text style={styles.categoryIcon}>{theme.icon}</Text>
              <View style={styles.categoryBody}>
                <Text style={styles.categoryLabel}>{theme.quickStartLabel}</Text>
                <Text style={styles.categoryHint}>
                  {enabled ? theme.emptyStateCopy : 'Coming soon — tap to vote for it.'}
                </Text>
              </View>
              {enabled ? (
                selected ? <View style={styles.categoryActiveDot} /> : null
              ) : (
                <View style={styles.comingSoonPill}>
                  <Text style={styles.comingSoonPillText}>SOON</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.howCard}>
        <Text style={styles.howEyebrow}>HOW IT WORKS · {activeTheme.quickStartLabel}</Text>
        <Text style={styles.howTitle}>
          {activeFeature === 'arrival_time'
            ? 'Lock your arrival read. Closest prediction earns Aura.'
            : 'Call Yes, No, or exact minutes. Closest take wins the lobby.'}
        </Text>
        <View style={styles.howSteps}>
          {['Create or join a lobby', 'Submit before lock', 'Reveal + rank update'].map((step, index) => (
            <View key={step} style={styles.howStep}>
              <View style={styles.howStepNum}>
                <Text style={styles.howStepNumText}>{index + 1}</Text>
              </View>
              <Text style={styles.howStepText}>{step}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('JoinRoom')}>
          <Text style={styles.howLink}>Join a live lobby →</Text>
        </TouchableOpacity>
      </View>

      {showJoinCode ? (
        <View style={styles.surfaceCard}>
          <Text style={styles.sectionTitle}>Join with code</Text>
          <Text style={styles.mutedText}>Jump straight into a challenge. No account required to predict.</Text>
          <TextInputField
            label="Room code"
            value={joinCode}
            onChangeText={(value) => setJoinCode(value.toUpperCase())}
            placeholder="DEMO35"
            autoCapitalize="characters"
          />
          <PrimaryButton label="Open Lobby" onPress={() => navigation.navigate('JoinRoom', { joinCode })} />
        </View>
      ) : null}

      {invitePreview ? (
        <View style={styles.surfaceCard}>
          <Text style={styles.sectionTitle}>You're invited</Text>
          <Text style={styles.previewTitle}>{invitePreview.title}</Text>
          <Text style={styles.mutedText}>{invitePreview.question}</Text>
          <Text style={styles.mutedText}>
            {invitePreview.participantCount > 0
              ? `${invitePreview.participantCount} ${invitePreview.participantCount === 1 ? 'friend has' : 'friends have'} predicted · ${invitePreview.inviteCode}`
              : `Be first to call it · ${invitePreview.inviteCode}`}
          </Text>
          <Text style={styles.reassureText}>No account needed — jump straight to your guess.</Text>
          <PrimaryButton
            label="Predict now"
            onPress={async () => {
              await savePendingJoinCode(invitePreview.inviteCode);
              navigation.navigate('JoinRoom', { joinCode: invitePreview.inviteCode });
            }}
          />
          <PrimaryButton
            label="Sign in instead"
            variant="secondary"
            onPress={async () => {
              await savePendingJoinCode(invitePreview.inviteCode);
              navigation.navigate('Login');
            }}
          />
        </View>
      ) : null}

      <LinearGradient colors={p.gradFinal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.finalCta}>
        <Text style={styles.finalKicker}>READY WHEN YOU ARE</Text>
        <Text style={styles.finalTitle}>Let's make the next moment playable.</Text>
        <Text style={styles.finalCopy}>Spin up a squad lobby in 30 seconds, or go solo and chase your streak.</Text>
        <View style={styles.finalBtnRow}>
          <TouchableOpacity style={styles.finalBtnSolid} onPress={handleCreateFlow}>
            <Text style={styles.finalBtnSolidText}>Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.finalBtnGhost} onPress={handleSoloFlow}>
            <Text style={styles.finalBtnGhostText}>Play Solo</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {gatePrompt ? (
        <View style={styles.gateCard}>
          <Text style={styles.sectionTitle}>Sign in to continue</Text>
          <Text style={styles.mutedText}>{gatePrompt}</Text>
          <View style={styles.authRow}>
            <View style={styles.authBtn}>
              <PrimaryButton label="Log In" onPress={() => navigation.navigate('Login')} />
            </View>
            <View style={styles.authBtn}>
              <PrimaryButton label="Sign Up" onPress={() => navigation.navigate('Register')} variant="secondary" />
            </View>
          </View>
        </View>
      ) : null}

      <CategoryVotePrompt
        visible={!!votePromptCategory}
        categoryLabel={votePromptCategory?.label ?? null}
        onVote={() => {
          if (votePromptCategory) voteCategoryInterest(votePromptCategory.key, votePromptCategory.label);
        }}
        onClose={() => setVotePromptCategory(null)}
      />

      <View style={styles.legalRow}>
        {[
          { label: 'Help', action: () => navigation.navigate('Help') },
          { label: 'Privacy', action: () => navigation.navigate('Legal', { slug: 'privacy', title: 'Privacy Policy' }) },
          { label: 'Terms', action: () => navigation.navigate('Legal', { slug: 'terms', title: 'Terms' }) },
          { label: 'Community', action: () => navigation.navigate('Legal', { slug: 'community-guidelines', title: 'Community Guidelines' }) },
          { label: 'Safety', action: () => navigation.navigate('Legal', { slug: 'safety', title: 'Safety Policy' }) },
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
      onlineFriends={onlineFriends}
      activeLobbies={activeLobbies}
    >
      {Platform.OS === 'web' ? (
        feedContent
      ) : (
        <ScrollView
          ref={feedRef}
          contentContainerStyle={styles.mobileScroll}
          showsVerticalScrollIndicator={false}
        >
          {feedContent}
        </ScrollView>
      )}
    </LandingDashboardLayout>
  );
}

function makeStyles(p: LandingPalette) {
  return StyleSheet.create({
  mobileScroll: {
    paddingTop: spacing.huge,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.md,
    backgroundColor: p.bg,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mobileHeaderDesktop: { justifyContent: 'flex-end' },
  brandRow: { alignItems: 'flex-start', gap: 6, flex: 1 },
  betaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  betaPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: p.coral,
    backgroundColor: p.coralSoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  betaPillText: { color: p.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  betaCopy: { color: p.textSoft, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  brandLogoGradient: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  brandLogoText: { color: p.onSurfaceDark, fontSize: 20, fontWeight: '900', letterSpacing: 3 },
  tagline: { color: p.textSoft, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghostBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ghostBtnText: { color: p.textSoft, fontSize: 11, fontWeight: '800' },
  loginBtn: {
    borderRadius: radius.pill,
    backgroundColor: p.coralSoft,
    borderWidth: 1,
    borderColor: p.coral,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  loginBtnText: { color: p.coral, fontSize: 11, fontWeight: '900' },
  tickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surfaceTint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tickerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.berry },
  tickerText: { color: p.textSoft, fontSize: 12, fontWeight: '700', flex: 1 },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surface,
    padding: spacing.xl,
    gap: spacing.md,
    overflow: 'hidden',
    shadowColor: '#F59E72',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroBubbleLarge: {
    position: 'absolute',
    right: -18,
    top: -14,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: p.coralSoft,
  },
  heroBubbleSmall: {
    position: 'absolute',
    right: 70,
    top: 34,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: p.mintSoft,
  },
  heroBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgePurple: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: p.berry,
    backgroundColor: p.badgePinkBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePurpleText: { color: p.berry, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  badgeCyan: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: p.mint,
    backgroundColor: p.mintSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeCyanText: { color: p.mintText, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  headline: { color: p.text, fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -0.7 },
  headlineAccent: { color: p.coral },
  subtext: { color: p.textSoft, fontSize: 14, lineHeight: 22 },
  heroHighlight: {
    borderRadius: 20,
    backgroundColor: p.bgSoft,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    gap: 4,
  },
  heroHighlightTitle: { color: p.text, fontSize: 13, fontWeight: '900' },
  heroHighlightCopy: { color: p.textSoft, fontSize: 12, lineHeight: 18 },
  heroStats: { flexDirection: 'row', gap: 8 },
  statChip: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surfaceTint,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: p.text, fontSize: 13, fontWeight: '900' },
  statLabel: { color: p.textSoft, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroCtas: { flexDirection: 'row', gap: 10 },
  ctaPrimaryWrap: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
  ctaPrimary: { paddingVertical: 14, alignItems: 'center', borderRadius: radius.md },
  ctaPrimaryText: { color: p.onSurfaceDark, fontSize: 14, fontWeight: '900' },
  ctaSecondary: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  ctaSecondaryText: { color: p.text, fontSize: 14, fontWeight: '900' },
  sectionHead: { gap: 2, marginTop: 4 },
  sectionEyebrow: { color: p.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: p.text, fontSize: 20, fontWeight: '900' },
  modeRow: { gap: 10 },
  modeCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surface,
    padding: spacing.lg,
    gap: 6,
  },
  modeCardSelected: { borderColor: p.coral, backgroundColor: p.surfaceTint },
  modeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeIcon: { fontSize: 24 },
  modeTag: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: p.peach,
    backgroundColor: p.amberBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modeTagText: { color: p.amberText, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  modeLabel: { color: p.text, fontSize: 16, fontWeight: '900' },
  modeCopy: { color: p.textSoft, fontSize: 12, lineHeight: 17 },
  soloBanner: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: p.mint,
    backgroundColor: p.mintSoft,
    padding: spacing.lg,
    gap: 8,
  },
  soloBannerBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: p.mint,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  soloBannerBadgeText: { color: p.mintText, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  soloBannerTitle: { color: p.text, fontSize: 16, fontWeight: '900' },
  soloBannerCopy: { color: p.textSoft, fontSize: 13, lineHeight: 19 },
  soloBannerLink: { color: p.coral, fontSize: 12, fontWeight: '900', marginTop: 2 },
  feedList: { gap: 10 },
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: p.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: p.border,
  },
  feedAvatarSolo: { borderColor: p.mint, backgroundColor: p.mintSoft },
  feedAvatarText: { color: p.text, fontSize: 13, fontWeight: '900' },
  feedAuthor: { color: p.text, fontSize: 12, fontWeight: '800' },
  feedTime: { color: p.textSoft, fontSize: 10, fontWeight: '600' },
  statusBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  feedQuestion: { color: p.text, fontSize: 15, fontWeight: '800', lineHeight: 21 },
  feedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedCode: { color: p.coral, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  feedMeta: { color: p.textSoft, fontSize: 10, fontWeight: '700' },
  feedCategory: { color: p.textSoft, fontSize: 11, fontWeight: '700' },
  categoryList: { gap: 8 },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surface,
    padding: spacing.md,
  },
  categoryCardSelected: { borderColor: p.coral, backgroundColor: p.surfaceTint },
  categoryCardLocked: { opacity: 0.7 },
  comingSoonPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surfaceTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonPillText: { color: p.textSoft, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  reassureText: { color: p.mintText, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  categoryIcon: { fontSize: 28 },
  categoryBody: { flex: 1, gap: 3 },
  categoryLabel: { color: p.text, fontSize: 14, fontWeight: '900' },
  categoryHint: { color: p.textSoft, fontSize: 11, lineHeight: 16 },
  categoryActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: p.coral,
  },
  howCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surface,
    padding: spacing.lg,
    gap: 10,
  },
  howEyebrow: { color: p.textSoft, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  howTitle: { color: p.text, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  howSteps: { gap: 8 },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  howStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: p.coralSoft,
    borderWidth: 1,
    borderColor: p.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepNumText: { color: p.coral, fontSize: 11, fontWeight: '900' },
  howStepText: { color: p.textSoft, fontSize: 12, fontWeight: '700', flex: 1 },
  howLink: { color: p.coral, fontSize: 12, fontWeight: '900' },
  surfaceCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surface,
    padding: spacing.md,
    gap: 6,
  },
  previewTitle: { color: p.text, fontSize: 14, fontWeight: '900' },
  mutedText: { color: p.textSoft, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  finalCta: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: 10,
    overflow: 'hidden',
    shadowColor: '#F58CC0',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  finalKicker: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  finalTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  finalCopy: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19 },
  finalBtnRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  finalBtnSolid: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  finalBtnSolidText: { color: p.onSurfaceDark, fontWeight: '900', fontSize: 13 },
  finalBtnGhost: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  finalBtnGhostText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  gateCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: p.berry,
    backgroundColor: p.gateBg,
    padding: spacing.md,
  },
  authRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  authBtn: { flex: 1 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 14, paddingTop: 8 },
  legalText: { color: p.textSoft, fontSize: 11, fontWeight: '700' },
  });
}
