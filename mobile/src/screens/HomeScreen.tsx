import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getApiErrorMessage } from '../services/api';
import { fetchRoom } from '../services/dashboard';
import { useDashboardData } from '../hooks/useDashboardData';
import DashboardOnboardingOverlay from '../components/DashboardOnboardingOverlay';
import DemoScenarioPicker, { DemoWalkthroughBanner } from '../components/DemoScenarioPicker';
import { isDemoAccount, type DemoScenario } from '../config/demoScenarios';
import {
  hasSeenDemoScenarioPicker,
  markDemoScenarioPickerSeen,
} from '../services/demoWalkthroughStorage';
import WebSideWingLayout from '../components/WebSideWingLayout';
import ActivePredictionCard from '../components/ActivePredictionCard';
import { fetchUnreadNotificationCount } from '../services/notifications';
import {
  completeDashboardOnboarding,
  hasCompletedDashboardOnboarding,
} from '../services/onboardingStorage';
import AppHeader from '../components/AppHeader';
import BottomNav, { NavTab } from '../components/BottomNav';
import CategoryTile from '../components/CategoryTile';
import CategoryVotePrompt from '../components/CategoryVotePrompt';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';
import { CATEGORY_LIST, CategoryTheme, getOpenPredictionSubtypeConfig } from '../config/categoryTheme';
import { featureFlags, isCategoryEnabled } from '../config/featureFlags';
import { voteCategoryInterest } from '../utils/categoryInterest';
import { palette } from '../theme/designSystem';
import { hasSeenTodaysTea, markTodaysTeaSeen } from '../services/todaysTeaStorage';
import { buildTodaysTea, TodaysTea } from '../utils/todaysTea';
import TodaysTeaOverlay from '../components/TodaysTeaOverlay';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
  route: RouteProp<RootStackParamList, 'Home'>;
};

type DemoChoice = 'Yes' | 'No' | 'Exact time';
type HomeTab = NavTab;
type ActivePredictionFilter = 'all' | 'needs_prediction' | 'live_now' | 'result_ready' | 'created_by_me';
type CreateRoomPresetCategory = NonNullable<RootStackParamList['CreateRoom']>['presetCategory'];

const fallbackLiveRooms = [
  {
    roomId: 'office-demo',
    icon: '💼',
    color: '#2563eb',
    question: 'When will Rohan reach office?',
    guesses: 18,
    timeLeft: '22m left',
    timerColor: '#38bdf8',
  },
  {
    roomId: 'delivery-demo',
    icon: '🍅',
    color: '#ef4444',
    question: 'Will dinner arrive before 35 mins?',
    guesses: 12,
    timeLeft: '15m left',
    timerColor: '#f59e0b',
  },
  {
    roomId: 'gym-demo',
    icon: '🏋️',
    color: '#16a34a',
    question: 'Will Neha go to gym tomorrow?',
    guesses: 9,
    timeLeft: '1d left',
    timerColor: '#22c55e',
  },
];

const waysToPlay = [
  { label: 'On the Move', icon: '🚙', tint: '#2563eb' },
  { label: 'Food', icon: '🍕', tint: '#f97316' },
  { label: 'Gym', icon: '🏋️', tint: '#16a34a' },
  { label: 'Friends', icon: '👥', tint: '#06B6D4' },
  { label: 'Sports', icon: '⚽', tint: '#d97706' },
];

