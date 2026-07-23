// ─── My Prediktion Design Tokens ──────────────────────────────────────────────────
// Single source of truth for all colors, typography and spacing.
// Screens and components import { useTheme } from '../context/ThemeContext'
// and reference c.bg, c.surface, c.purple, etc.

export interface ColorTokens {
  // Backgrounds
  bg: string;
  surface: string;
  surfaceHigh: string;
  // Borders
  border: string;
  borderFocus: string;
  // Brand
  purple: string;
  purpleLight: string;
  purpleDim: string;
  // Semantic
  green: string;
  greenDim: string;
  amber: string;
  red: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Gradients (start/end pairs)
  gradPrimary: [string, string];
  gradGold: [string, string];
  gradGreen: [string, string];
  gradRed: [string, string];
  gradSurface: [string, string];
}

// NOTE: The primary brand accent is cyan/teal (see the landing scheme / brandPalette).
// The `purple*` keys are the long-standing NAMES for "the primary brand accent" that
// screens reference everywhere — their VALUES now hold the cyan brand so the whole app
// renders in the one scheme. Purple survives only as an intentional secondary accent
// (small badges / live pills) via landingPalette.berry and statusColors.completed.
export const dark: ColorTokens = {
  bg:           '#060816',
  surface:      '#0F1527',
  surfaceHigh:  '#171F36',
  border:       '#283252',
  borderFocus:  '#22D3EE',
  purple:       '#22D3EE',
  purpleLight:  '#67E8F9',
  purpleDim:    'rgba(34,211,238,0.16)',
  green:        '#22C55E',
  greenDim:     'rgba(34,197,94,0.16)',
  amber:        '#FBBF24',
  red:          '#ef4444',
  textPrimary:  '#FFFFFF',
  textSecondary:'#9BA7C2',
  textMuted:    '#64748B',
  gradPrimary:  ['#22D3EE', '#14B8A6'],
  gradGold:     ['#fbbf24', '#f59e0b'],
  gradGreen:    ['#22c55e', '#059669'],
  gradRed:      ['#ef4444', '#dc2626'],
  gradSurface:  ['#171F36', '#0F1527'],
};

export const light: ColorTokens = {
  bg:           '#f4fafb',
  surface:      '#ffffff',
  surfaceHigh:  '#ecfeff',
  border:       '#cbe7ee',
  borderFocus:  '#0891B2',
  purple:       '#0891B2',
  purpleLight:  '#06B6D4',
  purpleDim:    'rgba(8,145,178,0.12)',
  green:        '#059669',
  greenDim:     '#05966918',
  amber:        '#d97706',
  red:          '#dc2626',
  textPrimary:  '#0f172a',
  textSecondary:'#475569',
  textMuted:    '#94a3b8',
  gradPrimary:  ['#06B6D4', '#0891B2'],
  gradGold:     ['#f59e0b', '#d97706'],
  gradGreen:    ['#10b981', '#059669'],
  gradRed:      ['#ef4444', '#dc2626'],
  gradSurface:  ['#ffffff', '#ecfeff'],
};
