import './style';

import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider, useTheme } from '@/flux';
import { setSystemUITheme } from '@/flux/util/systemUI';
import { useColorModeTheme } from '@/flux/util/useColorModeTheme';
import { RoutesContainer } from '@/Navigation';
import { RootNavigator } from '@/RootNavigator';
import { OperationsProvider } from '@/features/operations/OperationsProvider';
import { TrashRetentionSweep } from '@/features/trash/TrashRetentionSweep';
import { Provider as ThemePrefsProvider } from '@/state/shell';
import { Splash } from '@/Splash';

void SplashScreen.preventAutoHideAsync();

/**
 * Keeps Android status/nav bar backgrounds in sync with the active theme
 * (web/iOS are no-ops inside `setSystemUITheme`).
 */
function SystemUIBackground() {
  const t = useTheme();

  useEffect(() => {
    setSystemUITheme('theme', t);
  }, [t]);

  return null;
}

function AppShell() {
  const theme = useColorModeTheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <SystemUIBackground />
      {/* Nothing rendered, but something that runs: enforces the trash's
          retention window on this launch (plan.md §25). */}
      <TrashRetentionSweep />
      <Splash isReady={isReady}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <RoutesContainer>
            <ErrorBoundary>
              {/*
                The operation queue sits above the navigator on purpose: a copy
                must survive navigating away from the browser, and inside the
                navigator a screen unmount would take the transfer with it
                (plan.md §22, §48).
              */}
              <OperationsProvider>
                <RootNavigator />
              </OperationsProvider>
            </ErrorBoundary>
          </RoutesContainer>
        </GestureHandlerRootView>
      </Splash>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemePrefsProvider>
        <AppShell />
      </ThemePrefsProvider>
    </SafeAreaProvider>
  );
}
