import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { journeyPalette } from '../theme/journeyPalette';

/**
 * Soft ambient glow behind the home content.
 *
 * A plain `borderRadius` circle reads as a hard-edged disc on web (react-native
 * has no blur primitive there), so this uses an SVG radial gradient that fades
 * to fully transparent instead.
 */
export default function JourneyGlow() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="journeyGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={journeyPalette.purple} stopOpacity={0.34} />
            <Stop offset="0.55" stopColor={journeyPalette.purple} stopOpacity={0.12} />
            <Stop offset="1" stopColor={journeyPalette.purple} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#journeyGlow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: -220, right: -180, width: 560, height: 560 },
});
