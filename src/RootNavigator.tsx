import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { atoms, useTheme } from '@/flux';
import { BottomBar } from '@/components/bottom-bar/BottomBar';
import { HomeScreen } from '@/screens/HomeScreen';
import { StorageScreen } from '@/screens/StorageScreen';
import { RecentScreen } from '@/screens/RecentScreen';
import { FavoritesScreen } from '@/screens/FavoritesScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { BrowserScreen } from '@/screens/BrowserScreen';
import { FileDetailsScreen } from '@/screens/FileDetailsScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { StorageAccessScreen } from '@/screens/StorageAccessScreen';
import { StorageAnalyzerScreen } from '@/screens/StorageAnalyzerScreen';
import { TrashScreen } from '@/screens/TrashScreen';
import { OperationsScreen } from '@/screens/OperationsScreen';
import { DestinationPickerScreen } from '@/screens/DestinationPickerScreen';
import { NotFoundScreen } from '@/screens/NotFoundScreen';
import { FluxShowcaseScreen } from '@/screens/FluxShowcaseScreen';
import { TABS, type TabRoot } from '@/lib/tabs';
import { DrawerHost } from '@/features/navigation/DrawerHost';

import type { AllNavigatorParams, RootStackParamList } from '#/lib/routes/types';

/**
 * The navigator (plan.md §3).
 *
 * Five tab roots, each its own `native-stack`, so a tab keeps its own history:
 * backing out of a folder inside Storage returns to Storage's root rather than
 * jumping to Home.
 *
 * The tab list is imported from `#/lib/tabs`, the same source the bottom bar
 * reads, so a tab cannot end up registered with no bar item (an unreachable
 * destination) or shown with no screen (a dead tap).
 */

const Stack = createNativeStackNavigator<RootStackParamList>();
const TabStack = createNativeStackNavigator<AllNavigatorParams>();

/** Tab root name → its screen. */
const TAB_SCREENS: Record<TabRoot, React.ComponentType> = {
  HomeTab: HomeScreen,
  StorageTab: StorageScreen,
  RecentTab: RecentScreen,
  FavoritesTab: FavoritesScreen,
  SettingsTab: SettingsScreen,
};

function screenOptions(t: ReturnType<typeof useTheme>) {
  return {
    fullScreenGestureEnabled: true,
    headerShown: false,
    contentStyle: { backgroundColor: t.atoms.bg.backgroundColor },
  } as const;
}

/**
 * Screens every tab shares.
 *
 * Registered on each tab rather than per-tab, because the browser must be
 * reachable from Home, Storage, Favorites, and Recent alike. Centralised so
 * adding one is a single edit instead of five.
 * This is a **function that is called**, not a component that is rendered — see
 * the note at its call sites.
 */
function sharedScreens() {
  return (
    <>
      <TabStack.Screen name="Browser" component={BrowserScreen} />
      <TabStack.Screen name="FileDetails" component={FileDetailsScreen} />
      <TabStack.Screen name="OpenWith" component={FileDetailsScreen} />
      <TabStack.Screen name="Search" component={SearchScreen} />
      <TabStack.Screen name="Operations" component={OperationsScreen} />
      <TabStack.Screen name="DestinationPicker" component={DestinationPickerScreen} />
      <TabStack.Screen name="StorageAccess" component={StorageAccessScreen} />
      <TabStack.Screen name="StorageAnalyzer" component={StorageAnalyzerScreen} />
      <TabStack.Screen name="Trash" component={TrashScreen} />
      <TabStack.Screen name="AppearanceSettings" component={SettingsScreen} />
      <TabStack.Screen name="FileSettings" component={SettingsScreen} />
      <TabStack.Screen name="PrivacySettings" component={SettingsScreen} />
      <TabStack.Screen name="About" component={NotFoundScreen} />
      <TabStack.Screen name="NotFound" component={NotFoundScreen} />
    </>
  );
}

function FileManagerTab({ root }: { root: TabRoot }) {
  const t = useTheme();
  const Screen = TAB_SCREENS[root];

  return (
    // The drawer host wraps the whole tab stack, so every screen in this tab can
    // open it and the pushed screens inherit it for free.
    <DrawerHost activeTab={root}>
      <TabStack.Navigator initialRouteName={root} screenOptions={screenOptions(t)}>
        <TabStack.Screen name={root} component={Screen} />
        {/*
         * `{sharedScreens()}`, never `<SharedScreens />`.
         *
         * A navigator inspects its direct children and accepts only `Screen`,
         * `Group`, or a Fragment element. `<SharedScreens />` is neither — it is
         * an element whose *type* is a function component that happens to return
         * a Fragment, so React Navigation rejects it with "A navigator can only
         * contain 'Screen', 'Group' or 'React.Fragment' as its direct children".
         * Calling the function puts the Fragment itself directly into the
         * children list, which is accepted. The two forms look equivalent in JSX
         * and are not.
         */}
        {sharedScreens()}
      </TabStack.Navigator>
    </DrawerHost>
  );
}

/**
 * Web entry point.
 *
 * Web has no bottom tab bar, so every tab destination is flattened into a
 * single stack and `Flat` is the root. The tab bar is hidden there.
 */
function FlatNavigator() {
  const t = useTheme();

  return (
    <TabStack.Navigator initialRouteName="HomeTab" screenOptions={screenOptions(t)}>
      {TABS.map((tab) => (
        <TabStack.Screen key={tab.root} name={tab.root} component={TAB_SCREENS[tab.root]} />
      ))}
      {sharedScreens()}
    </TabStack.Navigator>
  );
}

export function RootNavigator() {
  const t = useTheme();

  return (
    <View style={[atoms.flex_1, t.atoms.bg]}>
      <Stack.Navigator initialRouteName="HomeTab" screenOptions={screenOptions(t)}>
        {TABS.map((tab) => (
          <Stack.Screen key={tab.root} name={tab.root}>
            {() => <FileManagerTab root={tab.root} />}
          </Stack.Screen>
        ))}

        <Stack.Screen name="Flat" component={FlatNavigator} />

        {__DEV__ ? (
          <Stack.Screen
            name="FluxShowcase"
            component={FluxShowcaseScreen}
            options={{ title: 'Flux', headerShown: true }}
          />
        ) : null}
      </Stack.Navigator>

      <BottomBar />
    </View>
  );
}
