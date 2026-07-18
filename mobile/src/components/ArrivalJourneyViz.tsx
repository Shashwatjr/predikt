import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { palette, radius, spacing, typography } from '../theme/designSystem';

/**
 * Arrival visualization — SVG only, never a map. A dotted route curves from a start
 * pin to a destination pin; a glowing dot rides the curve, driven purely by the
 * privacy-safe `progressPercentage`. No tiles, no GPS, no coordinates.
 */

const P0 = { x: 20, y: 88 };
const P1 = { x: 160, y: 14 };
const P2 = { x: 300, y: 58 };
const PATH_D = `M${P0.x},${P0.y} Q${P1.x},${P1.y} ${P2.x},${P2.y}`;

function pointAt(t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x,
    y: mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y,
  };
}

function tangentAngleAt(t: number) {
  const dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
  const dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// Approximate arc length once so the traveled overlay + dot track the curve, not the chord.
const TOTAL_LEN = (() => {
  let len = 0;
  let prev = pointAt(0);
  for (let i = 1; i <= 60; i += 1) {
    const p = pointAt(i / 60);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
})();

type Props = {
  progressPercentage: number | null | undefined;
  etaMinutes?: number | null;
  status?: string;
  startLabel?: string;
  destinationLabel?: string;
  safetyMessage?: string;
  primaryColor?: string;
  secondaryColor?: string;
};

export default function ArrivalJourneyViz({
  progressPercentage,
  etaMinutes,
  status,
  startLabel = 'Start',
  destinationLabel = 'Destination',
  safetyMessage,
  primaryColor = '#22d3ee',
  secondaryColor = '#0ea5e9',
}: Props) {
  const clamped = Math.max(0, Math.min(100, progressPercentage ?? 0));
  const anim = useRef(new Animated.Value(clamped)).current;
  const [t, setT] = useState(clamped / 100);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setT(Math.max(0, Math.min(1, value / 100))));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);

  // Glide the dot between 5s polls rather than snapping.
  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(clamped);
      return;
    }
    Animated.timing(anim, { toValue: clamped, duration: 600, useNativeDriver: false }).start();
  }, [clamped, anim, reduceMotion]);

  const dot = pointAt(t);
  const angle = tangentAngleAt(t);
  const dashOffset = TOTAL_LEN * (1 - t);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>On the way</Text>
        {status ? <Text style={styles.status}>{status.replace(/_/g, ' ')}</Text> : null}
      </View>

      <Svg viewBox="0 0 320 100" width="100%" height={96}>
        <Defs>
          <SvgGradient id="arrivalTrack" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={secondaryColor} />
            <Stop offset="1" stopColor={primaryColor} />
          </SvgGradient>
        </Defs>
        {/* Full route, dotted + muted */}
        <Path
          d={PATH_D}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={2.5}
          strokeDasharray="2 9"
          strokeLinecap="round"
        />
        {/* Traveled portion, solid + bright, revealed by progress */}
        <Path
          d={PATH_D}
          fill="none"
          stroke="url(#arrivalTrack)"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={`${TOTAL_LEN}`}
          strokeDashoffset={dashOffset}
        />
        <Circle cx={P0.x} cy={P0.y} r={8} fill={palette.surfaceHigh} stroke="#60a5fa" strokeWidth={2} />
        <Circle cx={P2.x} cy={P2.y} r={8} fill={palette.surfaceHigh} stroke="#22c55e" strokeWidth={2} />
        <Circle cx={dot.x} cy={dot.y} r={12} fill={primaryColor} opacity={0.18} />
        <G transform={`translate(${dot.x}, ${dot.y}) rotate(${angle})`}>
          <SvgText x={0} y={0} fontSize="15" textAnchor="middle">
            🚗
          </SvgText>
        </G>
      </Svg>

      <View style={styles.labels}>
        <Text style={styles.label} numberOfLines={1}>📍 {startLabel}</Text>
        <Text style={[styles.label, styles.labelRight]} numberOfLines={1}>🏁 {destinationLabel}</Text>
      </View>

      <Text style={styles.eta}>
        {etaMinutes != null
          ? `~ ${etaMinutes} min to go · ${Math.round(clamped)}%`
          : `${Math.round(clamped)}% of the way`}
      </Text>
      {safetyMessage ? <Text style={styles.safety}>{safetyMessage}</Text> : null}
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
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: palette.textPrimary, ...typography.bodyBold },
  status: {
    color: '#22d3ee',
    ...typography.caption,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: palette.textSecondary, ...typography.caption, fontWeight: '700', flex: 1 },
  labelRight: { textAlign: 'right' },
  eta: { color: palette.textPrimary, ...typography.bodyBold, marginTop: spacing.xs },
  safety: { color: palette.textMuted, ...typography.micro },
});
