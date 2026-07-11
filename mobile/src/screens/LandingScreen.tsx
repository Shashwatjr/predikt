import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from '../components/PrimaryButton';
import TextInputField from '../components/TextInputField';
import CategoryTile from '../components/CategoryTile';
import CommentaryBubble from '../components/CommentaryBubble';
import MomentCard from '../components/MomentCard';
import { CATEGORY_LIST } from '../config/categoryTheme';
import { palette } from '../theme/designSystem';
import { RootStackParamList } from '../navigation/types';
import WebSideWingLayout from '../components/WebSideWingLayout';
import api from '../services/api';
import { savePendingJoinCode } from '../utils/inviteIntent';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Landing'> };
type DemoChoice = 'Yes' | 'No' | 'Exact time';
type PublicTab = 'Home' | 'Explore' | 'Create' | 'Results' | 'Profile';

const liveRooms = [
  {
    icon: '💼',
    color: '#2563eb',
    question: 'When will Rohan reach office?',
    guesses: 18,
    timeLeft: '22m left',
    timerColor: '#38bdf8',
    preview: 'Office commute Prediction Room. Closest Guess earns demo Aura on this preview.',
  },
  {
    icon: '🛵',
    color: '#ef4444',
    question: 'Will food delivery arrive before 35 mins?',
    guesses: 12,
    timeLeft: '15m left',
    timerColor: '#f59e0b',
    preview: 'Delivery Challenge with Yes, No, and Exact time options.',
  },
  {
    icon: '🏋️',
    color: '#16a34a',
    question: 'Will Neha go to gym tomorrow?',
    guesses: 9,
    timeLeft: '1d left',
    timerColor: '#22c55e',
    preview: 'Friends Challenge with Streaks, Flexes, and a Comeback prompt.',
  },
];

const waysToPlay = [
  { label: 'On the Move', icon: '🚙', tint: '#2563eb' },
  { label: 'Food', icon: '🍕', tint: '#f97316' },
  { label: 'Gym', icon: '🏋️', tint: '#16a34a' },
  { label: 'Friends', icon: '👥', tint: '#9333ea' },
  { label: 'Sports', icon: '🏆', tint: '#d97706' },
];

