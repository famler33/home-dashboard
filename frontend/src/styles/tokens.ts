export type ThemeName = 'day' | 'night';

export const colorTokens = [
  'surface',
  'surface-raised',
  'ink',
  'ink-muted',
  'accent',
  'warn',
  'danger',
] as const;
export type ColorToken = (typeof colorTokens)[number];

export const themes: Record<ThemeName, Record<ColorToken, string>> = {
  day: {
    surface: '#eeeae2',
    'surface-raised': '#fbfaf7',
    ink: '#15181e',
    'ink-muted': '#454c59',
    accent: '#1d4e9e',
    warn: '#7a4a00',
    danger: '#a5281f',
  },
  night: {
    surface: '#0a0d13',
    'surface-raised': '#131822',
    ink: '#e4e8f0',
    'ink-muted': '#a2aabb',
    accent: '#86b4ff',
    warn: '#f0b14a',
    danger: '#ff8f85',
  },
};

export type TypeToken = 'caption' | 'body' | 'title' | 'display' | 'clock';

/** Tablet layout: `max(minPx, vw vw)`; the floor keeps the smallest text readable from 2-3 m. */
export const tabletTypeScale: Record<TypeToken, { minPx: number; vw: number; vh?: number }> = {
  caption: { minPx: 28, vw: 1.35 },
  body: { minPx: 32, vw: 1.6 },
  title: { minPx: 40, vw: 2.1 },
  display: { minPx: 64, vw: 4.2 },
  clock: { minPx: 112, vw: 9, vh: 15 },
};

/** Phone layout: normal reading distance. */
export const phoneTypeScalePx: Record<TypeToken, number> = {
  caption: 14,
  body: 16,
  title: 20,
  display: 32,
  clock: 56,
};

/** Landscape screens from tablet size up use the wall layout, everything else the phone layout. */
export const tabletMediaQuery = '(min-width: 900px) and (orientation: landscape)';

export function fontSizeAt(
  token: TypeToken,
  viewportWidthPx: number,
  viewportHeightPx: number,
): number {
  const { minPx, vw, vh } = tabletTypeScale[token];
  const byWidth = (vw / 100) * viewportWidthPx;
  const byHeight = vh === undefined ? Number.POSITIVE_INFINITY : (vh / 100) * viewportHeightPx;
  return Math.max(minPx, Math.min(byWidth, byHeight));
}

/** CSS value of a tablet type token: `max(floor, min(width part, height part))`. */
export function tabletFontSizeCss(token: TypeToken): string {
  const { minPx, vw, vh } = tabletTypeScale[token];
  const inner = vh === undefined ? `${vw}vw` : `min(${vw}vw, ${vh}vh)`;
  return `max(${minPx}px, ${inner})`;
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Pairs that are actually used for text, with the minimum contrast each must reach. */
export const readablePairs: readonly { fg: ColorToken; bg: ColorToken; min: number }[] = [
  { fg: 'ink', bg: 'surface', min: 7 },
  { fg: 'ink', bg: 'surface-raised', min: 7 },
  { fg: 'ink-muted', bg: 'surface', min: 4.5 },
  { fg: 'ink-muted', bg: 'surface-raised', min: 4.5 },
  { fg: 'accent', bg: 'surface', min: 4.5 },
  { fg: 'accent', bg: 'surface-raised', min: 4.5 },
  { fg: 'warn', bg: 'surface-raised', min: 4.5 },
  { fg: 'danger', bg: 'surface-raised', min: 4.5 },
];

export function hexToRgbChannels(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
