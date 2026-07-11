import { Platform, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
  full: 9999,
} as const;

export const typography = {
  hero: { fontSize: 28, lineHeight: 34, fontWeight: '900' as const, letterSpacing: -0.4 },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: '900' as const },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '800' as const },
  h3: { fontSize: 16, lineHeight: 22, fontWeight: '800' as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  bodyBold: { fontSize: 14, lineHeight: 20, fontWeight: '700' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
  micro: { fontSize: 10, lineHeight: 14, fontWeight: '700' as const },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '800' as const, letterSpacing: 0.6 },
} as const;

export const elevation = {
  card: Platform.select<ViewStyle>({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
    android: { elevation: 4 },
    default: {},
  }),
  raised: Platform.select<ViewStyle>({
    ios: { shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

export const layout = {
  maxContentWidth: 720,
  maxWideWidth: 980,
  bottomNavHeight: 82,
  headerHeight: 56,
  breakpoints: { mobile: 0, tablet: 768, desktop: 1024, wide: 1280 },
} as const;

export const motion = {
  fast: 150,
  normal: 280,
  slow: 450,
  spring: { speed: 50, bounciness: 6 },
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 28,
  xl: 40,
} as const;

export const palette = {
  bg: '#030816',
  bgElevated: '#0a1028',
  surface: '#121a35',
  surfaceHigh: '#1a2347',
  border: 'rgba(96,165,250,0.18)',
  borderFocus: '#8b5cf6',
  violet: '#8b5cf6',
  violetLight: '#c4b5fd',
  cyan: '#22d3ee',
  green: '#22c55e',
  orange: '#fb923c',
  pink: '#f472b6',
  amber: '#fbbf24',
  textPrimary: '#f8fafc',
  textSecondary: 'rgba(255,255,255,0.68)',
  textMuted: 'rgba(255,255,255,0.45)',
  gradHero: ['#6d28d9', '#2563eb', '#06b6d4'] as [string, string, string],
  gradPrimary: ['#7c3aed', '#4f46e5'] as [string, string],
  gradCta: ['#1da1ff', '#9333ea'] as [string, string],
  gradGold: ['#fbbf24', '#f59e0b'] as [string, string],
} as const;

export const statusColors = {
  live: '#22d3ee',
  open: '#22c55e',
  locked: '#fbbf24',
  completed: '#8b5cf6',
  cancelled: '#94a3b8',
  warning: '#fb923c',
  error: '#ef4444',
} as const;

export function cardStyle(variant: 'default' | 'elevated' | 'category' = 'default'): ViewStyle {
  return {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: variant === 'elevated' ? palette.surfaceHigh : palette.surface,
    padding: spacing.lg,
    ...(variant === 'elevated' ? elevation.card : {}),
  };
}

export function pillStyle(tone: 'default' | 'live' | 'success' | 'warning' = 'default'): ViewStyle {
  const tones: Record<string, { bg: string; border: string }> = {
    default: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)' },
    live: { bg: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.4)' },
    success: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.35)' },
    warning: { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.35)' },
  };
  const t = tones[tone];
  return {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  };
}

export const screenStyles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: palette.bg },
  glowTop: {
    position: 'absolute',
    top: -140,
    right: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(124,58,237,0.35)',
    pointerEvents: 'none',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -130,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(14,165,233,0.2)',
    pointerEvents: 'none',
  },
  content: {
    width: '100%',
    maxWidth: layout.maxWideWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.huge + spacing.md,
    paddingBottom: layout.bottomNavHeight + spacing.xl,
    gap: spacing.md,
  },
  narrowContent: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
});

export function focusRing(): ViewStyle {
  return Platform.OS === 'web'
    ? ({ outlineStyle: 'solid', outlineWidth: 2, outlineColor: palette.borderFocus } as ViewStyle)
    : {};
}
