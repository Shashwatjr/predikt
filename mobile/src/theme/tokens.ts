// ─── PREDIKT Design Tokens ──────────────────────────────────────────────────
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

export const dark: ColorTokens = {
  bg:           '#030816',
  surface:      '#121a35',
  surfaceHigh:  '#1a2347',
  border:       'rgba(96,165,250,0.18)',
  borderFocus:  '#7c3aed',
  purple:       '#7c3aed',
  purpleLight:  '#a78bfa',
  purpleDim:    '#7c3aed22',
  green:        '#10b981',
  greenDim:     '#10b98122',
  amber:        '#f59e0b',
  red:          '#ef4444',
  textPrimary:  '#f1f5f9',
  textSecondary:'#94a3b8',
  textMuted:    '#475569',
  gradPrimary:  ['#7c3aed', '#4f46e5'],
  gradGold:     ['#f59e0b', '#d97706'],
  gradGreen:    ['#10b981', '#059669'],
  gradRed:      ['#ef4444', '#dc2626'],
  gradSurface:  ['#1e293b', '#0f172a'],
};

export const light: ColorTokens = {
  bg:           '#f8fafc',
  surface:      '#ffffff',
  surfaceHigh:  '#f1f5f9',
  border:       '#e2e8f0',
  borderFocus:  '#7c3aed',
  purple:       '#7c3aed',
  purpleLight:  '#6d28d9',
  purpleDim:    '#7c3aed18',
  green:        '#059669',
  greenDim:     '#05966918',
  amber:        '#d97706',
  red:          '#dc2626',
  textPrimary:  '#0f172a',
  textSecondary:'#475569',
  textMuted:    '#94a3b8',
  gradPrimary:  ['#7c3aed', '#4f46e5'],
  gradGold:     ['#f59e0b', '#d97706'],
  gradGreen:    ['#10b981', '#059669'],
  gradRed:      ['#ef4444', '#dc2626'],
  gradSurface:  ['#ffffff', '#f1f5f9'],
};
