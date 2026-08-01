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

  // Accent ramp (purple → blue)
  purple: '#8B5CF6',
  purpleLight: '#A78BFA',
  blue: '#3B82F6',
  blueLight: '#60A5FA',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A5AAC9',
  textMuted: '#6B7099',

  // Gradients
  gradAccent: ['#8B5CF6', '#3B82F6'] as [string, string],
  gradHeroSurface: ['rgba(139,92,246,0.20)', 'rgba(59,130,246,0.10)'] as [string, string],
  gradGlow: ['rgba(139,92,246,0.30)', 'rgba(59,130,246,0.00)'] as [string, string],
} as const;

/** Width at or above which the home screen renders its desktop dashboard layout. */
export const JOURNEY_DESKTOP_BREAKPOINT = 1024;
