import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import PrimaryButton from '../components/PrimaryButton';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  UserNotification,
} from '../services/notifications';

const severityLabel: Record<string, string> = {
  info: 'Info',
  success: 'Done',
  warning: 'Check',
  action_required: 'Action',
};

export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await fetchNotifications());
    } catch {
      Alert.alert('Notifications unavailable', 'Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markRead(notification: UserNotification) {
    if (notification.status === 'read') return notification;
    const updated = await markNotificationRead(notification.notificationId);
    setItems((current) =>
      current.map((item) => (item.notificationId === updated.notificationId ? updated : item)),
    );
    return updated;
  }

  async function openNotification(notification: UserNotification) {
    try {
      const updated = await markRead(notification);
      routeFromTarget(updated.actionTarget, updated.roomId);
    } catch {
      Alert.alert('Could not open', 'Please try again.');
    }
  }

  function routeFromTarget(actionTarget?: string | null, roomId?: string | null) {
    const target = actionTarget ?? (roomId ? `room:${roomId}:live` : null);
    if (!target) return;
    const [, targetRoomId, targetScreen] = target.split(':');
    if (!targetRoomId) return;
    if (targetScreen === 'prediction') {
      navigation.navigate('Prediction', { roomId: targetRoomId, room: { roomId: targetRoomId } });
      return;
    }
    if (targetScreen === 'result') {
      navigation.navigate('Result', { roomId: targetRoomId });
      return;
    }
    navigation.navigate('LiveRoom', { roomId: targetRoomId, isCreator: false });
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((current) =>
        current.map((item) => ({ ...item, status: 'read', readAt: new Date().toISOString() })),
      );
    } catch {
      Alert.alert('Update failed', 'Please try again.');
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = items.filter((item) => item.status === 'unread').length;

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.purple} size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {unreadCount ? `${unreadCount} unread` : "You're all caught up."}
          </Text>
        </View>
        {unreadCount ? (
          <PrimaryButton label="Mark all" onPress={markAll} loading={markingAll} variant="secondary" fullWidth={false} />
        ) : null}
      </View>

      {items.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>You're all caught up.</Text>
          <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>Room updates will appear here.</Text>
        </View>
      ) : (
        items.map((item) => {
          const unread = item.status === 'unread';
          return (
            <TouchableOpacity
              key={item.notificationId}
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: unread ? colors.purple : colors.border,
                },
              ]}
              onPress={() => openNotification(item)}
            >
              <View style={[styles.unreadDot, { backgroundColor: unread ? colors.purple : colors.border }]} />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.severity, { color: colors.textSecondary }]}>
                    {severityLabel[item.severity] ?? 'Info'}
                  </Text>
                </View>
                <Text style={[styles.rowCopy, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.body}
                </Text>
                <View style={styles.rowFooter}>
                  <Text style={[styles.time, { color: colors.textMuted }]}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                  {item.actionLabel ? (
                    <Text style={[styles.action, { color: colors.purple }]}>{item.actionLabel}</Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { fontSize: 14, marginTop: 4 },
  emptyCard: { borderWidth: 1, borderRadius: 20, padding: 20, alignItems: 'center', marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '900' },
  emptyCopy: { fontSize: 13, marginTop: 6 },
  row: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 10 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '900' },
  severity: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  rowCopy: { fontSize: 13, lineHeight: 18, marginTop: 5 },
  rowFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  time: { fontSize: 12, fontWeight: '700' },
  action: { fontSize: 12, fontWeight: '900' },
});
