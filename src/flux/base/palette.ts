export type Palette = {
  white: string;
  black: string;

  contrast_0: string;
  contrast_25: string;
  contrast_50: string;
  contrast_100: string;
  contrast_200: string;
  contrast_300: string;
  contrast_400: string;
  contrast_500: string;
  contrast_600: string;
  contrast_700: string;
  contrast_800: string;
  contrast_900: string;
  contrast_950: string;
  contrast_975: string;
  contrast_1000: string;

  primary_25: string;
  primary_50: string;
  primary_100: string;
  primary_200: string;
  primary_300: string;
  primary_400: string;
  primary_500: string;
  primary_600: string;
  primary_700: string;
  primary_800: string;
  primary_900: string;
  primary_950: string;
  primary_975: string;

  positive_25: string;
  positive_50: string;
  positive_100: string;
  positive_200: string;
  positive_300: string;
  positive_400: string;
  positive_500: string;
  positive_600: string;
  positive_700: string;
  positive_800: string;
  positive_900: string;
  positive_950: string;
  positive_975: string;

  negative_25: string;
  negative_50: string;
  negative_100: string;
  negative_200: string;
  negative_300: string;
  negative_400: string;
  negative_500: string;
  negative_600: string;
  negative_700: string;
  negative_800: string;
  negative_900: string;
  negative_950: string;
  negative_975: string;

  /**
   * Semantic status ramps, one pair per theme.
   *
   * Paired rather than single because **no single value can pass 4.5:1 on both
   * the cream canvas and the ink canvas** — they are too far apart in
   * luminance. An earlier version kept status colours theme-independent, and
   * every one of them failed on one theme or the other. Lightness moves with the
   * theme; hue does not, so a green still reads as "success" in both.
   *
   * `*_strong` sits on the tinted status surfaces, which sit closer to the text
   * colour than the canvas does and need a deeper step.
   */
  semantic_success: string;
  semantic_warning: string;
  semantic_error: string;
  semantic_info: string;
  semantic_success_strong: string;
  semantic_warning_strong: string;
  semantic_error_strong: string;
  semantic_info_strong: string;
  border_warning: string;
  /** Tinted status surfaces, one per theme. */
  bg_success: string;
  bg_warning: string;
  bg_error: string;
  bg_info: string;
  /** Border steps for a status surface. */
  border_success: string;
  border_error: string;
  border_info: string;

  /**
   * The launcher blue.
   *
   * A **deliberate exception** to the one-accent rule (design.md §1). The
   * launcher icon is the one place the app is seen without any of its own UI
   * around it, so it is identified by a colour the interface never uses. Inside
   * the app there is no blue, which is what keeps the exception legible as an
   * exception rather than as a second accent.
   *
   * Held here rather than in `app.json` so that the icon colour and the design
   * system can be checked against each other — `scripts/verify-tokens.ts`
   * asserts they are the same value, so the icon can never drift from the
   * palette without a failure.
   */
  brand_launcher: string;
};

const STATIC_VALUES = {
  white: '#FFFFFF',
  black: '#000000',
};

/**
 * Colors that hold their value across light/dark. `invertPalette` passes these
 * through untouched.
 */
/**
 * Status colours, as an explicit light/dark pair.
 *
 * Every value was chosen by measuring its contrast against the surface it is
 * actually used on, then taking the nearest passing step of the relevant ramp so
 * the design keeps its identity. `scripts/verify-tokens.ts` re-measures all of
 * them, so a future edit that breaks one fails the build rather than shipping.
 */
const SEMANTIC = {
  success: { light: '#036D38', dark: '#04904A' },
  warning: { light: '#8A5A00', dark: '#E0A83C' },
  error: { light: '#CA123D', dark: '#F65A7F' },
  info: { light: '#2A5C9E', dark: '#7FB0EA' },
} as const;

/** On-surface status text, for a status block that has its own tinted fill. */
const SEMANTIC_STRONG = {
  success: { light: '#04522B', dark: '#7FE3B0' },
  warning: { light: '#5C3B00', dark: '#F0C77A' },
  error: { light: '#7F0B26', dark: '#FF9DB0' },
  info: { light: '#1E3F6E', dark: '#A8CCF5' },
} as const;

/**
 * Tinted status surfaces.
 *
 * Dark surfaces are dark *tints*, not the pale ends of the ramps inverted. An
 * inverted ramp turns a pale mint into a dark mint, which is right for a border
 * and wrong for a fill you are about to put light text on.
 */
const SEMANTIC_SURFACE = {
  success: { light: '#D3FDE8', dark: '#0B2E1E' },
  warning: { light: '#FDF0DC', dark: '#2E2205' },
  error: { light: '#FEE7EC', dark: '#2E0A16' },
  info: { light: '#E4EEF9', dark: '#0E1F35' },
} as const;

