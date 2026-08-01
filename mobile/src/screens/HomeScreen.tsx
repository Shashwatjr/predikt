import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import { fetchRoom } from '../services/dashboard';
import { useDashboardData } from '../hooks/useDashboardData';
import DashboardOnboardingOverlay from '../components/DashboardOnboardingOverlay';
import DemoScenarioPicker, { DemoWalkthroughBanner } from '../components/DemoScenarioPicker';
import { isDemoAccount, type DemoScenario } from '../config/demoScenarios';
import {
  hasSeenDemoScenarioPicker,
  markDemoScenarioPickerSeen,
} from '../services/demoWalkthroughStorage';
import {
  completeDashboardOnboarding,
  hasCompletedDashboardOnboarding,
} from '../services/onboardingStorage';
import { fetchRewardsMe, RewardsMe } from '../services/rewards';
import BottomNav, { NavTab } from '../components/BottomNav';
import JourneyGlow from '../components/JourneyGlow';
import JourneyHeader from '../components/JourneyHeader';
import JourneyHeroCard from '../components/JourneyHeroCard';
import JourneyListSection from '../components/JourneyListSection';
import JourneySidebar, { JourneySidebarItem } from '../components/JourneySidebar';
import { JOURNEY_DESKTOP_BREAKPOINT, journeyPalette } from '../theme/journeyPalette';
import { hasSeenTodaysTea, markTodaysTeaSeen } from '../services/todaysTeaStorage';
import { buildTodaysTea, TodaysTea } from '../utils/todaysTea';
import TodaysTeaOverlay from '../components/TodaysTeaOverlay';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { appAlert } from '../utils/appAlert';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
  route: RouteProp<RootStackParamList, 'Home'>;
};

/**
 * Journey ETA home.
 *
 * One screen, one component tree, two breakpoints:
 *   • < 1024px  — single column: header → hero → journeys list → bottom nav.
 *   • >= 1024px — dashboard: left sidebar rail + main column.
 * The layout switches on width; the sections themselves are the same
 * components with the same data in both.
 *
 * Category surface is Travel ETA only. The underlying category key stays
 * `arrival_time`; "Journey" is the display label. Sports / Delivery / Habit /
 * Custom stay gated off in `featureFlags`, as do RIZZ, Gems and streak.
 */
const HOME_JOURNEY_LIMIT = 3;
const HOME_SUBHEADING = 'Where will you beat the ETA today?';

