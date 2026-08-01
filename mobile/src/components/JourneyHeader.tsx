import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BrandLogo from './BrandLogo';
import { journeyPalette } from '../theme/journeyPalette';

type Props = {
  aura: number;
  userName: string;
  onProfile: () => void;
};

/** Mobile top bar: P logo + wordmark on the left, Aura chip + profile on the right. */
export default function JourneyHeader({ aura, userName, onProfile }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <BrandLogo height={40} />
      </View>

      <View style={styles.right}>
        <View style={styles.auraChip}>
          <Text style={styles.auraIcon}>✨</Text>
          <Text style={styles.auraValue}>{aura}</Text>
        </View>
        <Pressable onPress={onProfile} accessibilityRole="button" accessibilityLabel="Profile" style={styles.avatar}>
          <Text style={styles.avatarText}>{(userName || 'P').charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  auraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: journeyPalette.borderStrong,
    backgroundColor: 'rgba(139,92,246,0.14)',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  auraIcon: { fontSize: 12 },
  auraValue: { color: journeyPalette.textPrimary, fontSize: 12, fontWeight: '800' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(59,130,246,0.22)',
    borderWidth: 1,
    borderColor: journeyPalette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: journeyPalette.textPrimary, fontSize: 14, fontWeight: '800' },
});
