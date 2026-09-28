import { createContext, useContext, useState, type ReactNode } from 'react';

export type ColorMode = 'system' | 'light' | 'dark';
export type DarkTheme = 'dim' | 'dark';

type ThemePrefs = {
  colorMode: ColorMode;
  darkTheme: DarkTheme;
};

type SetThemePrefs = {
  setColorMode: (mode: ColorMode) => void;
  setDarkTheme: (theme: DarkTheme) => void;
};

const ThemePrefsContext = createContext<ThemePrefs>({
  colorMode: 'system',
  darkTheme: 'dim',
});

const SetThemePrefsContext = createContext<SetThemePrefs>({
  setColorMode: () => {},
  setDarkTheme: () => {},
});

export function Provider({ children }: { children: ReactNode }) {
  const [colorMode, setColorMode] = useState<ColorMode>('system');
  const [darkTheme, setDarkTheme] = useState<DarkTheme>('dim');

  return (
    <ThemePrefsContext.Provider value={{ colorMode, darkTheme }}>
      <SetThemePrefsContext.Provider value={{ setColorMode, setDarkTheme }}>
        {children}
      </SetThemePrefsContext.Provider>
    </ThemePrefsContext.Provider>
  );
}

export function useThemePrefs() {
  return useContext(ThemePrefsContext);
}

export function useSetThemePrefs() {
  return useContext(SetThemePrefsContext);
}
