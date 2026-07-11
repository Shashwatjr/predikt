import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface Props {
  percentage: number;
  label?: string;
  showSegments?: boolean;
}

export default function ProgressBar({ percentage, label, showSegments = true }: Props) {
  const { colors } = useTheme();
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
        <Text style={[styles.pct, { color: colors.purple }]}>{clamped.toFixed(0)}%</Text>
      </View>

      <View style={[styles.track, { backgroundColor: colors.border }]}>
        {/* Gradient fill */}
        <LinearGradient
          colors={colors.gradPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${clamped}%` }]}
        />

        {/* Leading edge dot */}
        {clamped > 2 && (
          <View
            style={[
              styles.dot,
              { left: `${clamped}%`, backgroundColor: '#fff' },
            ]}
          />
        )}

        {/* Segment ticks at 25%, 50%, 75% */}
        {showSegments &&
          [25, 50, 75].map((seg) => (
            <View
              key={seg}
              style={[styles.tick, { left: `${seg}%`, backgroundColor: colors.bg }]}
            />
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  label: { fontSize: 13, fontWeight: '600' },
  pct: { fontSize: 13, fontWeight: '800' },
  track: {
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: { height: '100%', borderRadius: 9 },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    top: 4,
    marginLeft: -5,
  },
  tick: {
    position: 'absolute',
    width: 2,
    height: '100%',
    opacity: 0.4,
  },
});