export default function HomeScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= JOURNEY_DESKTOP_BREAKPOINT;

  const { dashboard, activePredictions, loading, loadDashboard, reorderActivePredictions } =
    useDashboardData();
  const [tourVisible, setTourVisible] = useState(false);
  const [demoPickerVisible, setDemoPickerVisible] = useState(false);
  const [demoHubExpanded, setDemoHubExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('Home');
  const [sidebarItem, setSidebarItem] = useState<JourneySidebarItem>('Home');
  const [showAllJourneys, setShowAllJourneys] = useState(false);
  const [todaysTea, setTodaysTea] = useState<TodaysTea | null>(null);
  const [teaVisible, setTeaVisible] = useState(false);
  const [rewards, setRewards] = useState<RewardsMe | null>(null);
  const teaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const summary = dashboard?.summary;
  const userId = user?.userId;
  const userName = user?.name;
  const firstName = userName ? userName.split(' ')[0] : 'there';
  const demoAccount = isDemoAccount(user);
  const showDemoHub = !demoAccount || demoHubExpanded;

  useEffect(() => {
    let active = true;
    fetchRewardsMe()
      .then((data) => {
        if (active) setRewards(data);
      })
      .catch(() => {
        // Rewards are non-critical on Home; fall back to the dashboard summary.
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Refresh whenever Home regains focus (e.g. after creating a room or starting a
  // journey in LiveRoom). The hook already loads on mount, so skip the first focus.
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
        await completeDashboardOnboarding();
        setTourVisible(false);
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

  // Single default list — active journeys first, completed after, preserving the
  // existing pin/displayOrder within each group (stable sort).
  const journeys = useMemo(() => {
    const isCompleted = (status?: string) =>
      ['result_ready', 'completed', 'reached', 'cancelled'].includes(String(status));
    return [...activePredictions].sort(
      (a, b) => (isCompleted(a.status) ? 1 : 0) - (isCompleted(b.status) ? 1 : 0),
    );
  }, [activePredictions]);

  const visibleJourneys = useMemo(() => {
    if (showAllJourneys) return journeys;
    return journeys.slice(0, HOME_JOURNEY_LIMIT);
  }, [journeys, showAllJourneys]);

  // Guard `aura` as well as `rewards` — a partial payload must fall back to the
  // dashboard summary, not throw and blank the screen.
  const totalAura = rewards?.aura?.balance ?? summary?.totalAura ?? user?.totalAura ?? 0;
  function startJourney() {
    // Travel ETA create flow. Display label is "Journey"; the category key is unchanged.
    navigation.navigate('CreateRoom', { presetCategory: 'arrival_time' });
  }

  function joinWithLink() {
    navigation.navigate('JoinRoom');
  }

  async function openRoom(room: any) {
    const roomId = room.rawRoom?.roomId ?? room.roomId;
    const targetScreen = room.rawRoom?.quickAction?.targetScreen;
    if (!roomId) {
      startJourney();
      return;
    }

    try {
      const fullRoom = await fetchRoom(roomId);
      const normalizedStatus =
        fullRoom.status === 'prediction_open' ? 'predictions_open' : fullRoom.status;
      const isCreator =
        fullRoom.creatorUserId === user?.userId || fullRoom.creator?.userId === user?.userId;
      const hasPredicted = !!fullRoom.viewerHasPredicted || !!room.rawRoom?.hasSubmittedPrediction;

      if (targetScreen === 'LiveRoom') {
        navigation.navigate('LiveRoom', { roomId, isCreator });
        return;
      }

      if (targetScreen === 'Result') {
        navigation.navigate('Result', { roomId });
        return;
      }

      // Already guessed → room, not the predict loop (even if status still predictions_open).
      if (hasPredicted && normalizedStatus !== 'completed' && normalizedStatus !== 'reached') {
        navigation.navigate('LiveRoom', { roomId, isCreator });
        return;
      }

      if (normalizedStatus === 'predictions_open' && !hasPredicted) {
        navigation.navigate('Prediction', { roomId, room: fullRoom });
        return;
      }

      if (normalizedStatus === 'completed' || normalizedStatus === 'reached') {
        navigation.navigate('Result', { roomId });
        return;
      }

      navigation.navigate('LiveRoom', { roomId, isCreator });
    } catch (error: unknown) {
      appAlert('Journey unavailable', getApiErrorMessage(error, 'Could not open this journey right now.'));
    }
  }

  function handleBottomNav(tab: NavTab) {
    setActiveTab(tab);
    if (tab === 'Home') return;
    navigation.navigate('Profile');
  }

  function handleSidebar(item: JourneySidebarItem) {
    setSidebarItem(item);
    if (item === 'StartJourney') {
      startJourney();
      return;
    }
    if (item === 'MyJourneys') {
      setShowAllJourneys(true);
    }
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
      appAlert(
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

  function deleteRoom(room: any) {
    // Delete here is always "clear my own view" — never a cancel for the whole
    // room, whoever created it. The journey keeps running for everyone else.
    const deleteMessage =
      'This removes the journey from your list. Everyone else keeps theirs.';
    appAlert('Remove from your list?', deleteMessage, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void api
            .delete(`/rooms/${room.roomId}`)
            .then(() => loadDashboard({ silent: true }))
            .catch((error: unknown) => {
              appAlert('Could not remove journey', getApiErrorMessage(error, 'Please try again.'));
            });
        },
      },
    ]);
  }

  const demoBanner = demoAccount ? (
    <DemoWalkthroughBanner
      roomCount={activePredictions.length}
      hubExpanded={demoHubExpanded}
      onSelect={(scenario) => {
        void openDemoScenario(scenario);
      }}
      onToggleHub={() => setDemoHubExpanded((current) => !current)}
      onOpenPicker={() => setDemoPickerVisible(true)}
    />
  ) : null;

  const journeyList = showDemoHub ? (
    <JourneyListSection
      title="Your journeys"
      journeys={visibleJourneys}
      cardVariant="journeyHome"
      onOpen={(journey) => openRoom({ roomId: journey.roomId, rawRoom: journey })}
      onDelete={deleteRoom}
      onTogglePin={togglePin}
      onMove={moveRoom}
      onViewAll={
        !showAllJourneys && journeys.length > HOME_JOURNEY_LIMIT
          ? () => {
              setShowAllJourneys(true);
              setSidebarItem('MyJourneys');
            }
          : undefined
      }
    />
  ) : null;

  const overlays = (
    <>
      <DashboardOnboardingOverlay visible={tourVisible} onClose={closeTour} />
      <DemoScenarioPicker
        visible={demoPickerVisible}
        onClose={() => {
          void closeDemoPicker();
        }}
        onBrowseAll={() => setDemoHubExpanded(true)}
        onSelect={(scenario) => {
          void openDemoScenario(scenario);
        }}
      />
      <TodaysTeaOverlay visible={teaVisible} tea={todaysTea} onClose={dismissTodaysTea} />
    </>
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <JourneyGlow />
        <View style={isDesktop ? styles.desktopShell : styles.flexOne}>
          {isDesktop ? <View style={styles.sidebarSkeleton} /> : null}
          <ScrollView
            contentContainerStyle={isDesktop ? styles.desktopContent : styles.mobileContent}
            showsVerticalScrollIndicator={false}
          >
            <SkeletonBlock width="55%" height={22} />
            <SkeletonBlock width="100%" height={isDesktop ? 300 : 260} radius={24} />
            <SkeletonBlock width="34%" height={16} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </ScrollView>
        </View>
        {!isDesktop ? <BottomNav active="Home" onChange={handleBottomNav} hiddenTabs={['Create']} /> : null}
      </View>
    );
  }

  // ── Desktop (>= 1024px): sidebar rail + main dashboard column ────────────────
  if (isDesktop) {
    return (
      <View style={styles.screen}>
        <JourneyGlow />
        <View style={styles.desktopShell}>
          <JourneySidebar
            active={sidebarItem}
            onSelect={handleSidebar}
            userName={userName ?? ''}
            onProfile={() => navigation.navigate('Profile')}
          />
          <ScrollView contentContainerStyle={styles.desktopContent} showsVerticalScrollIndicator={false}>
            <View style={styles.desktopHeaderRow}>
              <View style={styles.desktopHeader}>
                <Text style={styles.desktopGreeting}>Hey, {firstName} 👋</Text>
                <Text style={styles.desktopTagline}>{HOME_SUBHEADING}</Text>
              </View>
              <View style={styles.desktopAuraChip}>
                <Text style={styles.desktopAuraIcon}>✨</Text>
                <Text style={styles.desktopAuraValue}>{totalAura} Aura</Text>
              </View>
            </View>

            <JourneyHeroCard
              wide
              eyebrow="Journey ETA"
              title="Journey ETA"
              headline="Think you can beat the map?"
              subtitle="Choose a route, predict your arrival and challenge your friends."
              ctaLabel="Start a Journey"
              onPressCta={startJourney}
              secondaryLabel="Join a Journey"
              onPressSecondary={joinWithLink}
            />

            {demoBanner}
            {journeyList}
          </ScrollView>
        </View>
        {overlays}
      </View>
    );
  }

  // ── Mobile (< 1024px): single column ─────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <JourneyGlow />
      <ScrollView contentContainerStyle={styles.mobileContent} showsVerticalScrollIndicator={false}>
        <JourneyHeader
          aura={totalAura}
          userName={userName ?? ''}
          onProfile={() => navigation.navigate('Profile')}
        />
        <View style={styles.mobileIntro}>
          <Text style={styles.mobileGreeting}>Hey, {firstName} 👋</Text>
          <Text style={styles.mobileSubheading}>{HOME_SUBHEADING}</Text>
        </View>

        <JourneyHeroCard
          eyebrow="Journey ETA"
          title="Journey ETA"
          headline="Think you can beat the map?"
          subtitle="Choose a route, predict your arrival and challenge your friends."
          ctaLabel="Start a Journey"
          onPressCta={startJourney}
          secondaryLabel="Join a Journey"
          onPressSecondary={joinWithLink}
        />

        {demoBanner}
        {journeyList}
      </ScrollView>

      <BottomNav active={activeTab} onChange={handleBottomNav} hiddenTabs={['Create']} />
      {overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  // `overflow: hidden` keeps the offscreen glow from widening the page and
  // introducing a horizontal scrollbar on web at narrow widths.
  screen: { flex: 1, backgroundColor: journeyPalette.bg, overflow: 'hidden' },
  flexOne: { flex: 1 },

  // Mobile
  mobileContent: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 112,
    gap: 16,
  },
  mobileIntro: { gap: 4, marginTop: 2 },
  mobileGreeting: { color: journeyPalette.textPrimary, fontSize: 26, lineHeight: 32, fontWeight: '900' },
  mobileSubheading: { color: journeyPalette.textSecondary, fontSize: 15, lineHeight: 21, fontWeight: '600' },

  // Desktop
  desktopShell: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  sidebarSkeleton: {
    width: 248,
    borderRightWidth: 1,
    borderRightColor: journeyPalette.border,
    backgroundColor: journeyPalette.surface,
  },
  desktopContent: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingTop: 26,
    paddingHorizontal: 40,
    paddingBottom: 64,
    gap: 18,
  },
  desktopHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  desktopHeader: { gap: 6 },
  desktopGreeting: { color: journeyPalette.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  desktopTagline: { color: journeyPalette.textSecondary, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  desktopAuraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: journeyPalette.borderStrong,
    backgroundColor: 'rgba(139,92,246,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  desktopAuraIcon: { fontSize: 13 },
  desktopAuraValue: { color: journeyPalette.textPrimary, fontSize: 13, fontWeight: '800' },
});
