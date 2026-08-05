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
const VIEW_H = 300;

const P0 = { x: 72, y: 176 };
const P1 = { x: 300, y: 52 };
const P2 = { x: 568, y: 158 };
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
  // Keep the car slightly ahead of the start pin when tracking has begun but
  // the first delayed checkpoint has not arrived yet — feels alive, not stuck.
  const displayProgress = clamped <= 0 && ['live', 'started', 'inactive', 'overdue'].includes(String(status ?? '').toLowerCase())
    ? 4
    : clamped;
  const anim = useRef(new Animated.Value(displayProgress)).current;
  const [t, setT] = useState(displayProgress / 100);
  const [reduceMotion, setReduceMotion] = useState(false);
  const journeyStarted = ['live', 'started', 'inactive', 'overdue', 'arrived_verified'].includes(
    String(status ?? '').toLowerCase(),
  );
  const awaitingFirstUpdate = journeyStarted && clamped <= 0;

  useEffect(() => {
    const id = anim.addListener(({ value }) => setT(Math.max(0, Math.min(1, value / 100))));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(displayProgress);
      return;
    }
    Animated.timing(anim, { toValue: displayProgress, duration: 700, useNativeDriver: false }).start();
  }, [displayProgress, anim, reduceMotion]);

  const dot = pointAt(t);
  const angle = tangentAngleAt(t);
  const dashOffset = TOTAL_LEN * (1 - t);
  const stageLabel = getTravelStageFromProgress(clamped, 'guest', { journeyStarted });
  const roundedPct = Math.round(clamped);
  const progressChipText = awaitingFirstUpdate
    ? 'Waiting for first update'
    : `${roundedPct}% along the way`;
  const movingCopy =
    awaitingFirstUpdate
      ? etaMinutes != null
        ? `Just started · ~${etaMinutes} min to go · privacy delay on`
        : 'Just started · first privacy-safe update coming soon'
      : etaMinutes != null
        ? `On the move · about ${etaMinutes} min left`
        : journeyStarted
          ? 'On the move · updates stay privacy-safe'
          : 'Tap Start Journey when you are ready to roll';

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
        {journeyStarted ? (
          <View style={[styles.progressChip, awaitingFirstUpdate && styles.progressChipWaiting]}>
            <Text style={styles.progressChipText}>{progressChipText}</Text>
          </View>
        ) : null}

        <Svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height={embedded ? 280 : 236}>
          <Defs>
            <SvgGradient id="arrivalTrack" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={primaryColor} />
              <Stop offset="1" stopColor={secondaryColor} />
            </SvgGradient>
            <SvgGradient id="mapFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#121A33" stopOpacity="0.35" />
              <Stop offset="1" stopColor="#070B16" stopOpacity="0.92" />
            </SvgGradient>
          </Defs>

          <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} rx={18} fill="#0C1426" />
          <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} rx={18} fill="url(#mapFade)" />

          {[56, 110, 164, 218, 272].map((y) => (
            <Path key={`h-${y}`} d={`M16 ${y} H${VIEW_W - 16}`} stroke="rgba(148,163,184,0.08)" strokeWidth={1} />
          ))}
          {[80, 170, 260, 350, 440, 530].map((x) => (
            <Path key={`v-${x}`} d={`M${x} 16 V${VIEW_H - 16}`} stroke="rgba(148,163,184,0.06)" strokeWidth={1} />
          ))}
          <Path
            d="M28 220 C150 180, 210 250, 320 210 S470 140, 620 200"
            stroke="rgba(96,165,250,0.12)"
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
          />

          {/* Full remaining route */}
          <Path
            d={PATH_D}
            fill="none"
            stroke="rgba(96,165,250,0.45)"
            strokeWidth={4}
            strokeDasharray="3 11"
            strokeLinecap="round"
          />
          {/* Traveled glow + solid */}
          <Path
            d={PATH_D}
            fill="none"
            stroke={primaryColor}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${TOTAL_LEN}`}
            strokeDashoffset={dashOffset}
            opacity={0.28}
          />
          <Path
            d={PATH_D}
            fill="none"
            stroke="url(#arrivalTrack)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${TOTAL_LEN}`}
            strokeDashoffset={dashOffset}
          />

          {/* Start */}
          <Circle cx={P0.x} cy={P0.y} r={24} fill={primaryColor} opacity={0.18} />
          <Circle cx={P0.x} cy={P0.y} r={12} fill={primaryColor} opacity={0.4} />
          <Circle cx={P0.x} cy={P0.y} r={6.5} fill={primaryColor} />
          <Circle cx={P0.x} cy={P0.y} r={2.5} fill="#FFFFFF" />
          <SvgText x={P0.x - 10} y={P0.y - 34} fill="#C4B5FD" fontSize="11" fontWeight="800">
            FROM
          </SvgText>
          <SvgText x={P0.x - 10} y={P0.y + 38} fill="rgba(255,255,255,0.92)" fontSize="13" fontWeight="700">
            {truncateLabel(startLabel, 28)}
          </SvgText>

          {/* Destination */}
          <Circle cx={P2.x} cy={P2.y} r={24} fill={secondaryColor} opacity={0.18} />
          <Circle cx={P2.x} cy={P2.y} r={12} fill={secondaryColor} opacity={0.4} />
          <Circle cx={P2.x} cy={P2.y} r={6.5} fill={secondaryColor} />
          <Circle cx={P2.x} cy={P2.y} r={2.5} fill="#FFFFFF" />
          <SvgText x={P2.x - 70} y={P2.y - 34} fill="#93C5FD" fontSize="11" fontWeight="800">
            TO
          </SvgText>
          <SvgText x={P2.x - 120} y={P2.y + 38} fill="rgba(255,255,255,0.92)" fontSize="13" fontWeight="700">
            {truncateLabel(destinationLabel, 28)}
          </SvgText>

          <Circle cx={dot.x} cy={dot.y} r={28} fill="#EF4444" opacity={0.12} />
          <Circle cx={dot.x} cy={dot.y} r={17} fill="#EF4444" opacity={0.2} />
          <G transform={`translate(${dot.x}, ${dot.y}) rotate(${angle})`}>
            <SvgText x={0} y={6} fontSize="24" textAnchor="middle">
              🚗
            </SvgText>
          </G>
        </Svg>

        <View style={styles.etaPillRow} pointerEvents="none">
          <View style={[styles.etaPill, awaitingFirstUpdate && styles.etaPillWaiting]}>
            <Text style={styles.etaPillIcon}>{awaitingFirstUpdate ? '✨' : '⏱'}</Text>
            <Text style={styles.etaPillText}>{movingCopy}</Text>
          </View>
        </View>
      </View>

      {!embedded && safetyMessage ? <Text style={styles.safety}>{safetyMessage}</Text> : null}
    </View>
  );
}

function truncateLabel(label: string, max: number) {
  const first = label.split(',')[0]?.trim() || label.trim();
  if (first.length <= max) return first;
  return `${first.slice(0, max - 1).trimEnd()}…`;
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
    backgroundColor: '#0C1426',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    position: 'relative',
  },
  progressChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(15,21,39,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  progressChipWaiting: {
    borderColor: 'rgba(52,211,153,0.35)',
    backgroundColor: 'rgba(6,78,59,0.55)',
  },
  progressChipText: { color: '#E9D5FF', fontSize: 12, fontWeight: '800' },
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
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(8,12,24,0.88)',
    paddingHorizontal: 16,
    paddingVertical: 11,
    maxWidth: '94%',
  },
  etaPillWaiting: {
    borderColor: 'rgba(168,85,247,0.4)',
    backgroundColor: 'rgba(46,16,101,0.82)',
  },
  etaPillIcon: { fontSize: 13 },
  etaPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  safety: { color: '#6B7099', fontSize: 11, fontWeight: '600' },
});
