import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { type Theme, type ThemeName, utils as baseUtils } from '#/flux/base';

import {
  computeFontScaleMultiplier,
  getFontFamily,
  getFontScale,
  setFontFamily as persistFontFamily,
  setFontScale as persistFontScale,
} from '#/flux/fonts';
import { themes } from '#/flux/themes';
import { contrastRatio, darken, lighten, rgbToHex } from '#/flux/util/colorGeneration';
import { type Device } from '#/storage';

export { type TextStyleProp, type Theme, type ThemeName, type ViewStyleProp } from '#/flux/base';
export { atoms } from '#/flux/atoms';
export * from '#/flux/breakpoints';
export * from '#/flux/fonts';
export * as tokens from '#/flux/tokens';
export * from '#/flux/util/flatten';
export * from '#/flux/util/platform';
export * from '#/flux/util/themeSelector';
export * from '#/flux/util/useGutters';
export * from '#/flux/util/useReducedMotion';
export const utils = {
  ...baseUtils,
  rgbToHex,
  lighten,
  darken,
  contrastRatio,
};

export type Flux = {
  themeName: ThemeName;
  theme: Theme;
  themes: typeof themes;
  fonts: {
    scale: Exclude<Device['fontScale'], undefined>;
    scaleMultiplier: number;
    family: Device['fontFamily'];
    setFontScale: (fontScale: Exclude<Device['fontScale'], undefined>) => void;
    setFontFamily: (fontFamily: Device['fontFamily']) => void;
  };
  /**
   * Feature flags or other gated options
   */
  flags: Record<string, never>;
};

/*
 * Context
 */
export const Context = createContext<Flux>({
  themeName: 'light',
  theme: themes.light,
  themes,
  fonts: {
    scale: getFontScale(),
    scaleMultiplier: computeFontScaleMultiplier(getFontScale()),
    family: getFontFamily(),
    setFontScale: () => {},
    setFontFamily: () => {},
  },
  flags: {},
});
Context.displayName = 'FluxContext';

export function ThemeProvider({
  children,
  theme: themeName,
  themesOverride,
}: React.PropsWithChildren<{
  theme: ThemeName;
  themesOverride?: Partial<typeof themes>;
}>) {
  const [fontScale, setFontScale] = useState<Flux['fonts']['scale']>(() => getFontScale());
  const [fontScaleMultiplier, setFontScaleMultiplier] = useState(() =>
    computeFontScaleMultiplier(fontScale),
  );
  const setFontScaleAndPersist = useCallback<Flux['fonts']['setFontScale']>(
    (fs) => {
      setFontScale(fs);
      persistFontScale(fs);
      setFontScaleMultiplier(computeFontScaleMultiplier(fs));
    },
    [setFontScale],
  );
  const [fontFamily, setFontFamily] = useState<Flux['fonts']['family']>(() => getFontFamily());
  const setFontFamilyAndPersist = useCallback<Flux['fonts']['setFontFamily']>(
    (ff) => {
      setFontFamily(ff);
      persistFontFamily(ff);
    },
    [setFontFamily],
  );

  const value = useMemo<Flux>(() => {
    const t = {
      ...themes,
      ...themesOverride,
    };
    return {
      themes: t,
      themeName: themeName,
      theme: t[themeName],
      fonts: {
        scale: fontScale,
        scaleMultiplier: fontScaleMultiplier,
        family: fontFamily,
        setFontScale: setFontScaleAndPersist,
        setFontFamily: setFontFamilyAndPersist,
      },
      flags: {},
    };
  }, [
    themeName,
    fontScale,
    setFontScaleAndPersist,
    fontFamily,
    setFontFamilyAndPersist,
    fontScaleMultiplier,
    themesOverride,
  ]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFlux() {
  return useContext(Context);
}

export function useTheme(theme?: ThemeName) {
  const flux = useFlux();
  return useMemo(() => {
    return theme ? flux.themes[theme] : flux.theme;
  }, [theme, flux]);
}
