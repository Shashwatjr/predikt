import { Platform } from 'react-native';

/**
 * Journey home accent — dark surface with a purple→blue gradient.
 *
 * Scoped deliberately to the Journey home surface rather than folded into
 * `designSystem.palette`, whose cyan/teal accent is still what every other
 * screen renders. Swap the app-wide palette here first if the purple→blue
 * accent is ever adopted globally.
 */
export const journeyPalette = {
  // Surfaces
  bg: '#07081A',
  surface: '#111233',
  surfaceHigh: '#181A42',
  border: 'rgba(139,124,246,0.20)',
  borderStrong: 'rgba(139,124,246,0.38)',

  /**
   * Translucent "glass" fills. Layered over the dark surfaces for chips, tiles
   * and secondary buttons so those elements read as lifted rather than as
   * another opaque panel.
   */
  glass: 'rgba(255,255,255,0.05)',
  glassHigh: 'rgba(255,255,255,0.08)',
  borderSoft: 'rgba(255,255,255,0.07)',

  // Accent ramp (purple → indigo → blue)
  purple: '#8B5CF6',
  purpleLight: '#A78BFA',
  indigo: '#5B6BFF',
  blue: '#3B82F6',
  blueLight: '#60A5FA',

  /**
   * Status accents. These carry meaning and are used consistently:
   * cyan = the bot / a settled result, green = live, orange = waiting on you.
   */
  cyan: '#34E0F5',
  green: '#35D492',
  orange: '#FF9F45',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A5AAC9',
  textMuted: '#6B7099',

  // Gradients
  gradAccent: ['#8B5CF6', '#3B82F6'] as [string, string],
  gradAccentWide: ['#8B5CF6', '#5B6BFF', '#4361FF'] as [string, string, string],
  gradCyan: ['#5B6BFF', '#34E0F5'] as [string, string],
  gradHeroSurface: ['rgba(139,92,246,0.20)', 'rgba(59,130,246,0.10)'] as [string, string],
  gradGlow: ['rgba(139,92,246,0.30)', 'rgba(59,130,246,0.00)'] as [string, string],
} as const;

/**
 * Monospace stack for clock times and numeric readouts, so digits align and a
 * time never reads as prose. No custom font is bundled — this resolves to the
 * platform's own mono face.
 */
export const journeyMono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
}) as string;

/** Width at or above which the home screen renders its desktop dashboard layout. */
export const JOURNEY_DESKTOP_BREAKPOINT = 1024;
