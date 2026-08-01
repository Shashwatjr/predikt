import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { featureFlags } from '../config/featureFlags';
import { journeyPalette } from '../theme/journeyPalette';

type Props = {
  aura: number;
  journeys: number;
  predictions: number;
};

type Stat = { key: string; value: number; label: string };

/**
 * Home stats row.
 *
 * Only Aura ships today. The Journeys / Predictions tiles are wired and
 * rendered through the same code path but stay behind
 * `featureFlags.homeSecondaryStats` until those counts are backed by real
 * data — flip `EXPO_PUBLIC_FEATURE_HOME_SECONDARY_STATS=true` to bring them
 * back with no code change.
 */
export default function JourneyStatsRow({ aura, journeys, predictions }: Props) {
  const stats: Stat[] = [
    { key: 'aura', value: aura, label: 'Aura' },
    ...(featureFlags.homeSecondaryStats
      ? [
          { key: 'journeys', value: journeys, label: 'Journeys' },
          { key: 'predictions', value: predictions, label: 'Predictions' },
        ]
      : []),
  ];

  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <View key={stat.key} style={styles.tile}>
          <Text style={styles.value}>{stat.value}</Text>
          <Text style={styles.label}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: journeyPalette.border,
    backgroundColor: journeyPalette.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 2,
  },
  value: { color: journeyPalette.textPrimary, fontSize: 22, fontWeight: '900' },
  label: { color: journeyPalette.textSecondary, fontSize: 12, fontWeight: '700' },
});
