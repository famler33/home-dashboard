import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import {
  colorTokens,
  hexToRgbChannels,
  lineHeights,
  phoneTypeScalePx,
  tabletFontSizeCss,
  tabletMediaQuery,
  tabletShortMediaQuery,
  tabletTypeScale,
  themes,
  type TypeToken,
} from './src/styles/tokens';

const typeTokens = Object.keys(tabletTypeScale) as TypeToken[];

const themeVariables = (theme: keyof typeof themes): Record<string, string> =>
  Object.fromEntries(colorTokens.map((t) => [`--color-${t}`, hexToRgbChannels(themes[theme][t])]));

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(
        colorTokens.map((t) => [t, `rgb(var(--color-${t}) / <alpha-value>)`]),
      ),
      fontFamily: { sans: ['"Inter Variable"', 'system-ui', 'sans-serif'] },
      fontSize: Object.fromEntries(
        typeTokens.map((t) => [t, [`var(--text-${t})`, { lineHeight: String(lineHeights[t]) }]]),
      ),
      transitionDuration: { calm: '600ms' },
      transitionTimingFunction: { calm: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [
    plugin(({ addBase, addVariant }) => {
      addVariant('tablet', `@media ${tabletMediaQuery}`);
      addVariant('tablet-short', `@media ${tabletShortMediaQuery}`);
      addBase({
        ':root': {
          ...themeVariables('day'),
          ...Object.fromEntries(typeTokens.map((t) => [`--text-${t}`, `${phoneTypeScalePx[t]}px`])),
        },
        "[data-theme='night']": themeVariables('night'),
        [`@media ${tabletMediaQuery}`]: {
          ':root': Object.fromEntries(typeTokens.map((t) => [`--text-${t}`, tabletFontSizeCss(t)])),
        },
      });
    }),
  ],
} satisfies Config;
