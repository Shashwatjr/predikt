import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from '../components/PrimaryButton';
import TextInputField from '../components/TextInputField';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/types';
import api from '../services/api';
import BadgeChip from '../components/BadgeChip';
import SectionHeader from '../components/SectionHeader';
import { cardStyle, layout, palette, spacing } from '../theme/designSystem';
import { getStartupSparkEnabled, setStartupSparkEnabled } from '../services/startupSpark';

interface Stats {
  totalAura: number;
  weeklyAura: number;
  cloutBalance: number;
  creditBalance?: number;
  lifetimeCloutEarned: number;
  winsCount: number;
  predictionsMadeCount: number;
  roomsCreatedCount: number;
  predictionAccuracyScore: number;
  currentStreak: number;
  longestStreak: number;
  reliabilityScore?: number;
  reliabilityEvents?: number;
  recentReliability?: Array<{
    eventType: string;
    pointsDelta: number;
    reason: string;
    createdAt: string;
  }>;
}

interface FollowingEntry {
  userId: string;
  name: string;
  prediktHandle?: string | null;
  weeklyAura?: number;
  cloutBalance?: number;
}

function StatChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <View style={[styles.chip, { borderLeftColor: accent }]}>
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={[styles.chipValue, { color: accent }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout, updateUser } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [prediktHandle, setPrediktHandle] = useState(user?.prediktHandle ?? '');
  const [following, setFollowing] = useState<FollowingEntry[]>([]);
  const [unfollowingIds, setUnfollowingIds] = useState<string[]>([]);
  const [userBadges, setUserBadges] = useState<Array<{ badgeKey: string; title: string; icon?: string | null }>>([]);
  const [commentaryEnabled, setCommentaryEnabled] = useState(true);
  const [aiCommentaryOptOut, setAiCommentaryOptOut] = useState(false);
  const [savingCommentaryPref, setSavingCommentaryPref] = useState(false);
  const [startupSparkEnabled, setStartupSparkEnabledState] = useState(true);

  useEffect(() => {
    void getStartupSparkEnabled().then(setStartupSparkEnabledState);
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const [statsRes, followingRes, badgesRes] = await Promise.all([
        api.get('/users/me/stats'),
        api.get('/users/me/following'),
        api.get('/users/me/badges').catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setUserBadges(badgesRes.data ?? []);
      setFollowing(
        (followingRes.data ?? []).map((entry: any) => ({
          userId: entry.following?.userId ?? entry.userId,
          name: entry.following?.name ?? entry.name,
          prediktHandle: entry.following?.prediktHandle ?? entry.prediktHandle,
          weeklyAura: entry.following?.weeklyAura ?? entry.weeklyAura,
          cloutBalance: entry.following?.cloutBalance ?? entry.cloutBalance,
        })),
      );
    } catch {
      Alert.alert('Profile unavailable', 'We could not load your profile stats.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await api.patch('/users/me/profile', {
        name: name.trim(),
        prediktHandle: prediktHandle.trim(),
      });
      updateUser(res.data);
      Alert.alert('Profile updated', 'Your display name and PREDIKT handle are saved.');
    } catch (err: any) {
      Alert.alert('Save failed', err?.response?.data?.message ?? 'Please review your handle and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function requestDataExport() {
    try {
      await api.post('/privacy/data-export-request');
      Alert.alert('Request submitted', 'We logged your data export request.');
    } catch (err: any) {
      Alert.alert('Request failed', err?.response?.data?.message ?? 'Please try again.');
    }
  }

  async function requestDataDeletion() {
    try {
      await api.post('/privacy/data-deletion-request');
      Alert.alert('Request submitted', 'We logged your data deletion request.');
    } catch (err: any) {
      Alert.alert('Request failed', err?.response?.data?.message ?? 'Please try again.');
    }
  }

  async function optOutAi() {
    try {
      const res = await api.patch('/privacy/ai-personalisation-opt-out', { optOut: true });
      updateUser(res.data);
      Alert.alert('AI personalization off', 'Low-risk AI copy will not use your account for personalization.');
    } catch (err: any) {
      Alert.alert('Update failed', err?.response?.data?.message ?? 'Please try again.');
    }
  }

  async function unfollowUser(targetUserId: string) {
    setUnfollowingIds((current) => [...current, targetUserId]);
    try {
      await api.delete(`/users/${targetUserId}/follow`);
      setFollowing((current) => current.filter((entry) => entry.userId !== targetUserId));
    } catch (err: any) {
      Alert.alert('Unfollow failed', err?.response?.data?.message ?? 'Please try again.');
    } finally {
      setUnfollowingIds((current) => current.filter((id) => id !== targetUserId));
    }
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'P';

  async function saveCommentaryPreference(patch: { enabled?: boolean; aiOptOut?: boolean }) {
    setSavingCommentaryPref(true);
    try {
      const res = await api.patch('/users/me/commentary-preference', patch);
      setCommentaryEnabled(res.data.enabled ?? res.data.commentaryEnabled ?? true);
      setAiCommentaryOptOut(res.data.aiOptOut ?? res.data.aiCommentaryOptOut ?? false);
    } catch {
      Alert.alert('Preference not saved', 'Try again in a moment.');
    } finally {
      setSavingCommentaryPref(false);
    }
  }

  const personalityTitle =
    (stats?.currentStreak ?? 0) >= 3
      ? 'Comeback Merchant'
      : (stats?.winsCount ?? 0) >= 5
        ? 'Route Whisperer'
        : 'The Human Edge';

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}>
      <LinearGradient colors={colors.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.avatarRing}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <Text style={styles.heroName}>{user?.name}</Text>
        <Text style={styles.heroHandle}>{user?.prediktHandle ? `@${user.prediktHandle}` : 'No handle yet'}</Text>
        {!!user?.email && <Text style={styles.heroEmail}>{user.email}</Text>}
      </LinearGradient>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.textPrimary }]}>Identity</Text>
        <TextInputField label="Display name" value={name} onChangeText={setName} placeholder="Your name" />
        <TextInputField
          label="PREDIKT handle"
          value={prediktHandle}
          onChangeText={setPrediktHandle}
          autoCapitalize="none"
          placeholder="@your.handle"
          hint="Optional. Public leaderboards prefer your handle when set."
        />
        <PrimaryButton label="Save profile" onPress={saveProfile} loading={saving} icon="💾" />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} size="large" style={{ marginTop: 36 }} />
      ) : stats ? (
        <View style={styles.chipGrid}>
          <StatChip icon="✨" label="Total Aura" value={stats.totalAura} accent={colors.purple} />
          <StatChip icon="📈" label="Weekly Aura" value={stats.weeklyAura} accent={colors.green} />
          <StatChip icon="💠" label="Clout" value={stats.cloutBalance} accent={colors.amber} />
          <StatChip icon="🔓" label="Credits" value={stats.creditBalance ?? user?.creditBalance ?? 0} accent={colors.purple} />
          <StatChip icon="🔥" label="Current streak" value={stats.currentStreak} accent={colors.red} />
          <StatChip icon="🏆" label="Wins" value={stats.winsCount} accent={colors.textPrimary} />
          <StatChip icon="🎯" label="Accuracy" value={`${Math.round((stats.predictionAccuracyScore ?? 0) * 100)}%`} accent={colors.green} />
          <StatChip icon="🧭" label="Reliability" value={stats.reliabilityScore ?? 0} accent={colors.purple} />
        </View>
      ) : null}

      {stats ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.section, { color: colors.textPrimary }]}>Reliability</Text>
          <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
            Reliability reflects how consistently users complete or fairly close journey rooms.
          </Text>
          {(stats.recentReliability ?? []).slice(0, 3).map((entry, index) => (
            <View key={`${entry.eventType}-${index}`} style={[styles.followRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.followName, { color: colors.textPrimary }]}>{entry.reason}</Text>
                <Text style={[styles.followMeta, { color: colors.textSecondary }]}>
                  {entry.eventType.replace(/_/g, ' ')} • {new Date(entry.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={{ color: entry.pointsDelta >= 0 ? colors.green : colors.red, fontWeight: '900' }}>
                {entry.pointsDelta >= 0 ? `+${entry.pointsDelta}` : entry.pointsDelta}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[cardStyle(), { gap: spacing.sm }]}>
        <SectionHeader title="This week in PREDIKT" subtitle={personalityTitle} />
        <Text style={{ color: palette.textSecondary, fontSize: 13 }}>
          {stats?.weeklyAura ? `+${stats.weeklyAura} Aura this week.` : 'Your weekly story builds as you complete rooms.'}
        </Text>
      </View>

      {userBadges.length > 0 ? (
        <View style={[cardStyle(), { gap: spacing.sm }]}>
          <SectionHeader title="Badges" subtitle="Shareable moments unlocked" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {userBadges.slice(0, 8).map((badge) => (
              <BadgeChip key={badge.badgeKey} label={badge.title} icon={badge.icon ?? '🏅'} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={[cardStyle(), { gap: spacing.md }]}>
        <SectionHeader title="Commentary" subtitle="Cosmetic only — never affects winners" />
        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>AI commentary</Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>Oracle + Chaos story layer on results.</Text>
          </View>
          <Switch
            value={commentaryEnabled && !aiCommentaryOptOut}
            disabled={savingCommentaryPref}
            onValueChange={(enabled) => saveCommentaryPreference({ enabled, aiOptOut: !enabled })}
            trackColor={{ false: colors.border, true: colors.purple }}
            thumbColor={commentaryEnabled ? colors.purpleLight : '#f8fafc'}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.textPrimary }]}>Following</Text>
        {following.length ? (
          following.map((entry) => (
            <View key={entry.userId} style={[styles.followRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.followName, { color: colors.textPrimary }]}>
                  {entry.prediktHandle ? `@${entry.prediktHandle}` : entry.name}
                </Text>
                <Text style={[styles.followMeta, { color: colors.textSecondary }]}>
                  {entry.weeklyAura ?? 0} weekly Aura • {entry.cloutBalance ?? 0} Clout
                </Text>
              </View>
              <PrimaryButton
                label="Unfollow"
                onPress={() => unfollowUser(entry.userId)}
                variant="secondary"
                fullWidth={false}
                loading={unfollowingIds.includes(entry.userId)}
              />
            </View>
          ))
        ) : (
          <Text style={[styles.emptyState, { color: colors.textSecondary }]}>
            You are not following anyone yet.
          </Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.textPrimary }]}>App settings</Text>
        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Today&apos;s Spark</Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              Show the premium startup moment once per day during app launch.
            </Text>
          </View>
          <Switch
            value={startupSparkEnabled}
            onValueChange={(enabled) => {
              setStartupSparkEnabledState(enabled);
              void setStartupSparkEnabled(enabled);
            }}
            trackColor={{ false: colors.border, true: colors.purple }}
            thumbColor={startupSparkEnabled ? colors.purpleLight : '#f8fafc'}
          />
        </View>
        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
              {isDark ? 'Dark mode' : 'Light mode'}
            </Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              Switch the app theme for your current session.
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.purple }}
            thumbColor={isDark ? colors.purpleLight : '#f8fafc'}
          />
        </View>
        <View style={styles.settingRow}>
          <View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Privacy model</Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              Viewer-facing live rooms stay approximate and delayed. Exact GPS is not shown.
            </Text>
          </View>
        </View>
        <PrimaryButton label="Notifications" onPress={() => navigation.navigate('Notifications')} variant="secondary" />
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Legal and safety</Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              Privacy, terms, community guidelines, safety policy, reports, and data requests.
            </Text>
          </View>
        </View>
        <PrimaryButton label="Privacy Policy" onPress={() => navigation.navigate('Legal', { slug: 'privacy', title: 'Privacy Policy' })} variant="ghost" />
        <PrimaryButton label="Terms" onPress={() => navigation.navigate('Legal', { slug: 'terms', title: 'Terms' })} variant="ghost" />
        <PrimaryButton label="Community Guidelines" onPress={() => navigation.navigate('Legal', { slug: 'community-guidelines', title: 'Community Guidelines' })} variant="ghost" />
        <PrimaryButton label="Safety Policy" onPress={() => navigation.navigate('Legal', { slug: 'safety', title: 'Safety Policy' })} variant="ghost" />
        <PrimaryButton label="Help and How PREDIKT Works" onPress={() => navigation.navigate('Help', { allowReplayTour: true })} variant="ghost" />
        <PrimaryButton label="Replay Guided Tour" onPress={() => navigation.navigate('Home', { replayOnboarding: true })} variant="secondary" />
        <PrimaryButton label="Request Data Export" onPress={requestDataExport} variant="secondary" />
        <PrimaryButton label="Request Data Deletion" onPress={requestDataDeletion} variant="secondary" />
        <PrimaryButton label="Opt Out of AI Personalization" onPress={optOutAi} variant="secondary" />
      </View>

      <PrimaryButton label="Log Out" onPress={logout} variant="danger" icon="🚪" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 880, alignSelf: 'center', padding: 20, gap: 14 },
  hero: { borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 22 },
  avatarRing: { width: 86, height: 86, borderRadius: 43, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontSize: 34, fontWeight: '900' },
  heroName: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 14 },
  heroHandle: { color: 'rgba(255,255,255,0.86)', fontSize: 15, marginTop: 4 },
  heroEmail: { color: 'rgba(255,255,255,0.68)', fontSize: 13, marginTop: 6 },
  card: { borderRadius: 20, borderWidth: 1, padding: 18 },
  section: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { width: '47%', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderLeftWidth: 4, minHeight: 110 },
  chipIcon: { fontSize: 22 },
  chipValue: { marginTop: 10, fontSize: 22, fontWeight: '900' },
  chipLabel: { marginTop: 6, color: '#64748b', fontSize: 12, fontWeight: '700' },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  followName: { fontSize: 15, fontWeight: '700' },
  followMeta: { fontSize: 13, marginTop: 4 },
  emptyState: { fontSize: 14, lineHeight: 20 },
  settingRow: { paddingVertical: 14, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  settingLabel: { fontSize: 15, fontWeight: '700' },
  settingHint: { fontSize: 13, lineHeight: 18, marginTop: 4, maxWidth: 240 },
});
