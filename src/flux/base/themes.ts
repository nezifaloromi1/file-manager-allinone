import { type ViewStyle } from 'react-native';

import { atoms } from './atoms';

import { Palette, DEFAULT_PALETTE, DEFAULT_SUBDUED_PALETTE, invertPalette } from './palette';
import { alpha } from './utils';

export const themes = createThemes({
  defaultPalette: DEFAULT_PALETTE,
  subduedPalette: DEFAULT_SUBDUED_PALETTE,
});

export type ThemeAtoms = {
  text: {
    color: string;
  };
  text_link: {
    color: string;
  };
  text_contrast_low: {
    color: string;
  };
  text_contrast_medium: {
    color: string;
  };
  text_contrast_high: {
    color: string;
  };
  text_inverted: {
    color: string;
  };
  /** Confirmation indicators. */
  text_success: {
    color: string;
  };
  /** Validation errors. */
  text_error: {
    color: string;
  };
  /**
   * A tinted surface for a status message.
   *
   * Separate from `text_success` because a status needs a *background* to sit
   * on — a destructive confirmation cannot render as red text on the canvas and
   * read as an action.
   */
  bg_success: {
    backgroundColor: string;
  };
  bg_warning: {
    backgroundColor: string;
  };
  bg_error: {
    backgroundColor: string;
  };
  bg_info: {
    backgroundColor: string;
  };
  /** Destructive button surface. Uses the negative ramp, not the accent. */
  /**
   * The accent as a *button fill*, paired with `text_on_accent`.
   *
   * Distinct from the raw palette primary, because a fill and text need
   * different steps of the same ramp to reach 4.5:1.
   */
  bg_accent: {
    backgroundColor: string;
  };
  /** Destructive button surface. Uses the negative ramp, not the accent. */
  bg_destructive: {
    backgroundColor: string;
  };
  /**
   * Status text intended to sit on `bg_success` / `bg_error`.
   *
   * A tinted surface sits closer to the text colour than the canvas does, so
   * the on-canvas status step falls below 4.5:1 on it. Verified by
   * `scripts/verify-tokens.ts`.
   */
  text_success_strong: {
    color: string;
  };
  text_error_strong: {
    color: string;
  };
  text_warning_strong: {
    color: string;
  };
  text_info_strong: {
    color: string;
  };
  /**
   * Label colour for a filled accent or destructive button.
   *
   * Light on the light-mode fills, dark on the dark-mode accent fill, because
   * the fill flips direction with the theme.
   */
  text_on_accent: {
    color: string;
  };
  /**
   * Label colour for a *text* status.
   *
   * The authored pair from the palette, which is a different step again from
   * the on-surface variant.
   */
  text_status: {
    color: string;
  };
  border_success: {
    borderColor: string;
  };
  border_warning: {
    borderColor: string;
  };
  border_error: {
    borderColor: string;
  };
  border_info: {
    borderColor: string;
  };
  bg: {
    backgroundColor: string;
  };
  /** Pure white card surface — the one deliberate step above the cream canvas. */
  bg_card: {
    backgroundColor: string;
  };
  /** IDE-pane background inside mockups. */
  bg_pane: {
    backgroundColor: string;
  };
  bg_contrast_25: {
    backgroundColor: string;
  };
  bg_contrast_50: {
    backgroundColor: string;
  };
  bg_contrast_100: {
    backgroundColor: string;
  };
  bg_contrast_200: {
    backgroundColor: string;
  };
  bg_contrast_300: {
    backgroundColor: string;
  };
  bg_contrast_400: {
    backgroundColor: string;
  };
  bg_contrast_500: {
    backgroundColor: string;
  };
  bg_contrast_600: {
    backgroundColor: string;
  };
  bg_contrast_700: {
    backgroundColor: string;
  };
  bg_contrast_800: {
    backgroundColor: string;
  };
  bg_contrast_900: {
    backgroundColor: string;
  };
  bg_contrast_950: {
    backgroundColor: string;
  };
  bg_contrast_975: {
    backgroundColor: string;
  };
  border_contrast_low: {
    borderColor: string;
  };
  border_contrast_medium: {
    borderColor: string;
  };
  border_contrast_high: {
    borderColor: string;
  };
  shadow_xs: ViewStyle;
  shadow_sm: ViewStyle;
  shadow_md: ViewStyle;
  shadow_lg: ViewStyle;
  shadow_xl: ViewStyle;
};

