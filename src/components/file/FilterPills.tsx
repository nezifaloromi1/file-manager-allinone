import { Pressable, Text } from 'react-native';

import { atoms, useTheme } from '#/flux';

/**
 * A selectable pill (plan.md §18).
 *
 * Split out of `SortFilterSheet` so the search screen's category chips are the
 * same control the filter sheet uses. Two hand-rolled look-alikes is how a
 * selected state starts meaning two different things.
 */
export function Pill({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      testID={testID}
      style={({ pressed }) => [
        atoms.px_md,
        atoms.py_sm,
        atoms.rounded_xs,
        atoms.align_center,
        styles.pill,
        // The selected pill is filled, not merely tinted — a tint alone is a
        // weak signal at a glance and worse for low vision (plan.md §40).
        selected ? t.atoms.bg_accent : t.atoms.bg_contrast_50,
        !selected && t.atoms.border_contrast_low,
        !selected && atoms.border,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          atoms.text_sm,
          selected ? atoms.font_medium : atoms.font_normal,
          selected ? t.atoms.text_on_accent : t.atoms.text,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = {
  pill: {
    minHeight: 36,
  },
  pressed: {
    opacity: 0.75,
  },
} as const;