export default function LandingScreen({ navigation }: Props) {
  const [demoChoice, setDemoChoice] = useState<DemoChoice>('Yes');
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [previewRoom, setPreviewRoom] = useState(liveRooms[1]);
  const [invitePreview, setInvitePreview] = useState<any>(null);
  const [gatePrompt, setGatePrompt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PublicTab>('Home');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const joinCode = new URLSearchParams(window.location.search).get('joinCode')?.trim().toUpperCase();
    if (!joinCode) return;
    setJoinCode(joinCode);
    setShowJoinCode(true);
    void api.get(`/rooms/invite/${joinCode}`).then((res) => setInvitePreview(res.data)).catch(() => null);
  }, []);

  function promptLogin(message: string) {
    setGatePrompt(message);
  }

  function handleBottomNav(tab: PublicTab) {
    setActiveTab(tab);
    if (tab === 'Home') {
      setGatePrompt(null);
      return;
    }
    if (tab === 'Explore') {
      setPreviewRoom(liveRooms[0]);
      setGatePrompt('Explore is showing public demo Prediction Rooms. Login to join a live Challenge.');
      return;
    }
    if (tab === 'Results') {
      setGatePrompt(null);
      return;
    }
    promptLogin(`${tab} is available after login so your Aura, Clout, Credits, Streaks, Flexes, and Drops stay tied to your profile.`);
  }

  return (
    <WebSideWingLayout leftPlacement="landing_left" rightPlacement="landing_right">
    <View style={styles.screen}>
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoP}>P</Text>
            </View>
            <View>
              <Text style={styles.wordmark}>PREDIKT</Text>
              <Text style={styles.tagline}>Turn everyday moments into predictions</Text>
            </View>
          </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.helpButton} onPress={() => navigation.navigate('Help')}>
            <Text style={styles.helpButtonText}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => promptLogin('Login to save alerts for Challenges, Drops, Comebacks, and Rematches.')}>
            <Text style={styles.bell}>🔔</Text>
            <View style={styles.notifyDot} />
          </TouchableOpacity>
            <TouchableOpacity style={styles.botAvatar} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.botFace}>🤖</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={styles.headline}>
              Make your group chats{'\n'}
              <Text style={styles.gradientWord}>playable.</Text>
            </Text>
            <Text style={styles.subtext}>
              Predict arrivals, rain, food ETAs, late friends, and habits. Closest guess wins Aura.
            </Text>
          </View>

          <View style={styles.heroArt}>
            <Text style={styles.pin}>📍</Text>
            <Text style={styles.dumbbell}>🏋️</Text>
            <LinearGradient colors={['rgba(129,140,248,0.1)', 'rgba(168,85,247,0.35)']} style={styles.crystalAura}>
              <View style={styles.crystalShardTop} />
              <LinearGradient colors={['#f0f9ff', '#a855f7', '#4c1d95']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.crystalCore}>
                <View style={styles.crystalFacet} />
              </LinearGradient>
              <View style={styles.crystalBase}>
                <Text style={styles.crystalBaseText}>A</Text>
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.topCtas}>
          <TouchableOpacity style={styles.ctaFlex} onPress={() => setDemoChoice('Yes')}>
            <LinearGradient colors={['#1da1ff', '#9333ea']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryCta}>
              <Text style={styles.ctaIcon}>ϟ</Text>
              <Text style={styles.primaryCtaText}>Start a PREDIKT</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryCta, styles.ctaFlex]} onPress={() => navigation.navigate('JoinRoom')}>
            <Text style={styles.ctaIcon}>♣</Text>
            <Text style={styles.secondaryCtaText}>Join with Code</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.trustCopy}>No betting. No live location sharing. Just fun predictions.</Text>

        <Text style={styles.sectionTitle}>Pick a moment</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
          {CATEGORY_LIST.map((theme) => (
            <CategoryTile key={theme.key} theme={theme} compact onPress={() => promptLogin('Login to start a real PREDIKT with your group.')} />
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>☕ Sample Tea</Text>
        <CommentaryBubble
          personality="Chaos"
          headline="Bangalore traffic read the ETA and chose chaos."
          punchline="Oracle Bot brought spreadsheets. @shashwat brought instinct."
          supportingLine="Route Oracle unlocked."
        />

        <MomentCard
          title="Indiranagar → Koramangala"
          subtitle="Closest guess wins Aura"
          badge="Route Oracle"
          category="Arrival Time"
          handle="@shashwat"
          predictionLabel="9:31 AM"
          actualLabel="9:34 AM"
          differenceLabel="3 min"
          oracleLabel="Oracle Bot: 9:35 AM"
          commentary="Oracle Bot brought spreadsheets. Shashwat brought instinct."
          cta="Join the next PREDIKT"
        />

        <View style={[styles.joinCard, { borderColor: 'rgba(139,92,246,0.35)' }]}>
          <Text style={styles.sectionTitle}>Beat the Bot</Text>
          <Text style={styles.mutedText}>Oracle Bot sets the benchmark. Your instinct sets the story.</Text>
        </View>

        {showJoinCode ? (
          <View style={styles.joinCard}>
            <Text style={styles.sectionTitle}>Join with Code</Text>
            <Text style={styles.mutedText}>Preview a code here. Real participation prompts login/signup.</Text>
            <TextInputField
              label="Room code"
              value={joinCode}
              onChangeText={(value) => setJoinCode(value.toUpperCase())}
              placeholder="DEMO35"
              autoCapitalize="characters"
            />
            <View style={styles.joinPreview}>
              <Text style={styles.previewTitle}>{joinCode || 'DEMO35'} preview</Text>
              <Text style={styles.mutedText}>Delivery Challenge · 12 guesses · 15m left</Text>
            </View>
            <PrimaryButton label="Preview Real Code" onPress={() => navigation.navigate('JoinRoom')} />
          </View>
        ) : null}

        {invitePreview ? (
          <View style={styles.joinCard}>
            <Text style={styles.sectionTitle}>Invite preview</Text>
            <Text style={styles.previewTitle}>{invitePreview.title}</Text>
            <Text style={styles.mutedText}>{invitePreview.question}</Text>
            <Text style={styles.mutedText}>Room code: {invitePreview.inviteCode}</Text>
            <PrimaryButton
              label="Open invite preview"
              onPress={async () => {
                await savePendingJoinCode(invitePreview.inviteCode);
                navigation.navigate('JoinRoom', { joinCode: invitePreview.inviteCode });
              }}
            />
            <PrimaryButton
              label="Login to submit prediction"
              variant="secondary"
              onPress={async () => {
                await savePendingJoinCode(invitePreview.inviteCode);
                navigation.navigate('Login');
              }}
            />
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Live PREDIKTs</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.liveList}>
          {liveRooms.map((room) => {
            const selected = previewRoom.question === room.question;
            return (
              <TouchableOpacity
                key={room.question}
                style={[styles.liveCard, selected && styles.liveCardSelected]}
                onPress={() => {
                  setPreviewRoom(room);
                  setGatePrompt('This is a public preview. Login to submit a real Closest Guess and earn Aura.');
                }}
              >
                <View style={[styles.roomIconCircle, { backgroundColor: room.color }]}>
                  <Text style={styles.roomIcon}>{room.icon}</Text>
                </View>
                <View style={styles.roomText}>
                  <Text style={styles.roomQuestion}>{room.question}</Text>
                  <Text style={styles.roomGuesses}>{room.guesses} guesses</Text>
                </View>
                <View style={styles.timeColumn}>
                  <Text style={[styles.timerText, { color: room.timerColor }]}>◷ {room.timeLeft}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Try it now</Text>
        <LinearGradient colors={['rgba(37,99,235,0.22)', 'rgba(124,58,237,0.2)']} style={styles.demoCard}>
          <View style={styles.scooterArt}>
            <Text style={styles.rider}>🛵</Text>
          </View>
          <View style={styles.demoContent}>
            <Text style={styles.demoQuestion}>Will this delivery arrive before 35 mins?</Text>
            <View style={styles.optionRow}>
              {(['Yes', 'No', 'Exact time'] as DemoChoice[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.option,
                    option === 'Yes' && styles.optionYes,
                    option === 'No' && styles.optionNo,
                    option === 'Exact time' && styles.optionExact,
                    demoChoice === option && styles.optionSelected,
                  ]}
                  onPress={() => setDemoChoice(option)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      option === 'Yes' && styles.optionTextYes,
                      option === 'No' && styles.optionTextNo,
                      option === 'Exact time' && styles.optionTextExact,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.demoResult}>
              <Text style={styles.targetIcon}>🎯</Text>
              <View>
                <Text style={styles.demoResultText}>Your demo guess: 34 mins</Text>
                <Text style={styles.demoResultText}>
                  You would currently rank <Text style={styles.rankText}>#3</Text>
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Popular ways to play</Text>
        <View style={styles.chipRow}>
          {waysToPlay.map((way) => (
            <TouchableOpacity key={way.label} style={[styles.playChip, { backgroundColor: `${way.tint}33` }]}>
              <Text style={styles.chipIcon}>{way.icon}</Text>
              <Text style={styles.chipLabel}>{way.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recent Results</Text>
        <View style={styles.resultCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.crown}>👑</Text>
            <LinearGradient colors={['#fde68a', '#7c3aed']} style={styles.avatar}>
              <Text style={styles.avatarText}>R</Text>
            </LinearGradient>
          </View>
          <View style={styles.resultMain}>
            <Text style={styles.resultTitle}>Rahul predicted 9:42</Text>
            <Text style={styles.resultLine}>Actual arrival: 9:44</Text>
            <Text style={styles.resultLine}>
              Accuracy: <Text style={styles.accuracy}>96%</Text>
            </Text>
          </View>
          <View style={styles.resultBadges}>
            <Text style={styles.winnerBadge}>WINNER 🏆</Text>
            <Text style={styles.auraBadge}>💎 +28 Aura</Text>
            <Text style={styles.playedBadge}>👥 21 played</Text>
          </View>
        </View>

        {activeTab === 'Results' ? (
          <View style={styles.joinCard}>
            <Text style={styles.sectionTitle}>Sample Results</Text>
            <Text style={styles.mutedText}>Moment Cards show Accuracy, Aura, Comeback prompts, Rematch CTAs, and friendly Flexes.</Text>
          </View>
        ) : null}

        <LinearGradient colors={['#6d28d9', '#1d4ed8', '#0ea5e9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createCard}>
          <Text style={styles.createTitle}>Create your first PREDIKT{'\n'}in 30 seconds</Text>
          <TouchableOpacity style={styles.createButton} onPress={() => promptLogin('Create Room is available after login so your room, Credits, and Clout are saved.')}>
            <Text style={styles.createButtonText}>Create Room</Text>
            <Text style={styles.createBolt}>ϟ</Text>
          </TouchableOpacity>
        </LinearGradient>

        {gatePrompt ? (
          <View style={styles.gateCard}>
            <Text style={styles.sectionTitle}>Login to continue</Text>
            <Text style={styles.mutedText}>{gatePrompt}</Text>
            <View style={styles.authRow}>
              <View style={styles.authButton}>
                <PrimaryButton label="Continue to Login" onPress={() => navigation.navigate('Login')} />
              </View>
              <View style={styles.authButton}>
                <PrimaryButton label="Sign Up" onPress={() => navigation.navigate('Register')} variant="secondary" />
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => navigation.navigate('Help')}>
            <Text style={styles.legalText}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Legal', { slug: 'privacy', title: 'Privacy Policy' })}>
            <Text style={styles.legalText}>Privacy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Legal', { slug: 'terms', title: 'Terms' })}>
            <Text style={styles.legalText}>Terms</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Legal', { slug: 'community-guidelines', title: 'Community Guidelines' })}>
            <Text style={styles.legalText}>Community</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Legal', { slug: 'safety', title: 'Safety Policy' })}>
            <Text style={styles.legalText}>Safety</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        {(['Home', 'Explore', 'Create', 'Results', 'Profile'] as PublicTab[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity key={tab} style={styles.navItem} onPress={() => handleBottomNav(tab)}>
              {tab === 'Create' ? (
                <LinearGradient colors={['#38bdf8', '#7c3aed']} style={styles.createNavIcon}>
                  <Text style={styles.createNavPlus}>+</Text>
                </LinearGradient>
              ) : (
                <Text style={[styles.navIcon, active && styles.navIconActive]}>
                  {tab === 'Home' ? '⌂' : tab === 'Explore' ? '○' : tab === 'Results' ? '▥' : '♙'}
                </Text>
              )}
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
    </WebSideWingLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030816' },
  bgGlowTop: {
    position: 'absolute',
    top: -140,
    right: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(124,58,237,0.45)',
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -130,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(14,165,233,0.25)',
  },
  container: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 108, gap: 11 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0f1b45',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ skewX: '-10deg' }],
  },
  logoP: { color: '#8b5cf6', fontSize: 29, fontWeight: '900', transform: [{ skewX: '10deg' }] },
  wordmark: { color: '#fff', fontSize: 27, fontWeight: '900', letterSpacing: 4 },
  tagline: { color: 'rgba(255,255,255,0.72)', fontSize: 9, marginTop: 1, fontWeight: '700' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  helpButton: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,23,52,0.8)',
  },
  helpButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bell: { fontSize: 20 },
  notifyDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  botAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.55)',
  },
  botFace: { fontSize: 22 },
  hero: { minHeight: 176, flexDirection: 'row', alignItems: 'center' },
  heroText: { flex: 1.2 },
  headline: { color: '#fff', fontSize: 28, lineHeight: 35, fontWeight: '900', letterSpacing: -0.4 },
  gradientWord: { color: '#8b5cf6' },
  subtext: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18, marginTop: 10 },
  trustCopy: { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '700', marginTop: 4 },
  heroArt: { flex: 0.85, minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  pin: { position: 'absolute', left: 0, top: 58, fontSize: 28 },
  dumbbell: { position: 'absolute', right: -6, top: 34, fontSize: 27, transform: [{ rotate: '-24deg' }] },
  crystalAura: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  crystalShardTop: {
    position: 'absolute',
    top: 7,
    width: 48,
    height: 66,
    backgroundColor: 'rgba(216,180,254,0.34)',
    transform: [{ rotate: '28deg' }],
    borderRadius: 12,
  },
  crystalCore: {
    width: 58,
    height: 92,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    alignItems: 'center',
  },
  crystalFacet: { width: 1, flex: 1, backgroundColor: 'rgba(255,255,255,0.46)' },
  crystalBase: {
    position: 'absolute',
    bottom: 13,
    width: 68,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(76,29,149,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crystalBaseText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  topCtas: { flexDirection: 'row', gap: 11 },
  ctaFlex: { flex: 1 },
  primaryCta: { height: 44, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  secondaryCta: {
    height: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: 'rgba(3,8,22,0.72)',
  },
  ctaIcon: { color: '#fff', fontSize: 15, fontWeight: '900' },
  primaryCtaText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  secondaryCtaText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  joinCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.26)',
    backgroundColor: 'rgba(12,23,52,0.9)',
    padding: 14,
  },
  joinPreview: { borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 12, marginBottom: 8 },
  previewTitle: { color: '#fff', fontSize: 13, fontWeight: '900', marginBottom: 2 },
  mutedText: { color: 'rgba(255,255,255,0.64)', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#a855f7' },
  liveText: { color: '#a855f7', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  liveList: { gap: 8 },
  liveCard: {
    minHeight: 51,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    backgroundColor: 'rgba(10,20,46,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  liveCardSelected: { borderColor: 'rgba(124,58,237,0.55)', backgroundColor: 'rgba(30,41,88,0.88)' },
  roomIconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  roomIcon: { fontSize: 17 },
  roomText: { flex: 1 },
  roomQuestion: { color: '#fff', fontSize: 12.4, fontWeight: '800', lineHeight: 16 },
  roomGuesses: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 },
  timeColumn: { alignItems: 'flex-end', flexDirection: 'row', gap: 7 },
  timerText: { fontSize: 11.5, fontWeight: '800' },
  chevron: { color: 'rgba(255,255,255,0.6)', fontSize: 25, fontWeight: '300' },
  demoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
    minHeight: 122,
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  scooterArt: { width: 102, alignItems: 'center', justifyContent: 'center' },
  rider: { fontSize: 64 },
  demoContent: { flex: 1, justifyContent: 'center' },
  demoQuestion: { color: '#fff', fontSize: 13.5, fontWeight: '900', lineHeight: 18, marginBottom: 8 },
  optionRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  option: { borderRadius: 10, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 13 },
  optionSelected: { backgroundColor: 'rgba(255,255,255,0.07)' },
  optionYes: { borderColor: '#22c55e' },
  optionNo: { borderColor: '#ef4444' },
  optionExact: { borderColor: '#a855f7' },
  optionText: { fontSize: 11, fontWeight: '900' },
  optionTextYes: { color: '#22c55e' },
  optionTextNo: { color: '#ef4444' },
  optionTextExact: { color: '#fff' },
  demoResult: {
    marginTop: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetIcon: { fontSize: 25 },
  demoResultText: { color: 'rgba(255,255,255,0.82)', fontSize: 11.2, lineHeight: 15 },
  rankText: { color: '#f59e0b', fontWeight: '900' },
  chipRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  playChip: { borderRadius: 17, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipIcon: { fontSize: 13 },
  chipLabel: { color: '#fff', fontSize: 10.2, fontWeight: '800' },
  resultCard: {
    minHeight: 76,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.44)',
    backgroundColor: 'rgba(20,24,62,0.92)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  crown: { position: 'absolute', top: -7, left: 0, fontSize: 20, zIndex: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  resultMain: { flex: 1 },
  resultTitle: { color: '#fff', fontSize: 13.2, fontWeight: '900', marginBottom: 3 },
  resultLine: { color: 'rgba(255,255,255,0.66)', fontSize: 11.2, lineHeight: 15 },
  accuracy: { color: '#22c55e', fontWeight: '900' },
  resultBadges: { alignItems: 'flex-end', gap: 6 },
  winnerBadge: { color: '#fbbf24', borderWidth: 1, borderColor: 'rgba(251,191,36,0.42)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: '900' },
  auraBadge: { color: '#fff', backgroundColor: 'rgba(124,58,237,0.28)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, fontSize: 10.5, fontWeight: '800' },
  playedBadge: { color: '#dbeafe', backgroundColor: 'rgba(37,99,235,0.25)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, fontSize: 10.5, fontWeight: '800' },
  createCard: { borderRadius: 12, minHeight: 72, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  createTitle: { color: '#fff', flex: 1, fontSize: 17, lineHeight: 23, fontWeight: '900' },
  createButton: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  createButtonText: { color: '#3730a3', fontWeight: '900', fontSize: 13.5 },
  createBolt: { color: '#2563eb', fontWeight: '900', fontSize: 16 },
  gateCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(168,85,247,0.5)', backgroundColor: 'rgba(24,19,55,0.96)', padding: 14 },
  authRow: { flexDirection: 'row', gap: 10 },
  authButton: { flex: 1 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: 14, paddingTop: 4 },
  legalText: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700' },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 82,
    paddingTop: 11,
    paddingBottom: 14,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(96,165,250,0.12)',
    backgroundColor: 'rgba(3,8,22,0.96)',
    flexDirection: 'row',
  },
  navItem: { flex: 1, alignItems: 'center', gap: 5 },
  navIcon: { color: 'rgba(255,255,255,0.62)', fontSize: 24, fontWeight: '500' },
  navIconActive: { color: '#60a5fa' },
  navLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 10, fontWeight: '700' },
  navLabelActive: { color: '#93c5fd' },
  createNavIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  createNavPlus: { color: '#fff', fontSize: 31, lineHeight: 34, fontWeight: '300' },
});
