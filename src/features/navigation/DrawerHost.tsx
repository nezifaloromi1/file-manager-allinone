import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import { useTheme } from '#/flux';
import { navigate } from '#/Navigation';
import { TABS } from '#/lib/tabs';
import { type NavigationProp } from '#/lib/routes/types';
import { SideDrawer, type DrawerDestination } from '@/components/layout/SideDrawer';
import {
  InfoGlyph,
  RecentGlyph,
  SettingsGlyph,
  StarGlyph,
  StorageGlyph,
  TrashGlyph,
} from '@/components/icons/ChromeGlyphs';
import { HomeOpen_Stroke2_Corner0_Rounded } from '@/components/icons/HomeOpen';
import { MagnifyingGlass_Stroke2_Corner0_Rounded } from '@/components/icons/MagnifyingGlass';

/**
 * Drawer state and contents, in one place.
 *
 * Mounted once per tab by the navigator, so a destination added here appears on
 * all five tabs and the current one is highlighted — without any screen knowing
 * a drawer exists.
 *
 * The state lives in a context rather than in each screen because the host
 * renders the panel while the screen renders the *button* that opens it. Two
 * components, one piece of state, and no prop threading between them.
 */

type DrawerContextValue = {
  destinations: DrawerDestination[];
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

/** The tab glyphs, so the drawer matches the bottom bar instead of inventing its own. */
const TAB_ICONS: Record<string, (color: string) => ReactNode> = {
  home: (color) => <HomeOpen_Stroke2_Corner0_Rounded size={20} color={color} />,
  storage: (color) => <StorageGlyph size={20} color={color} />,
  recent: (color) => <RecentGlyph size={20} color={color} />,
  favorites: (color) => <StarGlyph size={20} color={color} />,
  settings: (color) => <SettingsGlyph size={20} color={color} />,
};

type Shortcut = {
  id: string;
  label: string;
  icon: (color: string) => ReactNode;
  /** Route params, for destinations that require an argument. */
  params?: Record<string, never>;
};

/** Extra destinations, resolved from whichever tab the user is on. */
const SHORTCUTS: Shortcut[] = [
  {
    id: 'Search',
    label: 'Search',
    icon: (color) => <MagnifyingGlass_Stroke2_Corner0_Rounded size={20} color={color} />,
    params: {},
  },
  {
    id: 'Trash',
    label: 'Trash',
    icon: (color) => <TrashGlyph size={20} color={color} />,
    params: {},
  },
  {
    id: 'StorageAnalyzer',
    label: 'Storage analyzer',
    icon: (color) => <StorageGlyph size={20} color={color} />,
    params: {},
  },
  { id: 'About', label: 'About', icon: (color) => <InfoGlyph size={20} color={color} /> },
];

export function DrawerHost({ activeTab, children }: { activeTab?: string; children?: ReactNode }) {
  const t = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const destinations = useMemo<DrawerDestination[]>(() => {
    const color = t.atoms.text.color;

    const tabs: DrawerDestination[] = TABS.map((tab) => ({
      id: tab.root,
      label: tab.label,
      tab: tab.root,
      icon: (TAB_ICONS[tab.icon] ?? TAB_ICONS.home)(color),
      onPress: () => {
        void navigate(tab.root);
      },
      testID: `drawer.${tab.root}`,
    }));

    const shortcuts: DrawerDestination[] = SHORTCUTS.map((shortcut) => ({
      id: shortcut.id,
      label: shortcut.label,
      icon: shortcut.icon(color),
      onPress: () => {
        // `Search`, `Trash`, and `StorageAnalyzer` are registered on every tab,
        // so they resolve from wherever the user is. `About` takes no params.
        if (shortcut.params) {
          navigation.navigate(shortcut.id as 'Search', shortcut.params as { query?: string });
        } else {
          navigation.navigate(shortcut.id as 'About');
        }
      },
      testID: `drawer.${shortcut.id}`,
    }));

    return [...tabs, ...shortcuts];
  }, [navigation, t.atoms.text.color]);

  const value = useMemo<DrawerContextValue>(
    () => ({ destinations, open, close, isOpen }),
    [close, destinations, isOpen, open],
  );

  return (
    <DrawerContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <SideDrawer
          visible={isOpen}
          onClose={close}
          activeTab={activeTab}
          destinations={destinations}
        />
      </View>
    </DrawerContext.Provider>
  );
}

/**
 * The drawer controls for the current tab root.
 *
 * Throws outside a `DrawerHost` rather than returning a no-op: a tab root that
 * silently does nothing when its menu is tapped is a bug that would ship.
 */
export function useDrawer(): DrawerContextValue {
  const value = useContext(DrawerContext);
  if (!value) {
    throw new Error('useDrawer must be used inside a DrawerHost.');
  }
  return value;
}