export default function HomeScreen({ navigation, route }: Props) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { dashboard, activePredictions, loading, loadDashboard, reorderActivePredictions } = useDashboardData();
  const [tourVisible, setTourVisible] = useState(false);
  const [demoPickerVisible, setDemoPickerVisible] = useState(false);
  const [demoHubExpanded, setDemoHubExpanded] = useState(false);
  const [demoChoice, setDemoChoice] = useState<DemoChoice>('Yes');
  const [activeTab, setActiveTab] = useState<HomeTab>('Home');
  const [activePredictionFilter, setActivePredictionFilter] = useState<ActivePredictionFilter>('all');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [todaysTea, setTodaysTea] = useState<TodaysTea | null>(null);
  const [teaVisible, setTeaVisible] = useState(false);
  const [votePromptCategory, setVotePromptCategory] = useState<CategoryTheme | null>(null);
  const teaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summary = dashboard?.summary;
  const userId = user?.userId;
  const userName = user?.name;
  const demoAccount = isDemoAccount(user);
  const showDemoHub = !demoAccount || demoHubExpanded;
  // Single source of truth — the Sports theme lives in categoryTheme.ts.
  const sportsCategoryTheme: CategoryTheme = getOpenPredictionSubtypeConfig('sports').theme;

  useEffect(() => {
    fetchUnreadNotificationCount()
      .then(setUnreadNotifications)
      .catch(() => setUnreadNotifications(0));
  }, [dashboard]);

  // Refresh the hub whenever Home regains focus (e.g. after creating a room or
  // starting a journey in LiveRoom) so newly live rooms show up in the live
  // section. The hook already loads on mount, so skip the first focus.
  const didInitialFocusRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didInitialFocusRef.current) {
        didInitialFocusRef.current = true;
        return;
      }
      void loadDashboard({ silent: true });
    }, [loadDashboard]),
  );

  useEffect(() => {
    let active = true;

    async function maybeShowTour() {
      if (route.params?.replayOnboarding) {
        if (active) setTourVisible(true);
        navigation.setParams({ replayOnboarding: undefined });
        return;
      }

      const alreadyCompleted = await hasCompletedDashboardOnboarding();
      if (!alreadyCompleted && active) {
        setTourVisible(true);
      }
    }

    void maybeShowTour();

    return () => {
      active = false;
    };
  }, [navigation, route.params?.replayOnboarding]);

  useEffect(() => {
    let active = true;

    async function maybeShowDemoPicker() {
      if (route.params?.replayDemoPicker) {
        if (active) setDemoPickerVisible(true);
        navigation.setParams({ replayDemoPicker: undefined });
        return;
      }

      if (!demoAccount || loading || tourVisible) return;

      const alreadySeen = await hasSeenDemoScenarioPicker();
      if (!alreadySeen && active) {
        setDemoPickerVisible(true);
      }
    }

    void maybeShowDemoPicker();

    return () => {
      active = false;
    };
  }, [demoAccount, loading, navigation, route.params?.replayDemoPicker, tourVisible]);

  useEffect(() => {
    if (!userId || loading || tourVisible) {
      return;
    }

    let active = true;
    const currentUserId = userId;

    async function maybeShowTodaysTea() {
      const alreadySeen = await hasSeenTodaysTea(currentUserId);
      if (!active || alreadySeen) return;

      const nextTea = buildTodaysTea({
        userName,
        summary,
        activePredictions,
        followingLeaderboard: dashboard?.followingLeaderboard ?? [],
      });

      setTodaysTea(nextTea);
      setTeaVisible(true);
      await markTodaysTeaSeen(currentUserId);

      const baseDuration = 3200 + Math.min(3, nextTea.body.length % 4) * 700;
      teaTimerRef.current = setTimeout(() => {
        if (active) {
          setTeaVisible(false);
        }
      }, baseDuration);
    }

    void maybeShowTodaysTea();

    return () => {
      active = false;
    };
  }, [activePredictions, dashboard?.followingLeaderboard, loading, summary, tourVisible, userId, userName]);

  useEffect(() => {
    return () => {
      if (teaTimerRef.current) {
        clearTimeout(teaTimerRef.current);
      }
    };
  }, []);

  const filteredActivePredictions = useMemo(() => {
    return activePredictions.filter((room) => {
      if (activePredictionFilter === 'needs_prediction') return !room.hasSubmittedPrediction;
      if (activePredictionFilter === 'live_now') return room.status === 'live';
      if (activePredictionFilter === 'result_ready') return room.status === 'result_ready';
      if (activePredictionFilter === 'created_by_me') return room.isCreator;
      return true;
    });
  }, [activePredictionFilter, activePredictions]);
  const liveRooms = useMemo(() => {
    const activeRooms = activePredictions;
    if (activeRooms.length === 0) return [];

    return activeRooms.slice(0, 3).map((room, index) => {
      const fallback = fallbackLiveRooms[index] ?? fallbackLiveRooms[0];
      return {
        roomId: room.roomId,
        icon: fallback.icon,
        color: fallback.color,
        question: room.title ?? room.roomTitle ?? fallback.question,
        guesses: room.participantCount ?? fallback.guesses,
        timeLeft: room.quickAction?.label ?? room.cta ?? fallback.timeLeft,
        timerColor: fallback.timerColor,
        status: room.status,
        rawRoom: room,
      };
    });
  }, [activePredictions]);

  const hasLiveHubActivity = activePredictions.length > 0;
  const topResult = dashboard?.followingLeaderboard?.[0];
  const hasFollowingResults =
    (dashboard?.followingLeaderboard?.length ?? 0) > 1 || (topResult?.weeklyAura ?? 0) > 0;
  const totalAura = summary?.totalAura ?? user?.totalAura ?? 0;
  const weeklyAura = summary?.weeklyAura ?? user?.weeklyAura ?? 0;
  const demoRank = topResult?.rank ?? 3;

  if (loading) {
    // Skeleton dashboard: same card shapes as the loaded state, with shimmer, so
    // the layout does not jump when data arrives.
    return (
      <WebSideWingLayout leftPlacement="dashboard_left" rightPlacement="dashboard_right">
        <View style={styles.screen}>
          <View style={styles.bgGlowTop} />
          <View style={styles.bgGlowBottom} />
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.skeletonHeaderRow}>
              <View style={{ gap: 8, flex: 1 }}>
                <SkeletonBlock width="55%" height={20} />
                <SkeletonBlock width="40%" height={12} />
              </View>
              <SkeletonBlock width={44} height={44} radius={22} />
            </View>

            {/* Primary + secondary CTAs */}
            <View style={styles.topCtas}>
              <SkeletonBlock width="100%" height={52} radius={14} style={styles.ctaFlex} />
              <SkeletonBlock width="100%" height={52} radius={14} style={styles.ctaFlex} />
            </View>

            {/* Quick start row */}
            <SkeletonBlock width="42%" height={16} style={{ marginTop: 6 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <SkeletonBlock width={120} height={92} radius={14} />
              <SkeletonBlock width={120} height={92} radius={14} />
              <SkeletonBlock width={120} height={92} radius={14} />
            </View>

            {/* Active predictions (Live PREDIKTs) */}
            <SkeletonBlock width="38%" height={16} style={{ marginTop: 6 }} />
            <View style={{ gap: 12 }}>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </View>

            {/* Weekly card */}
            <SkeletonBlock width="46%" height={16} style={{ marginTop: 6 }} />
            <SkeletonCard lines={1} height={96} />

            {/* Comeback / create card */}
            <SkeletonBlock width="100%" height={120} radius={14} />
          </ScrollView>
        </View>
      </WebSideWingLayout>
    );
  }

  async function openRoom(room: any) {
    const roomId = room.rawRoom?.roomId ?? room.roomId;
    const targetScreen = room.rawRoom?.quickAction?.targetScreen;
    if (!room.rawRoom?.roomId) {
      navigation.navigate('CreateRoom');
      return;
    }

    try {
      const fullRoom = await fetchRoom(roomId);
      const normalizedStatus =
        fullRoom.status === 'prediction_open' ? 'predictions_open' : fullRoom.status;
      const isCreator = fullRoom.creatorUserId === user?.userId || fullRoom.creator?.userId === user?.userId;

      if (targetScreen === 'LiveRoom') {
        navigation.navigate('LiveRoom', { roomId, isCreator });
        return;
      }

      if (targetScreen === 'Result') {
        navigation.navigate('Result', { roomId });
        return;
      }

      if (normalizedStatus === 'predictions_open') {
        navigation.navigate('Prediction', { roomId, room: fullRoom });
        return;
      }

      if (normalizedStatus === 'completed' || normalizedStatus === 'reached') {
        navigation.navigate('Result', { roomId });
        return;
      }

      navigation.navigate('LiveRoom', { roomId, isCreator });
    } catch (error: unknown) {
      Alert.alert('Room unavailable', getApiErrorMessage(error, 'Could not open this room right now.'));
    }
  }

  function handleBottomNav(tab: HomeTab) {
    setActiveTab(tab);
    if (tab === 'Home') return;
    if (tab === 'Activity') {
      if (featureFlags.leaderboard) navigation.navigate('Leaderboard');
      return;
    }
    if (tab === 'Create') {
      navigation.navigate('CreateRoom');
      return;
    }
    navigation.navigate('Profile');
  }

  async function closeTour() {
    setTourVisible(false);
    await completeDashboardOnboarding();
  }

  async function closeDemoPicker() {
    setDemoPickerVisible(false);
    await markDemoScenarioPickerSeen();
  }

  async function openDemoScenario(scenario: DemoScenario) {
    const room = activePredictions.find(
      (entry) => entry.inviteCode?.toUpperCase() === scenario.inviteCode.toUpperCase(),
    );

    if (!room) {
      Alert.alert(
        'Scenario unavailable',
        `Could not find room ${scenario.inviteCode}. Re-run seed:engagement-demo and try again.`,
      );
      return;
    }

    await closeDemoPicker();
    await openRoom({ rawRoom: room, roomId: room.roomId });
  }

  function dismissTodaysTea() {
    if (teaTimerRef.current) {
      clearTimeout(teaTimerRef.current);
      teaTimerRef.current = null;
    }
    setTeaVisible(false);
  }

  function togglePin(roomId: string) {
    reorderActivePredictions((items) =>
      items
        .map((item) => (item.roomId === roomId ? { ...item, pinned: !item.pinned } : item))
        .sort((left, right) => {
          if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
          return (left.displayOrder ?? 0) - (right.displayOrder ?? 0);
        }),
    );
  }

  function moveRoom(roomId: string, direction: -1 | 1) {
    reorderActivePredictions((items) => {
      const index = items.findIndex((item) => item.roomId === roomId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return items;
      const next = [...items];
      const [picked] = next.splice(index, 1);
      next.splice(targetIndex, 0, picked);
      return next;
    });
  }

  return (
    <WebSideWingLayout leftPlacement="dashboard_left" rightPlacement="dashboard_right">
      <View style={styles.screen}>
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <AppHeader
            greeting={user?.name ? `Hey, ${user.name.split(' ')[0]}` : 'Hey there'}
            subtitle="What can you PREDIKT today?"
            aura={totalAura}
            streak={summary?.currentStreak ?? user?.currentStreak}
            unreadCount={unreadNotifications}
            onNotifications={
              featureFlags.notifications ? () => navigation.navigate('Notifications') : undefined
            }
            onProfile={() => navigation.navigate('Profile')}
          />

          <LinearGradient colors={['rgba(34,211,238,0.26)', 'rgba(236,72,153,0.16)', 'rgba(56,189,248,0.12)']} style={styles.heroPanel}>
            <View style={styles.heroGlowOrb} />
            <View style={styles.heroGlowOrbSmall} />
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>MVP PILOT</Text>
              </View>
              <View style={[styles.heroBadge, styles.heroBadgeGhost]}>
                <Text style={styles.heroBadgeGhostText}>Predict. Compete. Earn Aura.</Text>
              </View>
            </View>
            <Text style={styles.heroHeadline}>Hey, {user?.name ? user.name.split(' ')[0] : 'MVP'} 👋</Text>
            <Text style={styles.heroCopy}>Predict moments, beat the crowd, and stack Aura across live rooms, quick ETA calls, and friendly faceoffs.</Text>
          </LinearGradient>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{activePredictions.length}</Text>
              <Text style={styles.metricLabel}>Active Predictions</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>#{summary?.rankAmongFollowing ?? demoRank}</Text>
              <Text style={styles.metricLabel}>Rank This Week</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{summary?.currentStreak ?? user?.currentStreak ?? 0}</Text>
              <Text style={styles.metricLabel}>Day Streak</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{totalAura}</Text>
              <Text style={styles.metricLabel}>Aura Earned</Text>
            </View>
          </View>

          <View style={styles.topCtas}>
            <TouchableOpacity
              style={styles.ctaFlex}
              onPress={() =>
                hasLiveHubActivity && liveRooms[0]
                  ? openRoom(liveRooms[0])
                  : navigation.navigate('CreateRoom')
              }
            >
              <LinearGradient colors={['#1da1ff', '#06B6D4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryCta}>
                <Text style={styles.ctaIcon}>⚡</Text>
                <Text style={styles.primaryCtaText}>Start a PREDIKT</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryCta, styles.ctaFlex]} onPress={() => navigation.navigate('JoinRoom')}>
              <Text style={styles.ctaIcon}>🔗</Text>
              <Text style={styles.secondaryCtaText}>Join with Code</Text>
            </TouchableOpacity>
          </View>

          <SectionHeader title="Choose a category" subtitle="Jump straight into the kind of moment you want to call" />
          <View style={styles.categoryQuickGrid}>
            {[sportsCategoryTheme, ...CATEGORY_LIST.filter((theme) => isCategoryEnabled(theme.key) || theme.key === 'gym_habit')].map((theme) => {
              if (theme === sportsCategoryTheme) {
                return (
                  <CategoryTile
                  key="sports-preset"
                  theme={theme}
                  compact
                  centered
                  fill
                  locked={false}
                  onPress={() => navigation.navigate('CreateRoom', { presetCategory: 'sports_prediction' })}
                />
              );
              }
              const enabled = isCategoryEnabled(theme.key);
              const presetCategory = (
                ['arrival_time', 'food_eta', 'open_prediction', 'gym_habit'] as string[]
              ).includes(theme.key)
                ? (theme.key as CreateRoomPresetCategory)
                : undefined;
              return (
                <CategoryTile
                  key={theme.key}
                  theme={theme}
                  compact
                  centered
                  fill
                  locked={!enabled}
                  onPress={() =>
                    enabled
                      ? navigation.navigate('CreateRoom', presetCategory ? { presetCategory } : undefined)
                      : setVotePromptCategory(theme)
                  }
                />
              );
            })}
          </View>

          <SectionHeader title="Live PREDIKTs" live={hasLiveHubActivity} />

          {demoAccount ? (
            <DemoWalkthroughBanner
              roomCount={activePredictions.length}
              hubExpanded={demoHubExpanded}
              onSelect={(scenario) => {
                void openDemoScenario(scenario);
              }}
              onToggleHub={() => setDemoHubExpanded((current) => !current)}
              onOpenPicker={() => setDemoPickerVisible(true)}
            />
          ) : null}

          {showDemoHub ? (
          <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {[
              ['all', 'All'],
              ['needs_prediction', 'Needs my prediction'],
              ['live_now', 'Live now'],
              ['result_ready', 'Result ready'],
              ['created_by_me', 'Created by me'],
            ].map(([value, label]) => {
              const active = activePredictionFilter === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setActivePredictionFilter(value as ActivePredictionFilter)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredActivePredictions.length > 0 ? (
            <View style={styles.activePredictionList}>
              {filteredActivePredictions.map((room, index) => (
                <ActivePredictionCard
                  key={room.roomId}
                  item={room}
                  onOpen={() => openRoom({ roomId: room.roomId, rawRoom: room })}
                  onTogglePin={() => togglePin(room.roomId)}
                  onMoveUp={() => moveRoom(room.roomId, -1)}
                  onMoveDown={() => moveRoom(room.roomId, 1)}
                  disableMoveUp={index === 0}
                  disableMoveDown={index === filteredActivePredictions.length - 1}
                />
              ))}
            </View>
          ) : activePredictions.length === 0 ? (
            <EmptyState
              title="Create your first PREDIKT"
              body="Start a room or join one with a code to fill your live hub."
              primaryLabel="Start a PREDIKT"
              secondaryLabel="Join with Code"
              onPrimary={() => navigation.navigate('CreateRoom')}
              onSecondary={() => navigation.navigate('JoinRoom')}
            />
          ) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>No rooms match this filter</Text>
              <Text style={styles.emptyStateCopy}>Try another filter or open one of your other active rooms.</Text>
            </View>
          )}
          </>
          ) : demoAccount ? (
            <View style={styles.demoHubHint}>
              <Text style={styles.demoHubHintTitle}>Full demo hub hidden</Text>
              <Text style={styles.demoHubHintCopy}>
                Use the walkthrough chips above, or expand to browse all {activePredictions.length} seeded rooms.
              </Text>
            </View>
          ) : null}

          {hasLiveHubActivity ? (
            <>
              <Text style={styles.sectionTitle}>Try it now</Text>
              <LinearGradient colors={['rgba(37,99,235,0.22)', 'rgba(34,211,238,0.2)']} style={styles.demoCard}>
                <View style={styles.scooterArt}>
                  <Text style={styles.rider}>🛵</Text>
                </View>
                <View style={styles.demoContent}>
                  <Text style={styles.demoQuestion}>{dashboard?.dailyChallenge?.title ?? 'Will this delivery arrive before 35 mins?'}</Text>
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
                        You would currently rank <Text style={styles.rankText}>#{demoRank}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </>
          ) : null}

          {/* MVP cleanup: "Popular ways to play" advertises categories beyond the
              two MVP ones (Gym, Sports…) and the chips are non-interactive. Hidden
              until any non-MVP category is re-enabled. */}
          {featureFlags.categoryWeather || featureFlags.categoryWhosLate || featureFlags.categoryGymHabit ? (
            <>
              <Text style={styles.sectionTitle}>Popular ways to play</Text>
              <View style={styles.chipRow}>
                {waysToPlay.map((way) => (
                  <TouchableOpacity key={way.label} style={[styles.playChip, { backgroundColor: `${way.tint}33` }]}>
                    <Text style={styles.chipIcon}>{way.icon}</Text>
                    <Text style={styles.chipLabel}>{way.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          {/* MVP cleanup: "Recent Results" is a following/leaderboard surface. */}
          {featureFlags.leaderboard && hasFollowingResults ? (
            <>
              <Text style={styles.sectionTitle}>Recent Results</Text>
              <View style={styles.resultCard}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.crown}>👑</Text>
                  <LinearGradient colors={['#fde68a', '#22D3EE']} style={styles.avatar}>
                    <Text style={styles.avatarText}>{(topResult?.name ?? user?.name ?? 'R').charAt(0).toUpperCase()}</Text>
                  </LinearGradient>
                </View>
                <View style={styles.resultMain}>
                  <Text style={styles.resultTitle}>
                    {topResult?.prediktHandle ? `@${topResult.prediktHandle}` : topResult?.name ?? 'Friend'} · Rank #{topResult?.rank ?? 1}
                  </Text>
                  <Text style={styles.resultLine}>Weekly Aura: {topResult?.weeklyAura ?? 0}</Text>
                  <Text style={styles.resultLine}>
                    Clout: <Text style={styles.accuracy}>{topResult?.cloutBalance ?? 0}</Text>
                  </Text>
                </View>
                <View style={styles.resultBadges}>
                  {topResult?.rank === 1 ? <Text style={styles.winnerBadge}>TOP 🏆</Text> : null}
                  <Text style={styles.auraBadge}>💎 {topResult?.weeklyAura ?? 0} Aura this week</Text>
                </View>
              </View>
            </>
          ) : null}

          {/* MVP cleanup: weekly personality/story surface — hidden until weeklyStory ships. */}
          {featureFlags.weeklyStory ? (
            <>
              <SectionHeader title="Today's PREDIKTs" subtitle={dashboard?.dailyChallenge?.title ?? 'Beat the Forecast · Food ETA · Who\'s Late'} />

              <View style={[styles.weeklyCard, { borderColor: palette.border }]}>
                <Text style={styles.weeklyTitle}>This Week in PREDIKT</Text>
                <Text style={styles.weeklyPersonality}>
                  {(summary?.currentStreak ?? 0) >= 3 ? 'Comeback Merchant' : weeklyAura > 50 ? 'Route Whisperer' : 'The Human Edge'}
                </Text>
                <Text style={styles.weeklyCopy}>
                  {weeklyAura > 0 ? `+${weeklyAura} Aura this week. Share the story.` : 'Complete a room to unlock your weekly personality.'}
                </Text>
              </View>
            </>
          ) : null}

          <LinearGradient colors={['#06B6D4', '#1d4ed8', '#0ea5e9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createCard}>
            <Text style={styles.createTitle}>Create your first PREDIKT{'\n'}in 30 seconds</Text>
            <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('CreateRoom')}>
              <Text style={styles.createButtonText}>Create Room</Text>
              <Text style={styles.createBolt}>ϟ</Text>
            </TouchableOpacity>
          </LinearGradient>

          {(dashboard?.recommendations ?? []).length > 0 ? (
            <View style={styles.nextMoveCard}>
              <Text style={styles.sectionTitle}>Your next move</Text>
              {(dashboard?.recommendations ?? []).slice(0, 3).map((item, index) => (
                <Text key={`${item}-${index}`} style={styles.mutedText}>• {item}</Text>
              ))}
            </View>
          ) : null}

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </ScrollView>

        <BottomNav
          active={activeTab}
          onChange={handleBottomNav}
          hiddenTabs={featureFlags.leaderboard ? [] : ['Activity']}
        />
        <DashboardOnboardingOverlay visible={tourVisible} onClose={closeTour} />
        <DemoScenarioPicker
          visible={demoPickerVisible}
          onClose={() => {
            void closeDemoPicker();
          }}
          onBrowseAll={() => {
            setDemoHubExpanded(true);
          }}
          onSelect={(scenario) => {
            void openDemoScenario(scenario);
          }}
        />
        <TodaysTeaOverlay visible={teaVisible} tea={todaysTea} onClose={dismissTodaysTea} />
        <CategoryVotePrompt
          visible={!!votePromptCategory}
          categoryLabel={votePromptCategory?.label ?? null}
          onVote={() => {
            if (votePromptCategory) voteCategoryInterest(votePromptCategory.key, votePromptCategory.label);
          }}
          onClose={() => setVotePromptCategory(null)}
        />
      </View>
    </WebSideWingLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060816' },
  bgGlowTop: {
    position: 'absolute',
    top: -140,
    right: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(34,211,238,0.45)',
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
  container: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 112,
    gap: 14,
  },
  heroPanel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.3)',
    backgroundColor: 'rgba(9,12,25,0.96)',
    padding: 22,
    gap: 10,
    overflow: 'hidden',
  },
  heroGlowOrb: {
    position: 'absolute',
    right: -28,
    top: -26,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(34,211,238,0.22)',
  },
  heroGlowOrbSmall: {
    position: 'absolute',
    right: 70,
    top: 24,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(236,72,153,0.18)',
  },
  heroBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.4)',
    backgroundColor: 'rgba(236,72,153,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeGhost: {
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroBadgeText: { color: '#F9A8D4', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  heroBadgeGhostText: { color: 'rgba(255,255,255,0.78)', fontSize: 10, fontWeight: '800' },
  heroHeadline: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -0.6 },
  heroCopy: { color: 'rgba(255,255,255,0.76)', fontSize: 15, lineHeight: 24, maxWidth: 620 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    flexGrow: 1,
    minWidth: '22%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 4,
  },
  metricValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  metricLabel: { color: 'rgba(255,255,255,0.64)', fontSize: 12, fontWeight: '700' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  skeletonHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
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
  logoP: { color: '#22D3EE', fontSize: 29, fontWeight: '900', transform: [{ skewX: '10deg' }] },
  wordmark: { color: '#fff', fontSize: 27, fontWeight: '900', letterSpacing: 4 },
  tagline: { color: 'rgba(255,255,255,0.72)', fontSize: 9, marginTop: 1, fontWeight: '700' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  gradientWord: { color: '#22D3EE' },
  subtext: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18, marginTop: 10 },
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
    borderColor: 'rgba(34,211,238,0.25)',
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
    backgroundColor: 'rgba(14,116,144,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crystalBaseText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  topCtas: { flexDirection: 'row', gap: 12 },
  ctaFlex: { flex: 1 },
  primaryCta: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  secondaryCta: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ctaIcon: { color: '#fff', fontSize: 16, fontWeight: '900' },
  primaryCtaText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  secondaryCtaText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  categoryQuickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 4 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#22D3EE' },
  liveText: { color: '#22D3EE', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  filterRow: { gap: 8, paddingVertical: 6 },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: { backgroundColor: 'rgba(34,211,238,0.28)', borderColor: 'rgba(34,211,238,0.65)' },
  filterChipText: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '800' },
  filterChipTextActive: { color: '#fff' },
  activePredictionList: { gap: 10 },
  demoHubHint: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14,
    gap: 4,
  },
  demoHubHintTitle: { color: '#fff', fontSize: 13, fontWeight: '900' },
  demoHubHintCopy: { color: 'rgba(255,255,255,0.68)', fontSize: 12, lineHeight: 17 },
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
  roomIconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  roomIcon: { fontSize: 17 },
  roomText: { flex: 1 },
  roomQuestion: { color: '#fff', fontSize: 12.4, fontWeight: '800', lineHeight: 16 },
  roomGuesses: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 },
  timeColumn: { alignItems: 'flex-end', flexDirection: 'row', gap: 7 },
  timerText: { fontSize: 11.5, fontWeight: '800' },
  chevron: { color: 'rgba(255,255,255,0.6)', fontSize: 25, fontWeight: '300' },
  emptyStateCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    backgroundColor: 'rgba(10,20,46,0.84)',
    padding: 16,
    gap: 8,
  },
  emptyStateTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  emptyStateCopy: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 18 },
  emptyStateActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  emptyPrimary: { backgroundColor: '#22D3EE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  emptyPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  emptySecondary: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emptySecondaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
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
  optionExact: { borderColor: '#22D3EE' },
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
    borderColor: 'rgba(34,211,238,0.44)',
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
  auraBadge: { color: '#fff', backgroundColor: 'rgba(34,211,238,0.28)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, fontSize: 10.5, fontWeight: '800' },
  playedBadge: { color: '#dbeafe', backgroundColor: 'rgba(37,99,235,0.25)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, fontSize: 10.5, fontWeight: '800' },
  createCard: { borderRadius: 12, minHeight: 72, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  createTitle: { color: '#fff', flex: 1, fontSize: 17, lineHeight: 23, fontWeight: '900' },
  createButton: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  createButtonText: { color: '#3730a3', fontWeight: '900', fontSize: 13.5 },
  createBolt: { color: '#2563eb', fontWeight: '900', fontSize: 16 },
  weeklyCard: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(18,26,53,0.9)',
    padding: 16,
    gap: 6,
  },
  weeklyTitle: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  weeklyPersonality: { color: '#fff', fontSize: 20, fontWeight: '900' },
  weeklyCopy: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 18 },
  nextMoveCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.26)',
    backgroundColor: 'rgba(12,23,52,0.9)',
    padding: 14,
    gap: 6,
  },
  mutedText: { color: 'rgba(255,255,255,0.64)', fontSize: 12, lineHeight: 18 },
  logoutButton: { alignItems: 'center', paddingVertical: 8 },
  logoutText: { color: 'rgba(255,255,255,0.46)', fontSize: 12, fontWeight: '800' },
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
