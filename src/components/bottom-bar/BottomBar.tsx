import { type GestureResponderEvent, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { ReactNode } from 'react';

import { atoms, useTheme } from '@/flux';
import { getCurrentRoute } from '@/lib/routes/helpers';
import { TABS, type TabIcon, type TabName } from '@/lib/tabs';
import type { RootStackParamList } from '#/lib/routes/types';
import {
  HomeOpen_Stroke2_Corner0_Rounded,
  HomeOpen_Filled_Corner0_Rounded,
} from '@/components/icons/HomeOpen';
import {
  RecentGlyph,
  SettingsGlyph,
  StarGlyph,
  StorageGlyph,
} from '@/components/icons/ChromeGlyphs';
import { styles } from './BottomBarStyles';

/**
 * The tab bar (plan.md §3).
 *
 * The custom bar from the starter is kept rather than swapping in
 * `@react-navigation/bottom-tabs`, so this change adds no dependency and leaves
 * the navigator tree a plain `native-stack` per tab.
 *
 * The tab list comes from `#/lib/tabs`, shared with the navigator. When the two
 * were declared separately it was possible to register a screen with no bar item
 * (an unreachable destination) or show a bar item with no screen (a dead tap),
 * and neither shows up until the app is run.
 */

type TabButtonProps = {
  tab: { name: TabName; label: string };
  active: boolean;
  icon: ReactNode;
  onPress: (event: GestureResponderEvent) => void;
};

function TabButton({ tab, active, icon, onPress }: TabButtonProps) {
  return (
    <Pressable
      style={[styles.ctrl, atoms.flex_1]}
      onPress={onPress}
      accessible
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      // No hint: the label already names the destination, and a hint on a tab
      // only adds noise a screen reader user must dismiss five times per screen
      // (plan.md §40).
      hitSlop={8}
      testID={`bottomBar.${tab.name}Btn`}
    >
      {icon}
    </Pressable>
  );
}

export function BottomBar() {
  const t = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const safeAreaInsets = useSafeAreaInsets();
  const currentRoute = getCurrentRoute(navigation.getState()).name;
  const iconWidth = 24;

  const onPressTab = (name: TabName) => {
    const tab = TABS.find((entry) => entry.name === name);
    if (!tab) return;

    const state = navigation.getState();
    const target = state.routes.find((route) => route.name === tab.root)?.state?.key;

    if (target) {
      // Re-tapping the active tab pops it to the top, so a user who has
      // navigated deep into Settings lands back at Settings rather than
      // appearing stuck.
      navigation.dispatch({ ...StackActions.popToTop(), target });
      return;
    }

    navigation.navigate(tab.root);
  };

  return (
    <View
      style={[
        styles.bottomBar,
        t.atoms.bg,
        t.atoms.border_contrast_low,
        // Clamped so a device with a tall gesture bar does not push the icons
        // off-centre, and one with none does not crowd them against the edge.
        { paddingBottom: Math.min(Math.max(safeAreaInsets.bottom, 15), 60) },
      ]}
      testID="bottomBar"
    >
      {TABS.map((tab) => {
        const active = currentRoute === tab.name || currentRoute === tab.root;
        const color = active ? t.atoms.text.color : t.atoms.text_contrast_low.color;

        return (
          <TabButton
            key={tab.name}
            tab={tab}
            active={active}
            onPress={() => onPressTab(tab.name)}
            icon={renderIcon(tab.icon, active, color, iconWidth)}
          />
        );
      })}
    </View>
  );
}

/**
 * Active tabs get a filled or weighted variant, matching the starter's approach
 * of pairing outline and solid states rather than relying on colour alone
 * (plan.md §40).
 */
function renderIcon(icon: TabIcon, active: boolean, color: string, size: number): ReactNode {
  switch (icon) {
    case 'home':
      return active ? (
        <HomeOpen_Filled_Corner0_Rounded
          width={size + 1}
          height={size + 1}
          color={color}
          style={styles.ctrlIcon}
        />
      ) : (
        <HomeOpen_Stroke2_Corner0_Rounded
          width={size + 1}
          height={size + 1}
          color={color}
          style={styles.ctrlIcon}
        />
      );
    case 'storage':
      return <StorageGlyph size={size} color={color} style={styles.ctrlIcon} />;
    case 'recent':
      return <RecentGlyph size={size} color={color} style={styles.ctrlIcon} />;
    case 'favorites':
      // Filled when active, so the state is legible without relying on the
      // accent colour.
      return <StarGlyph size={size} color={color} filled={active} style={styles.ctrlIcon} />;
    case 'settings':
      return <SettingsGlyph size={size} color={color} style={styles.ctrlIcon} />;
  }
}
