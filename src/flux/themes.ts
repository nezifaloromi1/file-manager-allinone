import { createThemes, DEFAULT_PALETTE, DEFAULT_SUBDUED_PALETTE } from '#/flux/base';

const DEFAULT_THEMES = createThemes({
  defaultPalette: DEFAULT_PALETTE,
  subduedPalette: DEFAULT_SUBDUED_PALETTE,
});

export const themes = {
  lightPalette: DEFAULT_THEMES.light.palette,
  darkPalette: DEFAULT_THEMES.dark.palette,
  dimPalette: DEFAULT_THEMES.dim.palette,
  light: DEFAULT_THEMES.light,
  dark: DEFAULT_THEMES.dark,
  dim: DEFAULT_THEMES.dim,
};

/**
 * @deprecated use FLUX and access palette from `useTheme()`
 */
export const lightPalette = DEFAULT_THEMES.light.palette;
/**
 * @deprecated use FLUX and access palette from `useTheme()`
 */
export const darkPalette = DEFAULT_THEMES.dark.palette;
/**
 * @deprecated use FLUX and access palette from `useTheme()`
 */
export const dimPalette = DEFAULT_THEMES.dim.palette;
/**
 * @deprecated use FLUX and access theme from `useTheme()`
 */
export const light = DEFAULT_THEMES.light;
/**
 * @deprecated use FLUX and access theme from `useTheme()`
 */
export const dark = DEFAULT_THEMES.dark;
/**
 * @deprecated use FLUX and access theme from `useTheme()`
 */
export const dim = DEFAULT_THEMES.dim;
