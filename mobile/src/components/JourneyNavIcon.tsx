import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type JourneyNavIconName = 'home' | 'plus' | 'link' | 'list';

type Props = {
  name: JourneyNavIconName;
  color: string;
  size?: number;
};

/**
 * Stroke icons for the desktop rail. Replaces the emoji glyphs, which rendered
 * at a different weight and baseline on every platform and could not be tinted
 * to match the active nav state.
 */
export default function JourneyNavIcon({ name, color, size = 20 }: Props) {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' ? (
        <>
          <Path d="M3 10.5 12 3l9 7.5" {...common} />
          <Path d="M5 9.5V20h14V9.5" {...common} />
        </>
      ) : null}

      {name === 'plus' ? (
        <>
          <Circle cx={12} cy={12} r={9} {...common} />
          <Path d="M12 8v8M8 12h8" {...common} />
        </>
      ) : null}

      {name === 'link' ? (
        <>
          <Path d="M10 13a4 4 0 0 0 5.66 0l2.5-2.5a4 4 0 1 0-5.66-5.66L11 6.34" {...common} />
          <Path d="M14 11a4 4 0 0 0-5.66 0l-2.5 2.5a4 4 0 1 0 5.66 5.66L13 17.66" {...common} />
        </>
      ) : null}

      {name === 'list' ? <Path d="M4 6h16M4 12h16M4 18h10" {...common} /> : null}
    </Svg>
  );
}