const SEMANTIC_BORDER = {
  success: { light: '#A3FACF', dark: '#04522B' },
  warning: { light: '#E8CE9B', dark: '#5C3B00' },
  error: { light: '#FDD3DD', dark: '#7F0B26' },
  info: { light: '#BCD3F0', dark: '#1E3F6E' },
} as const;

/**
 * Flattens the semantic pairs for a scheme.
 *
 * `invertPalette` cannot derive these from the ramps — that is the whole reason
 * they are explicit pairs — so dark mode selects the other side directly.
 */
function expandSemantics(scheme: 'light' | 'dark') {
  const pick = (pair: { light: string; dark: string }) => pair[scheme];
  return {
    semantic_success: pick(SEMANTIC.success),
    semantic_warning: pick(SEMANTIC.warning),
    semantic_error: pick(SEMANTIC.error),
    semantic_info: pick(SEMANTIC.info),
    semantic_success_strong: pick(SEMANTIC_STRONG.success),
    semantic_warning_strong: pick(SEMANTIC_STRONG.warning),
    semantic_error_strong: pick(SEMANTIC_STRONG.error),
    semantic_info_strong: pick(SEMANTIC_STRONG.info),
    bg_success: pick(SEMANTIC_SURFACE.success),
    bg_warning: pick(SEMANTIC_SURFACE.warning),
    bg_error: pick(SEMANTIC_SURFACE.error),
    bg_info: pick(SEMANTIC_SURFACE.info),
    border_success: pick(SEMANTIC_BORDER.success),
    border_warning: pick(SEMANTIC_BORDER.warning),
    border_error: pick(SEMANTIC_BORDER.error),
    border_info: pick(SEMANTIC_BORDER.info),
  };
}

/**
 * The launcher blue.
 *
 * Deliberately outside every ramp: it is a brand mark, not a UI colour, and
 * giving it ramp steps would invite it to be used as one. White sits on it at
 * 5.17:1, so the folder glyph clears AA comfortably.
 */
export const LAUNCHER_BLUE = '#2563EB';

export const DEFAULT_PALETTE: Palette = {
  brand_launcher: LAUNCHER_BLUE,
  white: STATIC_VALUES.white,
  black: STATIC_VALUES.black,

  contrast_0: '#F7F7F4',
  contrast_25: '#FAFAF7',
  contrast_50: '#EFEEE8',
  contrast_100: '#E6E5E0',
  contrast_200: '#E6E5E0',
  contrast_300: '#CFCDC4',
  contrast_400: '#A09C92',
  contrast_500: '#807D72',
  contrast_600: '#5A5852',
  contrast_700: '#5A5852',
  contrast_800: '#26251E',
  contrast_900: '#26251E',
  contrast_950: '#1B1A16',
  contrast_975: '#12110E',
  contrast_1000: '#0A0A08',

  primary_25: '#FFF4EC',
  primary_50: '#FFE6D6',
  primary_100: '#FFC7AC',
  primary_200: '#FFA47C',
  primary_300: '#FC8050',
  primary_400: '#F9692B',
  primary_500: '#F54E00',
  primary_600: '#D04200',
  primary_700: '#A93600',
  primary_800: '#822B00',
  primary_900: '#5C1F00',
  primary_950: '#3D1400',
  primary_975: '#250C00',

  positive_25: '#ECFEF5',
  positive_50: '#D3FDE8',
  positive_100: '#A3FACF',
  positive_200: '#6AF6B0',
  positive_300: '#2CF28F',
  positive_400: '#0DD370',
  positive_500: '#09B35E',
  positive_600: '#04904A',
  positive_700: '#036D38',
  positive_800: '#04522B',
  positive_900: '#033F21',
  positive_950: '#032A17',
  positive_975: '#021D0F',

  negative_25: '#FFF5F7',
  negative_50: '#FEE7EC',
  negative_100: '#FDD3DD',
  negative_200: '#FBBBCA',
  negative_300: '#F891A9',
  negative_400: '#F65A7F',
  negative_500: '#E91646',
  negative_600: '#CA123D',
  negative_700: '#A71134',
  negative_800: '#7F0B26',
  negative_900: '#5F071C',
  negative_950: '#430413',
  negative_975: '#30030D',

  ...expandSemantics('light'),
};

