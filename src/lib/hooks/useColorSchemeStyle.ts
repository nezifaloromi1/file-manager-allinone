import { useTheme } from '#/flux';

export function useColorSchemeStyle<T>(lightStyle: T, darkStyle: T) {
  const colorScheme = useTheme().name === 'light' ? 'light' : 'dark';
  return colorScheme === 'dark' ? darkStyle : lightStyle;
}
