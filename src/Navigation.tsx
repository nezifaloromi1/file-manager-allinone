import { useRef } from 'react';
import {
  CommonActions,
  createNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
  type LinkingOptions,
  NavigationContainer,
} from '@react-navigation/native';

import { timeout } from '#/lib/async/timeout';
import { useColorSchemeStyle } from '#/lib/hooks/useColorSchemeStyle';
import { useCallOnce } from '#/lib/once';
import { buildStateObject, getCurrentRoute } from '#/lib/routes/helpers';
import { type AllNavigatorParams, type RouteParams, type State } from '#/lib/routes/types';
import { type TabRoot } from '#/lib/tabs';
import { logger } from '#/logger';
import { router } from '#/routes';

const navigationRef = createNavigationContainerRef<AllNavigatorParams>();

/**
 * Which tab a deep-linked screen should be opened from.
 *
 * A screen that is not itself a tab needs a host, otherwise React Navigation
 * cannot build a state for it and the link resolves to nothing. Browser-like
 * screens open from Storage, since that is where browsing is rooted.
 */
const TAB_FOR_SCREEN: Record<string, TabRoot> = {
  Browser: 'StorageTab',
  FileDetails: 'StorageTab',
  OpenWith: 'StorageTab',
  Search: 'StorageTab',
  Operations: 'StorageTab',
  StorageAccess: 'SettingsTab',
  StorageAnalyzer: 'StorageTab',
  Trash: 'SettingsTab',
  AppearanceSettings: 'SettingsTab',
  FileSettings: 'SettingsTab',
  PrivacySettings: 'SettingsTab',
  About: 'SettingsTab',
  NotFound: 'HomeTab',
};

const LINKING: LinkingOptions<AllNavigatorParams> = {
  prefixes: ['filemanager://', 'exp+fscore://'],

  getPathFromState(state) {
    const node = getCurrentRoute(state as State);
    const route = router.matchName(node.name);
    if (typeof route === 'undefined') {
      return '/';
    }
    return route.build((node.params || {}) as RouteParams);
  },

  getStateFromPath(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const [name, params] = router.matchPath(normalizedPath);

    // An unresolvable path lands on Home rather than a dead end. Showing
    // "Not Found" after a link silently fails is worse than landing somewhere
    // real, and the browser is always one tap away.
    if (name === 'NotFound' || (name === 'FluxShowcase' && !__DEV__)) {
      return buildStateObject('HomeTab', 'HomeTab', {});
    }

    if (name === 'FluxShowcase') {
      return buildStateObject('HomeTab', 'FluxShowcase', params, [{ name: 'HomeTab', params: {} }]);
    }

    const tab = TAB_FOR_SCREEN[name] ?? (name as TabRoot | undefined);
    if (tab && name === tab) {
      return buildStateObject(tab, tab, params);
    }
    if (tab) {
      return buildStateObject(tab, name, params, [{ name: tab, params: {} }]);
    }

    return buildStateObject('HomeTab', 'HomeTab', {});
  },
};

export function RoutesContainer({ children }: { children: React.ReactNode }) {
  const previousScreen = useRef<string | undefined>(undefined);
  const theme = useColorSchemeStyle(DefaultTheme, DarkTheme);

  const onNavigationReady = useCallOnce(() => {
    const currentScreen = getCurrentRouteName();
    previousScreen.current = currentScreen;
    logger.debug('navigation:ready', { currentScreen });
  });

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={LINKING}
      theme={theme}
      onStateChange={() => {
        const currentScreen = getCurrentRouteName();
        logger.debug('navigation:change', {
          from: previousScreen.current,
          to: currentScreen,
        });
        previousScreen.current = currentScreen;
      }}
      onReady={onNavigationReady}
      navigationInChildEnabled
    >
      {children}
    </NavigationContainer>
  );
}

function getCurrentRouteName() {
  if (navigationRef.isReady()) {
    return navigationRef.getCurrentRoute()?.name;
  }
  return undefined;
}

export function navigate<K extends keyof AllNavigatorParams>(
  name: K,
  params?: AllNavigatorParams[K],
) {
  if (navigationRef.isReady()) {
    return Promise.race([
      new Promise<void>((resolve) => {
        const handler = () => {
          resolve();
          navigationRef.removeListener('state', handler);
        };
        navigationRef.addListener('state', handler);

        // @ts-ignore I don't know what would make typescript happy but I have a life -prf
        navigationRef.navigate(name, params);
      }),
      timeout(1e3),
    ]);
  }
  return Promise.resolve();
}

export function reset(): Promise<void> {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'HomeTab' }],
      }),
    );
    return Promise.race([
      timeout(1e3),
      new Promise<void>((resolve) => {
        const handler = () => {
          resolve();
          navigationRef.removeListener('state', handler);
        };
        navigationRef.addListener('state', handler);
      }),
    ]);
  }
  return Promise.resolve();
}
