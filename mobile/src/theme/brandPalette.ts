/**
 * My Prediktion × Kriviksha brand palette.
 * Corporate midnight base with energetic gaming accents.
 * Mirrors CSS custom properties used on web surfaces.
 */
export const brand = {
  bgMain: '#060816',
  bgSurface: '#0F1527',
  bgSurfaceHover: '#171F36',
  accentPrimary: '#22D3EE',
  accentSecondary: '#A78BFA',
  textPrimary: '#FFFFFF',
  textSecondary: '#9BA7C2',
  borderColor: '#283252',
  accentPrimaryDim: 'rgba(34,211,238,0.14)',
  accentSecondaryDim: 'rgba(167,139,250,0.18)',
  gradCta: ['#22D3EE', '#06B6D4'] as [string, string],
  gradHero: ['#22D3EE', '#14B8A6'] as [string, string],
} as const;

export type BrandPalette = typeof brand;
