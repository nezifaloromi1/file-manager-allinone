import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/flux';

type ScreenProps = PropsWithChildren<{
  /** Extra style applied inside the safe-area padding. */
  style?: ViewStyle;
}>;

/**
 * App-shell container that respects notches and home indicators on
 * iOS/Android, so screen content never renders under system UI.
 */
export function Screen({ children, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const t = useTheme();

  return (
    <View
      style={[
        styles.root,
        t.atoms.bg,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
