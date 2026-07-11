import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  unreadCount: number;
  onPress: () => void;
}

export default function NotificationBell({ unreadCount, onPress }: Props) {
  const label = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <TouchableOpacity style={styles.button} onPress={onPress} accessibilityRole="button" accessibilityLabel="Notifications">
      <Text style={styles.icon}>🔔</Text>
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  icon: { fontSize: 18 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
});
