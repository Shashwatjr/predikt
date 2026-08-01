import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { getTravelStageFromProgress } from '../utils/travelProgress';

/**
 * Arrival visualization — SVG only, never a live map. A privacy-safe route
 * curves from start → destination with a car marker driven by delayed
 * `progressPercentage`. No tiles, no GPS, no coordinates.
 */

const VIEW_W = 640;
const VIEW_H = 280;

const P0 = { x: 88, y: 168 };
const P1 = { x: 300, y: 48 };
const P2 = { x: 552, y: 150 };
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

const TOTAL_LEN = (() => {
  let len = 0;
  let prev = pointAt(0);
  for (let i = 1; i <= 80; i += 1) {
    const p = pointAt(i / 80);
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
  /** Nest inside a parent card — skips outer chrome and status copy. */
  embedded?: boolean;
};

export default function ArrivalJourneyViz({
  progressPercentage,
  etaMinutes,
  status,
  startLabel = 'Start',
  destinationLabel = 'Destination',
  safetyMessage,
  primaryColor = '#A855F7',
  secondaryColor = '#3B82F6',
  embedded = false,
}: Props) {
  const clamped = Math.max(0, Math.min(100, progressPercentage ?? 0));
  const anim = useRef(new Animated.Value(clamped)).current;
  const [t, setT] = useState(clamped / 100);
  const [reduceMotion, setReduceMotion] = useState(false);
  const journeyStarted = ['live', 'started', 'inactive', 'overdue', 'arrived_verified'].includes(
    String(status ?? '').toLowerCase(),
  );

  useEffect(() => {
    const id = anim.addListener(({ value }) => setT(Math.max(0, Math.min(1, value / 100))));
    return () => anim.removeListener(id);
  }, [anim]);

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

  const dot = pointAt(t);
  const angle = tangentAngleAt(t);
  const dashOffset = TOTAL_LEN * (1 - t);
  const stageLabel = getTravelStageFromProgress(clamped, 'guest', { journeyStarted });
  const movingCopy =
    etaMinutes != null
      ? `The journey is moving · ~${etaMinutes} min to go`
      : journeyStarted
        ? 'The journey is moving'
        : 'Waiting for the journey to begin';

  return (
    <View style={[styles.wrap, !embedded && styles.wrapCard]}>
      {!embedded ? (
        <View style={styles.topRow}>
          <Text style={styles.topTitle}>On the way</Text>
          <View style={styles.onTheWayPill}>
            <View style={[styles.onTheWayDot, { backgroundColor: primaryColor }]} />
            <Text style={styles.onTheWayText}>{stageLabel}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.mapFrame}>
        <Svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height={embedded ? 260 : 220}>
          <Defs>
            <SvgGradient id="arrivalTrack" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={primaryColor} />
              <Stop offset="1" stopColor={secondaryColor} />
            </SvgGradient>
            <SvgGradient id="mapFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0B1224" stopOpacity="0.2" />
              <Stop offset="1" stopColor="#070B16" stopOpacity="0.85" />
            </SvgGradient>
          </Defs>

          <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} rx={18} fill="#0A1020" />
          <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} rx={18} fill="url(#mapFade)" />

          {/* Soft street grid — decorative only */}
          {[40, 90, 140, 190, 240].map((y) => (
            <Path
              key={`h-${y}`}
              d={`M12 ${y} H${VIEW_W - 12}`}
              stroke="rgba(148,163,184,0.08)"
              strokeWidth={1}
            />
          ))}
          {[60, 140, 220, 300, 380, 460, 540].map((x) => (
            <Path
              key={`v-${x}`}
              d={`M${x} 12 V${VIEW_H - 12}`}
              stroke="rgba(148,163,184,0.07)"
              strokeWidth={1}
            />
          ))}
          {/* Remaining route (dashed) */}
          <Path
            d={PATH_D}
            fill="none"
            stroke="rgba(96,165,250,0.55)"
            strokeWidth={4}
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
          {/* Traveled route (solid glow) */}
          <Path
            d={PATH_D}
            fill="none"
            stroke={primaryColor}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${TOTAL_LEN}`}
            strokeDashoffset={dashOffset}
            opacity={0.28}
          />
          <Path
            d={PATH_D}
            fill="none"
            stroke="url(#arrivalTrack)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${TOTAL_LEN}`}
            strokeDashoffset={dashOffset}
          />

          {/* Start pin */}
          <Circle cx={P0.x} cy={P0.y} r={22} fill={primaryColor} opacity={0.18} />
          <Circle cx={P0.x} cy={P0.y} r={11} fill={primaryColor} opacity={0.35} />
          <Circle cx={P0.x} cy={P0.y} r={6} fill={primaryColor} />
          <Circle cx={P0.x} cy={P0.y} r={2.4} fill="#FFFFFF" />

          {/* Destination pin */}
          <Circle cx={P2.x} cy={P2.y} r={22} fill={secondaryColor} opacity={0.18} />
          <Circle cx={P2.x} cy={P2.y} r={11} fill={secondaryColor} opacity={0.35} />
          <Circle cx={P2.x} cy={P2.y} r={6} fill={secondaryColor} />
          <Circle cx={P2.x} cy={P2.y} r={2.4} fill="#FFFFFF" />

          {/* Labels near pins */}
          <SvgText
            x={P0.x + 16}
            y={P0.y + 28}
            fill="rgba(255,255,255,0.88)"
            fontSize="12"
            fontWeight="700"
          >
            {truncateLabel(startLabel, 34)}
          </SvgText>
          <SvgText
            x={Math.min(P2.x - 8, VIEW_W - 210)}
            y={P2.y + 28}
            fill="rgba(255,255,255,0.88)"
            fontSize="12"
            fontWeight="700"
          >
            {truncateLabel(destinationLabel, 38)}
          </SvgText>

          {/* Car marker */}
          <Circle cx={dot.x} cy={dot.y} r={18} fill="#EF4444" opacity={0.18} />
          <G transform={`translate(${dot.x}, ${dot.y}) rotate(${angle})`}>
            <SvgText x={0} y={5} fontSize="20" textAnchor="middle">
              🚗
            </SvgText>
          </G>
        </Svg>

        <View style={styles.etaPillRow} pointerEvents="none">
          <View style={styles.etaPill}>
            <Text style={styles.etaPillIcon}>⏱</Text>
            <Text style={styles.etaPillText}>{movingCopy}</Text>
          </View>
        </View>
      </View>

      {!embedded && safetyMessage ? <Text style={styles.safety}>{safetyMessage}</Text> : null}
    </View>
  );
}

function truncateLabel(label: string, max: number) {
  const trimmed = label.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  wrapCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,124,246,0.22)',
    backgroundColor: '#0F1527',
    padding: 16,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  topTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  onTheWayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(88,28,135,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  onTheWayDot: { width: 7, height: 7, borderRadius: 4 },
  onTheWayText: { color: '#E9D5FF', fontSize: 12, fontWeight: '800' },
  mapFrame: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0A1020',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    position: 'relative',
  },
  etaPillRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(8,12,24,0.82)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  etaPillIcon: { fontSize: 13 },
  etaPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  safety: { color: '#6B7099', fontSize: 11, fontWeight: '600' },
});