export const DEFAULT_SUBDUED_PALETTE: Palette = {
  brand_launcher: LAUNCHER_BLUE,
  white: STATIC_VALUES.white,
  black: STATIC_VALUES.black,

  contrast_0: '#F7F7F4',
  contrast_25: '#FAFAF7',
  contrast_50: '#EFEEE8',
  contrast_100: '#E6E5E0',
  contrast_200: '#E6E5E0',
  contrast_300: '#CFCDC4',
  contrast_400: '#A09C92',
  contrast_500: '#807D72',
  contrast_600: '#5A5852',
  contrast_700: '#5A5852',
  contrast_800: '#26251E',
  contrast_900: '#26251E',
  contrast_950: '#1B1A16',
  contrast_975: '#12110E',
  contrast_1000: '#0A0A08',

  primary_25: '#FFF4EC',
  primary_50: '#FFE6D6',
  primary_100: '#FFC7AC',
  primary_200: '#FFA47C',
  primary_300: '#FC8050',
  primary_400: '#F9692B',
  primary_500: '#F54E00',
  primary_600: '#D04200',
  primary_700: '#A93600',
  primary_800: '#822B00',
  primary_900: '#5C1F00',
  primary_950: '#3D1400',
  primary_975: '#250C00',

  positive_25: '#ECFEF5',
  positive_50: '#D8FDEB',
  positive_100: '#A8FAD1',
  positive_200: '#6FF6B3',
  positive_300: '#31F291',
  positive_400: '#0EDD75',
  positive_500: '#0AC266',
  positive_600: '#049F52',
  positive_700: '#038142',
  positive_800: '#056636',
  positive_900: '#04522B',
  positive_950: '#053D21',
  positive_975: '#052917',

  negative_25: '#FFF5F7',
  negative_50: '#FEEBEF',
  negative_100: '#FDD8E1',
  negative_200: '#FCC0CE',
  negative_300: '#F99AB0',
  negative_400: '#F76486',
  negative_500: '#EB2452',
  negative_600: '#D81341',
  negative_700: '#BA1239',
  negative_800: '#910D2C',
  negative_900: '#6F0B22',
  negative_950: '#500B1C',
  negative_975: '#3E0915',

  ...expandSemantics('light'),
};

export function invertPalette(palette: Palette) {
  return {
    white: palette.white,
    black: palette.black,

    contrast_0: palette.contrast_1000,
    contrast_25: palette.contrast_975,
    contrast_50: palette.contrast_950,
    contrast_100: palette.contrast_900,
    contrast_200: palette.contrast_800,
    contrast_300: palette.contrast_700,
    contrast_400: palette.contrast_600,
    contrast_500: palette.contrast_500,
    contrast_600: palette.contrast_400,
    contrast_700: palette.contrast_300,
    contrast_800: palette.contrast_200,
    contrast_900: palette.contrast_100,
    contrast_950: palette.contrast_50,
    contrast_975: palette.contrast_25,
    contrast_1000: palette.contrast_0,

    primary_25: palette.primary_975,
    primary_50: palette.primary_950,
    primary_100: palette.primary_900,
    primary_200: palette.primary_800,
    primary_300: palette.primary_700,
    primary_400: palette.primary_600,
    primary_500: palette.primary_500,
    primary_600: palette.primary_400,
    primary_700: palette.primary_300,
    primary_800: palette.primary_200,
    primary_900: palette.primary_100,
    primary_950: palette.primary_50,
    primary_975: palette.primary_25,

    positive_25: palette.positive_975,
    positive_50: palette.positive_950,
    positive_100: palette.positive_900,
    positive_200: palette.positive_800,
    positive_300: palette.positive_700,
    positive_400: palette.positive_600,
    positive_500: palette.positive_500,
    positive_600: palette.positive_400,
    positive_700: palette.positive_300,
    positive_800: palette.positive_200,
    positive_900: palette.positive_100,
    positive_950: palette.positive_50,
    positive_975: palette.positive_25,

    negative_25: palette.negative_975,
    negative_50: palette.negative_950,
    negative_100: palette.negative_900,
    negative_200: palette.negative_800,
    negative_300: palette.negative_700,
    negative_400: palette.negative_600,
    negative_500: palette.negative_500,
    negative_600: palette.negative_400,
    negative_700: palette.negative_300,
    negative_800: palette.negative_200,
    negative_900: palette.negative_100,
    negative_950: palette.negative_50,
    negative_975: palette.negative_25,

    // Deliberately *not* derived from the passed palette: the semantic pairs are
    // authored per theme, so inverting them would undo the contrast work.
    ...expandSemantics('dark'),
    // The launcher blue is a brand mark, not a theme value. It must not be
    // inverted — a launcher icon that changes colour with the system theme would
    // make the app unrecognisable on the home screen.
    brand_launcher: LAUNCHER_BLUE,
  };
}
