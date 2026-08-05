import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { journeyPalette } from '../theme/journeyPalette';

/** viewBox of the built-in illustration. Exported so callers can reserve a box
 *  with the same shape and avoid letterboxing the SVG inside it. */
export const JOURNEY_ROUTE_ART_ASPECT = 320 / 120;

type Props = {
  /** Rendered height of the art block. Width always fills the parent. */
  height?: number;
  /**
   * Derive the height from the width via the art's own aspect ratio instead of
   * pinning it. The SVG uses `meet`, so a box of any other shape letterboxes it —
   * this keeps the drawing flush with its container at every viewport width.
   */
  fitWidth?: boolean;
  /**
   * ────────────────────────── ART SWAP SLOT ──────────────────────────
   * Pass richer artwork here (Lottie, an <Image>, a 3D render) and it
   * replaces the built-in SVG entirely. Nothing else about the hero card
   * needs to change — it only reserves the box.
   * ───────────────────────────────────────────────────────────────────
   */
  artwork?: React.ReactNode;
};

/**
 * Placeholder hero illustration: a dashed route between two pins with a car
 * marker partway along it. Pure SVG so it ships with no asset pipeline and
 * scales cleanly at every breakpoint.
 */
export default function JourneyRouteArt({ height = 132, fitWidth = false, artwork }: Props) {
  const box = fitWidth ? { aspectRatio: JOURNEY_ROUTE_ART_ASPECT } : { height };

  if (artwork) {
    return <View style={[styles.wrap, box]}>{artwork}</View>;
  }

  return (
    <View style={[styles.wrap, box]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid meet">
        <Defs>
          <LinearGradient id="journeyRoute" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={journeyPalette.purple} />
            <Stop offset="1" stopColor={journeyPalette.blue} />
          </LinearGradient>
        </Defs>

        {/* Route: start pin → curve → end pin */}
        <Path
          d="M40 82 C 100 82, 110 34, 160 34 S 230 82, 284 44"
          stroke="url(#journeyRoute)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="9 9"
          fill="none"
          opacity={0.9}
        />

        {/* Origin pin */}
        <G>
          <Circle cx={40} cy={82} r={13} fill={journeyPalette.purple} opacity={0.18} />
          <Circle cx={40} cy={82} r={7} fill={journeyPalette.purple} />
          <Circle cx={40} cy={82} r={2.6} fill="#FFFFFF" />
        </G>

        {/* Destination pin (teardrop) */}
        <G>
          <Circle cx={284} cy={44} r={15} fill={journeyPalette.blue} opacity={0.18} />
          <Path
            d="M284 30 c-5.4 0-9.8 4.3-9.8 9.7 0 7.2 9.8 17.6 9.8 17.6 s9.8-10.4 9.8-17.6 c0-5.4-4.4-9.7-9.8-9.7 z"
            fill={journeyPalette.blue}
          />
          <Circle cx={284} cy={39.6} r={3.4} fill="#FFFFFF" />
        </G>

        {/* Car marker, riding the route */}
        <G>
          <Circle cx={163} cy={34} r={17} fill={journeyPalette.blueLight} opacity={0.16} />
          <Rect x={150} y={26} width={26} height={13} rx={5} fill="#FFFFFF" />
          <Path d="M154 26 l3.5-5.5 h11 L172 26 z" fill={journeyPalette.purpleLight} />
          <Circle cx={156} cy={40} r={3.4} fill={journeyPalette.purple} />
          <Circle cx={170} cy={40} r={3.4} fill={journeyPalette.purple} />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
});
