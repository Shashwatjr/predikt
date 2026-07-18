import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '../theme/designSystem';

/**
 * Food ETA visualization — a horizontal progress bar with a scooter riding the fill
 * edge and an ETA readout. No map. Driven by the privacy-safe `progressPercentage`.
 */

type Props = {
  progressPercentage: number | null | undefined;
  etaMinutes?: number | null;
  status?: string;
};

export default function FoodEtaViz({ progressPercentage, etaMinutes, status }: Props) {
  const clamped = Math.max(0, Math.min(100, progressPercentage ?? 0));
  const anim = useRef(new Animated.Value(clamped)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(clamped);
      return;
    }
    Animated.timing(anim, { toValue: clamped, duration: 600, useNativeDriver: false }).start();
  }, [clamped, anim, reduceMotion]);

  const widthPct = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const scooterLeft = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery on the way</Text>
        {status ? <Text style={styles.status}>{status.replace(/_/g, ' ')}</Text> : null}
      </View>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: widthPct }]} />
        <Animated.Text style={[styles.scooter, { left: scooterLeft }]}>🛵</Animated.Text>
      </View>

      <Text style={styles.eta}>
        {etaMinutes != null
          ? `~ ${etaMinutes} min · ${Math.round(clamped)}%`
          : `${Math.round(clamped)}% of the way`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: palette.textPrimary, ...typography.bodyBold },
  status: { color: '#fb923c', ...typography.caption, fontWeight: '800', textTransform: 'capitalize' },
  barTrack: {
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0a1024',
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 13,
    backgroundColor: '#ea580c',
  },
  scooter: {
    position: 'absolute',
    top: 1,
    marginLeft: -12,
    fontSize: 18,
  },
  eta: { color: palette.textPrimary, ...typography.bodyBold },
});
