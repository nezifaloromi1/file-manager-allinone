import { Pressable, Text, View } from 'react-native';

import { atoms, useTheme } from '@/flux';

/**
 * A quick action on Home (plan.md §4).
 *
 * design.md caps a screen at roughly two prominent actions and forbids shadows
 * and large radii on interactive elements, so these are flat, 4px, and sized to
 * a comfortable 64px target rather than styled to shout.
 */
export function QuickAction({
  label,
  icon,
  onPress,
  testID,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        atoms.flex_1,
        atoms.align_center,
        atoms.justify_center,
        atoms.p_sm,
        atoms.gap_2xs,
        atoms.rounded_lg,
        t.atoms.bg_card,
        t.atoms.border_contrast_low,
        atoms.border,
        pressed && t.atoms.bg_contrast_50,
      ]}
    >
      <View style={atoms.align_center}>{icon}</View>
      <Text style={[atoms.text_2xs, atoms.font_medium, t.atoms.text]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
