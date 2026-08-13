/**
 * Single source of truth for the WanderPlan color palette.
 * Tailwind (tailwind.config.js), the MUI theme (theme/index.ts), and any
 * component that needs a raw hex value (inline styles, SVG strokes) all
 * read from here — change a value in this file and it applies everywhere.
 */
export const palette = {
  surface: '#F1F8F6',
  white: '#FFFFFF',
  ink: '#223138',
  inkSoft: '#667479',
  line: '#DCEEE9',

  navy: '#0C3B52',
  navySoft: '#9BC3D2',
  navyMuted: '#6FA0B3',

  ocean: '#1D96C2',
  oceanDark: '#146086',
  oceanTint: '#E4F4FA',
  oceanLight: '#33B0DC',

  coral: '#FF6F59',
  coralDark: '#D6503B',
  coralTint: '#FFECE8',
  coralLight: '#FF8C79',

  mint: '#17B899',
  mintDark: '#0E8A73',
  mintTint: '#E1F7F1',
  mintLight: '#3FCBB2',

  amber: '#FFB648',
  amberDark: '#C97D12',
  amberTint: '#FFF3E0',
  amberLight: '#FFC46B',

  violet: '#8B7FD6',
  violetDark: '#5B4FB0',
  violetTint: '#EFEBFB',
  violetLight: '#A597E6',

  idea: '#B7BBBD',
  ideaDark: '#5B6469',
  ideaTint: '#EDEFEF',
  ideaLight: '#C9CCCE',

  gold: '#FFE9A8',
  skyTint: '#DDF1FA',
} as const;

export type PaletteColor = keyof typeof palette;

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
