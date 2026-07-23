/**
 * My Prediktion landing-surface palette.
 *
 * The landing page (LandingScreen + LandingDashboardLayout) is theme-aware:
 * a warm "sunrise" identity in light mode and the in-app "midnight" identity
 * in dark mode. Both variants expose the SAME keys so the shared style
 * factories can stay palette-agnostic — call `getLandingPalette(isDark)`.
 */
export type LandingPalette = {
  bg: string;
  bgSoft: string;
  surface: string;
  surfaceTint: string;
  text: string;
  textSoft: string;
  border: string;
  coral: string;
  coralSoft: string;
  peach: string;
  mint: string;
  mintSoft: string;
  mintText: string;
  berry: string;
  sky: string;
  online: string;
  onSurfaceDark: string;
  badgePinkBg: string;
  amberBg: string;
  amberText: string;
  gateBg: string;
  gradHero: [string, string];
  gradPrimary: [string, string];
  gradFinal: [string, string];
};

const sunrise: LandingPalette = {
  bg: '#FFF7EE',
  bgSoft: '#FFE9D5',
  surface: '#FFFFFF',
  surfaceTint: '#FFF2E5',
  text: '#2B1F1A',
  textSoft: '#7B675C',
  border: '#F5C9A8',
  coral: '#FF8E6E',
  coralSoft: '#FFD4C8',
  peach: '#FFC86E',
  mint: '#8EE3C4',
  mintSoft: '#DDF8EE',
  mintText: '#27886E',
  berry: '#F36AA0',
  sky: '#7AD7F0',
  online: '#2FB27C',
  onSurfaceDark: '#4A2412',
  badgePinkBg: '#FFE0EC',
  amberBg: '#FFF0CA',
  amberText: '#B66A17',
  gateBg: '#FFE6EF',
  gradHero: ['#FFE1CF', '#FFF7EE'],
  gradPrimary: ['#FF9C7A', '#FFC56B'],
  gradFinal: ['#FFB08B', '#F58CC0'],
};

const midnight: LandingPalette = {
  bg: '#060816',
  bgSoft: '#12172A',
  surface: '#0F1527',
  surfaceTint: '#171F36',
  text: '#FFFFFF',
  textSoft: '#9BA7C2',
  border: '#283252',
  // Primary brand accent = cyan (brand mark, active nav, primary CTAs).
  coral: '#22D3EE',
  coralSoft: 'rgba(34,211,238,0.16)',
  peach: '#FBBF24',
  mint: '#34D399',
  mintSoft: 'rgba(52,211,153,0.14)',
  mintText: '#6EE7B7',
  // Secondary accent = violet (SOLO badge, LIVE pills) — the one purple we keep.
  berry: '#A78BFA',
  sky: '#38BDF8',
  online: '#22C55E',
  // Dark text reads on the bright cyan buttons/gradients.
  onSurfaceDark: '#04121A',
  badgePinkBg: 'rgba(167,139,250,0.2)',
  amberBg: 'rgba(251,191,36,0.14)',
  amberText: '#FBBF24',
  gateBg: 'rgba(167,139,250,0.14)',
  gradHero: ['#0E1A33', '#090C19'],
  gradPrimary: ['#22D3EE', '#14B8A6'],
  gradFinal: ['#0EA5E9', '#14B8A6'],
};

export function getLandingPalette(isDark: boolean): LandingPalette {
  return isDark ? midnight : sunrise;
}
