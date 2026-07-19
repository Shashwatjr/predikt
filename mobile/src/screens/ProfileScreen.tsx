import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from '../components/PrimaryButton';
import TextInputField from '../components/TextInputField';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { featureFlags } from '../config/featureFlags';
import { RootStackParamList } from '../navigation/types';
import { getApiErrorMessage } from '../services/api';
import BadgeChip from '../components/BadgeChip';
import GuestUpgradePrompt from '../components/GuestUpgradePrompt';
import SectionHeader from '../components/SectionHeader';
import { cardStyle, layout, palette, spacing } from '../theme/designSystem';
import { getStartupSparkEnabled, setStartupSparkEnabled } from '../services/startupSpark';
import {
  FollowingEntry,
  ProfileBadge,
  ProfileStats,
  fetchProfileOverview,
  optOutAiPersonalisation,
  requestDataDeletion as requestDataDeletionApi,
  requestDataExport as requestDataExportApi,
  saveCommentaryPreference as saveCommentaryPreferenceApi,
  saveProfileIdentity,
  unfollowUser as unfollowUserApi,
} from '../services/profile';
import { clearActivePredictions } from '../services/dashboard';

type Stats = ProfileStats;

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
  const [userBadges, setUserBadges] = useState<ProfileBadge[]>([]);
  const [commentaryEnabled, setCommentaryEnabled] = useState(true);
  const [aiCommentaryOptOut, setAiCommentaryOptOut] = useState(false);
  const [savingCommentaryPref, setSavingCommentaryPref] = useState(false);
  const [startupSparkEnabled, setStartupSparkEnabledState] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clearingPilotPredictions, setClearingPilotPredictions] = useState(false);

  useEffect(() => {
    void getStartupSparkEnabled().then(setStartupSparkEnabledState);
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const overview = await fetchProfileOverview();
      setStats(overview.stats);
      setUserBadges(overview.badges);
      setFollowing(overview.following);
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
      const updatedUser = await saveProfileIdentity({ name: name.trim(), prediktHandle: prediktHandle.trim() });
      updateUser(updatedUser);
      Alert.alert('Profile updated', 'Your display name and PREDIKT handle are saved.');
    } catch (err: unknown) {
      Alert.alert('Save failed', getApiErrorMessage(err, 'Please review your handle and try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function requestDataExport() {
    try {
      await requestDataExportApi();
      Alert.alert('Request submitted', 'We logged your data export request.');
    } catch (err: unknown) {
      Alert.alert('Request failed', getApiErrorMessage(err, 'Please try again.'));
    }
  }

  async function requestDataDeletion() {
    try {
      await requestDataDeletionApi();
      Alert.alert('Request submitted', 'We logged your data deletion request.');
    } catch (err: unknown) {
      Alert.alert('Request failed', getApiErrorMessage(err, 'Please try again.'));
    }
  }

  async function optOutAi() {
    try {
      const updatedUser = await optOutAiPersonalisation();
      updateUser(updatedUser);
      Alert.alert('AI personalization off', 'Low-risk AI copy will not use your account for personalization.');
    } catch (err: unknown) {
      Alert.alert('Update failed', getApiErrorMessage(err, 'Please try again.'));
    }
  }

  async function unfollowUser(targetUserId: string) {
    setUnfollowingIds((current) => [...current, targetUserId]);
    try {
      await unfollowUserApi(targetUserId);
      setFollowing((current) => current.filter((entry) => entry.userId !== targetUserId));
    } catch (err: unknown) {
      Alert.alert('Unfollow failed', getApiErrorMessage(err, 'Please try again.'));
    } finally {
      setUnfollowingIds((current) => current.filter((id) => id !== targetUserId));
    }
  }

  async function handleClearPilotPredictions() {
    setClearingPilotPredictions(true);
    try {
      const result = await clearActivePredictions();
      Alert.alert(
        'Previous predictions cleared',
        result.clearedCount > 0
          ? `${result.clearedCount} previous prediction card${result.clearedCount === 1 ? '' : 's'} removed from your dashboard.`
          : 'There were no active prediction cards left to clear.',
      );
    } catch (err: unknown) {
      Alert.alert('Could not clear predictions', getApiErrorMessage(err, 'Please try again in a moment.'));
    } finally {
      setClearingPilotPredictions(false);
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
      const preference = await saveCommentaryPreferenceApi(patch);
      setCommentaryEnabled(preference.enabled);
      setAiCommentaryOptOut(preference.aiOptOut);
    } catch {
      Alert.alert('Preference not saved', 'Try again in a moment.');
    } finally {
      setSavingCommentaryPref(false);
    }
  }

  const vibeLine =
    user?.isGuest
      ? 'Guest mode is live. Save your Aura whenever you are ready.'
      : (stats?.currentStreak ?? 0) >= 3
        ? 'Your streak has real comeback energy.'
        : (stats?.winsCount ?? 0) >= 5
          ? 'You have been reading the room a little too well.'
          : 'Closest guess wins. Quiet confidence helps.';

  const quickStats = stats
    ? [
        { icon: '✨', label: 'Aura', value: stats.totalAura, accent: colors.purple },
        { icon: '🔥', label: 'Streak', value: stats.currentStreak, accent: colors.red },
        { icon: '🏆', label: 'Wins', value: stats.winsCount, accent: colors.amber },
        {
          icon: '🎯',
          label: 'Accuracy',
          value: `${Math.round((stats.predictionAccuracyScore ?? 0) * 100)}%`,
          accent: colors.green,
        },
      ]
    : [];

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}>
      <LinearGradient colors={colors.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.avatarRing}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <Text style={styles.heroName}>{user?.name}</Text>
        <Text style={styles.heroHandle}>{user?.prediktHandle ? `@${user.prediktHandle}` : 'No handle yet'}</Text>
        {!!user?.email && <Text style={styles.heroEmail}>{user.email}</Text>}
        <Text style={styles.heroSubline}>{vibeLine}</Text>
      </LinearGradient>

      {/* Guests: convert to a full account, keeping all Aura/history. */}
      <GuestUpgradePrompt variant="profile" onUpgraded={loadStats} />

      {loading ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
          <ActivityIndicator color={colors.purple} size="large" />
          <Text style={[styles.loadingCopy, { color: colors.textSecondary }]}>Loading your profile...</Text>
        </View>
      ) : null}

      {stats ? (
        <View style={styles.quickStatRow}>
          {quickStats.map((item) => (
            <View key={item.label} style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.quickStatIcon}>{item.icon}</Text>
              <Text style={[styles.quickStatValue, { color: item.accent }]}>{item.value}</Text>
              <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader
          title="Profile"
          subtitle={user?.isGuest ? 'Add a name now. Save the full account when you are ready.' : 'Keep your name and handle ready for invites and results.'}
        />
        <TextInputField label="Display name" value={name} onChangeText={setName} placeholder="Your name" />
        <TextInputField
          label="PREDIKT handle"
          value={prediktHandle}
          onChangeText={setPrediktHandle}
          autoCapitalize="none"
          placeholder="@your.handle"
          hint="Optional. Friends will see this in results when set."
        />
        <PrimaryButton label="Save profile" onPress={saveProfile} loading={saving} icon="💾" />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader title="Account Details" subtitle="These are the details currently saved on your account." />
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Name</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{user?.name ?? '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Handle</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
            {user?.prediktHandle ? `@${user.prediktHandle}` : 'Not set'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Email</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{user?.email ?? 'Guest account'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Account type</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{user?.isGuest ? 'Guest' : 'Registered'}</Text>
        </View>
      </View>

      {stats ? (
        <View style={styles.chipGrid}>
          <StatChip icon="📈" label="Weekly Aura" value={stats.weeklyAura} accent={colors.green} />
          <StatChip icon="💠" label="Clout" value={stats.cloutBalance} accent={colors.amber} />
          <StatChip icon="🔓" label="Credits" value={stats.creditBalance ?? user?.creditBalance ?? 0} accent={colors.purple} />
          <StatChip icon="🧭" label="Reliability" value={stats.reliabilityScore ?? 0} accent={colors.purple} />
        </View>
      ) : null}

      {userBadges.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SectionHeader title="Badges" subtitle="Small receipts from moments you called right." />
          <View style={styles.badgeWrap}>
            {userBadges.slice(0, 8).map((badge) => (
              <BadgeChip key={badge.badgeKey} label={badge.title} icon={badge.icon ?? '🏅'} />
            ))}
          </View>
        </View>
      ) : null}

      {stats && (stats.recentReliability ?? []).length > 0 ? (
        <View style={[cardStyle(), { gap: spacing.sm }]}>
          <SectionHeader title="Recent Reliability" subtitle="Fair finishes and completed rooms build this score." />
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

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.advancedHeader} onPress={() => setShowAdvanced((value) => !value)}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.section, { color: colors.textPrimary, marginBottom: 4 }]}>Settings</Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary, maxWidth: '100%' }]}>
              Theme, commentary, privacy, help, and account controls.
            </Text>
          </View>
          <Text style={[styles.advancedChevron, { color: colors.purpleLight }]}>
            {showAdvanced ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>

        {showAdvanced ? (
          <View style={styles.advancedBody}>
            <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Today&apos;s Spark</Text>
                <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                  Show the startup moment once per day.
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
                  Switch the app theme for this device.
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.purple }}
                thumbColor={isDark ? colors.purpleLight : '#f8fafc'}
              />
            </View>

            <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Commentary</Text>
                <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                  Keep the Oracle + Chaos result lines on or off.
                </Text>
              </View>
              <Switch
                value={commentaryEnabled && !aiCommentaryOptOut}
                disabled={savingCommentaryPref}
                onValueChange={(enabled) => saveCommentaryPreference({ enabled, aiOptOut: !enabled })}
                trackColor={{ false: colors.border, true: colors.purple }}
                thumbColor={commentaryEnabled ? colors.purpleLight : '#f8fafc'}
              />
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Privacy model</Text>
                <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                  Live rooms stay approximate and delayed. Exact GPS is not shown.
                </Text>
              </View>
            </View>

            {featureFlags.leaderboard ? (
              <View style={[styles.subsection, { borderColor: colors.border }]}>
                <SectionHeader title="Following" subtitle="People whose weekly reads you keep an eye on." />
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
            ) : null}

            <View style={[styles.linkGroup, { borderColor: colors.border }]}>
              {user?.email?.toLowerCase() === 'pilot@predikt.ai' ? (
                <PrimaryButton
                  label="Clear Previous Predictions"
                  onPress={() =>
                    Alert.alert(
                      'Clear previous predictions?',
                      'This removes your previous prediction cards from the dashboard for this pilot account. It does not delete rooms or account data.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear', style: 'destructive', onPress: () => void handleClearPilotPredictions() },
                      ],
                    )
                  }
                  variant="secondary"
                  loading={clearingPilotPredictions}
                />
              ) : null}
              {featureFlags.notifications ? (
                <PrimaryButton label="Notifications" onPress={() => navigation.navigate('Notifications')} variant="secondary" />
              ) : null}
              <PrimaryButton label="Help and How PREDIKT Works" onPress={() => navigation.navigate('Help', { allowReplayTour: true })} variant="ghost" />
              <PrimaryButton label="Replay Guided Tour" onPress={() => navigation.navigate('Home', { replayOnboarding: true })} variant="secondary" />
              <PrimaryButton label="Privacy Policy" onPress={() => navigation.navigate('Legal', { slug: 'privacy', title: 'Privacy Policy' })} variant="ghost" />
              <PrimaryButton label="Terms" onPress={() => navigation.navigate('Legal', { slug: 'terms', title: 'Terms' })} variant="ghost" />
              <PrimaryButton label="Community Guidelines" onPress={() => navigation.navigate('Legal', { slug: 'community-guidelines', title: 'Community Guidelines' })} variant="ghost" />
              <PrimaryButton label="Safety Policy" onPress={() => navigation.navigate('Legal', { slug: 'safety', title: 'Safety Policy' })} variant="ghost" />
              <PrimaryButton label="Request Data Export" onPress={requestDataExport} variant="secondary" />
              <PrimaryButton label="Request Data Deletion" onPress={requestDataDeletion} variant="secondary" />
              <PrimaryButton label="Opt Out of AI Personalization" onPress={optOutAi} variant="secondary" />
            </View>
          </View>
        ) : null}
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
  heroSubline: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  card: { borderRadius: 20, borderWidth: 1, padding: 18 },
  section: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  loadingCopy: { fontSize: 13, marginTop: 10 },
  quickStatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickStatCard: {
    flexGrow: 1,
    minWidth: '23%',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
  },
  quickStatIcon: { fontSize: 18 },
  quickStatValue: { fontSize: 20, fontWeight: '900' },
  quickStatLabel: { fontSize: 11, fontWeight: '800' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { width: '47%', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderLeftWidth: 4, minHeight: 110 },
  chipIcon: { fontSize: 22 },
  chipValue: { marginTop: 10, fontSize: 22, fontWeight: '900' },
  chipLabel: { marginTop: 6, color: '#64748b', fontSize: 12, fontWeight: '700' },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  advancedHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  advancedChevron: { fontSize: 13, fontWeight: '900' },
  advancedBody: { marginTop: 12, gap: 12 },
  subsection: { borderTopWidth: 1, paddingTop: 12 },
  linkGroup: { borderTopWidth: 1, paddingTop: 12, gap: 4 },
  settingRow: { paddingVertical: 14, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  settingLabel: { fontSize: 15, fontWeight: '700' },
  settingHint: { fontSize: 13, lineHeight: 18, marginTop: 4, maxWidth: 240 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.16)',
  },
  detailLabel: { fontSize: 13, fontWeight: '700' },
  detailValue: { fontSize: 14, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
});
