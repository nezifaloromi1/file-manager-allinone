import { useLayoutEffect } from 'react';
import { type ColorSchemeName, useColorScheme } from 'react-native';
import { type ThemeName } from '#/flux/base';

import { dark, dim, light } from '#/flux/themes';
import { IS_WEB } from '#/env';

export function useColorModeTheme(): ThemeName {
  const theme = useThemeName();

  useLayoutEffect(() => {
    updateDocument(theme);
  }, [theme]);

  return theme;
}

export function useThemeName(): ThemeName {
  const colorScheme: ColorSchemeName = useColorScheme();

  return colorScheme === 'dark' ? 'dim' : 'light';
}

function updateDocument(theme: ThemeName) {
  // @ts-ignore web only
  if (IS_WEB && typeof window !== 'undefined') {
    // @ts-ignore web only
    const html = window.document.documentElement;
    // @ts-ignore web only
    const meta = window.document.querySelector('meta[name="theme-color"]');

    // remove any other color mode classes
    html.className = html.className.replace(/(theme)--\w+/g, '');
    html.classList.add(`theme--${theme}`);
    // set color to 'theme-color' meta tag
    meta?.setAttribute('content', getBackgroundColor(theme));
    window.localStorage.setItem('FLUX_THEME', theme);
  }
}

export function getBackgroundColor(theme: ThemeName): string {
  switch (theme) {
    case 'light':
      return light.atoms.bg.backgroundColor;
    case 'dark':
      return dark.atoms.bg.backgroundColor;
    case 'dim':
      return dim.atoms.bg.backgroundColor;
  }
}
