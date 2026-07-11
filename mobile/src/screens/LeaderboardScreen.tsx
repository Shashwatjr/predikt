import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LeaderboardList from '../components/LeaderboardList';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/leaderboard/weekly')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const myRank = data.findIndex((d) => d.userId === user?.userId) + 1;

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header banner */}
      <LinearGradient colors={colors.gradGold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.banner}>
        <Text style={styles.bannerIcon}>🏆</Text>
        <View>
          <Text style={styles.bannerTitle}>Weekly Aura Leaderboard</Text>
          <Text style={styles.bannerSub}>Top predictors this week</Text>
        </View>
        {myRank > 0 && (
          <View style={styles.myRankChip}>
            <Text style={styles.myRankText}>You #{myRank}</Text>
          </View>
        )}
      </LinearGradient>

      {loading ? (
        <ActivityIndicator color={colors.purple} size="large" style={{ marginTop: 40 }} />
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No predictions yet this week. Be the first!
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          <LeaderboardList data={data} currentUserId={user?.userId} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 32,
    gap: 14,
  },
  bannerIcon: { fontSize: 36 },
  bannerTitle: { color: '#fff', fontWeight: '900', fontSize: 20 },
  bannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  myRankChip: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  myRankText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  list: { padding: 16 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
