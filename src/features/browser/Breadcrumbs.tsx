import { ScrollView, Text, View } from 'react-native';

import { atoms, useTheme } from '@/flux';
import { type Breadcrumb } from '#/domain/usecases/folder';

/**
 * The path bar (plan.md §5).
 *
 * A horizontally scrolling list of ancestors rather than a truncated joined
 * string. `/storage/emulated/0/Documents/Contracts/2026` joined and ellipsised
 * from the end hides the leaf, which is the part the user is looking at;
 * a scrollable list keeps every level reachable and scrolls to the end.
 *
 * Each crumb is a button, so any ancestor is one tap away without the browser
 * having to pop its way back through the stack.
 */
export function Breadcrumbs({
  crumbs,
  onPressCrumb,
  testID = 'breadcrumbs',
}: {
  crumbs: readonly Breadcrumb[];
  onPressCrumb: (crumb: Breadcrumb) => void;
  testID?: string;
}) {
  const t = useTheme();

  if (crumbs.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Starts scrolled to the end so the current folder is visible without the
      // user having to swipe left on every navigation.
      contentContainerStyle={atoms.px_md}
      testID={testID}
    >
      <View style={[atoms.flex_row, atoms.align_center]}>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <View key={crumb.uri} style={[atoms.flex_row, atoms.align_center]}>
              {index > 0 ? (
                <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.separator]}>›</Text>
              ) : null}

              <Crumb
                crumb={crumb}
                isLast={isLast}
                onPress={() => onPressCrumb(crumb)}
                testID={`${testID}.${index}`}
              />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Crumb({
  crumb,
  isLast,
  onPress,
  testID,
}: {
  crumb: Breadcrumb;
  isLast: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <Text
      onPress={onPress}
      // The crumb is a real control, so it needs a real touch target; a 9px
      // glyph has almost none (plan.md §40).
      suppressHighlighting
      numberOfLines={1}
      accessibilityRole="button"
      accessibilityLabel={isLast ? `${crumb.label}, current folder` : `Go to ${crumb.label}`}
      testID={testID}
      style={[
        atoms.text_sm,
        isLast ? atoms.font_medium : atoms.font_normal,
        isLast ? t.atoms.text : t.atoms.text_contrast_medium,
        styles.crumb,
      ]}
    >
      {crumb.label}
    </Text>
  );
}

const styles = {
  crumb: {
    // Vertical padding gives the touch target; horizontal keeps crumbs tight.
    paddingVertical: 10,
    paddingHorizontal: 2,
    maxWidth: 180,
  },
  separator: {
    paddingHorizontal: 6,
  },
} as const;
