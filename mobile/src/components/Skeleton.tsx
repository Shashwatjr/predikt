import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { palette, radius, spacing } from '../theme/designSystem';

/**
 * A single shimmering placeholder block. Uses a looping opacity pulse (no extra
 * deps) so it works identically on web and native. Compose these into
 * screen-specific skeletons that mirror the real content's card shapes.
 */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius: r = radius.sm,
  style,
}: {
  width?: number | `${number}%` | 'auto';
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r, backgroundColor: 'rgba(148,163,184,0.16)', opacity: pulse },
        style,
      ]}
    />
  );
}

/** A skeleton shaped like an ActivePredictionCard / RoomCard. */
export function SkeletonCard({ lines = 2, height }: { lines?: number; height?: number }) {
  return (
    <View style={[styles.card, height ? { minHeight: height } : null]}>
      <View style={styles.cardHeaderRow}>
        <SkeletonBlock width={40} height={40} radius={radius.md} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <SkeletonBlock width="70%" height={14} />
          <SkeletonBlock width="45%" height={11} />
        </View>
      </View>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} width={i === lines - 1 ? '60%' : '100%'} height={11} />
      ))}
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
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