/**
 * Categorical representation of the theme
 */
export type ThemeScheme = 'light' | 'dark';

/**
 * Specific theme name, including low-contrast variants
 */
export type ThemeName = 'light' | 'dark' | 'dim';

/**
 * A theme object, containing the color palette and atoms for the theme
 */
export type Theme = {
  scheme: ThemeScheme;
  name: ThemeName;
  palette: Palette;
  atoms: ThemeAtoms;
};

export function createTheme({
  scheme,
  name,
  palette,
  options = {},
}: {
  scheme: ThemeScheme;
  name: ThemeName;
  palette: Palette;
  options?: {
    shadowOpacity?: number;
  };
}): Theme {
  const shadowOpacity = options.shadowOpacity ?? 0.1;
  const shadowColor = alpha(palette.black, shadowOpacity);
  return {
    scheme,
    name,
    palette,
    atoms: {
      text: {
        color: palette.contrast_1000,
      },
      text_link: {
        /*
         * A link is text, so it needs 4.5:1 — but the accent at 500 is only
         * 3.28:1 on the cream canvas.
         *
         * Note the ramp direction. `invertPalette` maps a *low* index to a
         * *deeper* colour, so in the dark palette `primary_600` is the light
         * orange and `primary_400` is the dark one. Both themes therefore use
         * index 600-700, and they land on opposite ends of the ramp purely
         * because the theme did.
         */
        color: scheme === 'dark' ? palette.primary_600 : palette.primary_700,
      },
      text_contrast_low: {
        // contrast_400 measured 2.55:1 on the cream canvas. Captions and
        // section labels are not body text, so 3:1 is the floor that applies
        // (WCAG 1.4.3) — and a caption nobody can read is not a caption.
        color: palette.contrast_500,
      },
      text_contrast_medium: {
        color: palette.contrast_700,
      },
      text_contrast_high: {
        color: palette.contrast_900,
      },
      text_inverted: {
        color: palette.contrast_0,
      },
      text_success: {
        color: palette.semantic_success,
      },
      text_error: {
        color: palette.semantic_error,
      },
      bg_success: { backgroundColor: palette.bg_success },
      bg_warning: { backgroundColor: palette.bg_warning },
      bg_error: { backgroundColor: palette.bg_error },
      bg_info: { backgroundColor: palette.bg_info },
      border_success: { borderColor: palette.border_success },
      border_warning: { borderColor: palette.border_warning },
      border_error: { borderColor: palette.border_error },
      border_info: { borderColor: palette.border_info },
      bg_destructive: {
        // One step deeper than the raw negative_500: white on 500 measured
        // 4.40:1, and a destructive button is exactly where a near-miss hurts.
        backgroundColor: palette.negative_600,
      },
      text_status: {
        color: palette.semantic_error,
      },
      text_success_strong: { color: palette.semantic_success_strong },
      text_error_strong: { color: palette.semantic_error_strong },
      text_warning_strong: { color: palette.semantic_warning_strong },
      text_info_strong: { color: palette.semantic_info_strong },
      text_on_accent: {
        /*
         * The fill flips direction with the theme — a deep orange in light mode,
         * a pale one in dark mode — so the label flips with it: white on the
         * deep fill, ink on the pale one. `contrast_0` is the ink step in the
         * dark palette; `contrast_1000` there is the light one.
         */
        color: scheme === 'dark' ? palette.contrast_0 : palette.white,
      },
      bg: {
        backgroundColor: palette.contrast_0,
      },
      /**
       * The accent as a *button fill*.
       *
       * primary_500 with light text is 3.28:1 and fails AA, which is why the
       * app's primary action was previously unusable by anyone with low vision.
       * One step down in light mode reaches 4.71:1; in dark mode the fill goes
       * lighter and the label goes dark, for the same contrast.
       */
      bg_accent: {
        // Both themes use index 600: #D04200 under white in light mode, and
        // #F9692B under ink in dark mode. See the note on `text_link` for why
        // the same index means opposite lightness in each theme.
        backgroundColor: palette.primary_600,
      },
      /*
       * Card and pane move *away from the canvas in both themes*: lighter in
       * light, darker in dark. The previous dark values picked contrast_900 /
       * contrast_950, which invert to near-white — a pale card in a dark theme,
       * with the light-theme body text on it. That measured 1.18:1.
       */
      bg_card: {
        backgroundColor: scheme === 'dark' ? palette.contrast_100 : palette.white,
      },
      bg_pane: {
        backgroundColor: scheme === 'dark' ? palette.contrast_200 : palette.contrast_50,
      },
      bg_contrast_25: {
        backgroundColor: palette.contrast_25,
      },
      bg_contrast_50: {
        backgroundColor: palette.contrast_50,
      },
      bg_contrast_100: {
        backgroundColor: palette.contrast_100,
      },
      bg_contrast_200: {
        backgroundColor: palette.contrast_200,
      },
      bg_contrast_300: {
        backgroundColor: palette.contrast_300,
      },
      bg_contrast_400: {
        backgroundColor: palette.contrast_400,
      },
      bg_contrast_500: {
        backgroundColor: palette.contrast_500,
      },
      bg_contrast_600: {
        backgroundColor: palette.contrast_600,
      },
      bg_contrast_700: {
        backgroundColor: palette.contrast_700,
      },
      bg_contrast_800: {
        backgroundColor: palette.contrast_800,
      },
      bg_contrast_900: {
        backgroundColor: palette.contrast_900,
      },
      bg_contrast_950: {
        backgroundColor: palette.contrast_950,
      },
      bg_contrast_975: {
        backgroundColor: palette.contrast_975,
      },
      border_contrast_low: {
        borderColor: palette.contrast_100,
      },
      border_contrast_medium: {
        borderColor: palette.contrast_200,
      },
      border_contrast_high: {
        borderColor: palette.contrast_300,
      },
      shadow_xs: {
        ...atoms.shadow_xs,
        shadowColor: palette.black,
        boxShadow: `0 2px 8px 0 ${shadowColor}`,
      },
      shadow_sm: {
        ...atoms.shadow_sm,
        shadowColor: palette.black,
        boxShadow: `0 4px 6px -1px ${shadowColor}, 0 2px 4px -2px ${shadowColor}`,
      },
      shadow_md: {
        ...atoms.shadow_md,
        shadowColor: palette.black,
        boxShadow: `0 10px 15px -3px ${shadowColor}, 0 4px 6px -4px ${shadowColor}`,
      },
      shadow_lg: {
        ...atoms.shadow_lg,
        shadowColor: palette.black,
        boxShadow: `0 20px 25px -5px ${shadowColor}, 0 8px 10px -6px ${shadowColor}`,
      },
      shadow_xl: {
        ...atoms.shadow_xl,
        shadowColor: palette.black,
        boxShadow: `0 10px 40px 0 ${shadowColor}`,
      },
    },
  };
}

export function createThemes({
  defaultPalette,
  subduedPalette,
}: {
  defaultPalette: Palette;
  subduedPalette: Palette;
}): {
  light: Theme;
  dark: Theme;
  dim: Theme;
} {
  const light = createTheme({
    scheme: 'light',
    name: 'light',
    palette: defaultPalette,
  });
  const dark = createTheme({
    scheme: 'dark',
    name: 'dark',
    palette: invertPalette(defaultPalette),
    options: {
      shadowOpacity: 0.4,
    },
  });
  const dim = createTheme({
    scheme: 'dark',
    name: 'dim',
    palette: invertPalette(subduedPalette),
    options: {
      shadowOpacity: 0.4,
    },
  });

  return {
    light,
    dark,
    dim,
  };
}
