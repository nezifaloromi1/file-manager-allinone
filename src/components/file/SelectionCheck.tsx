import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { atoms, tokens, useTheme } from '#/flux';
import { useReducedMotion } from '#/flux/util/useReducedMotion';

/**
 * The selection checkbox (plan.md §7, §39).
 *
 * Animated with the native driver so the check does not re-run a JS animation
 * on every tap — selection is the most frequent interaction in the browser, and
 * a JS-driven animation there is a measurable frame drop on a long list.
 */

export function SelectionCheck({ selected, size = 22 }: { selected: boolean; size?: number }) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    // Skipped entirely under reduce motion rather than shortened: a checkbox
    // that still springs has not honoured the setting.
    if (reduceMotion) {
      progress.setValue(selected ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: tokens.duration.quick,
      // One easing for every state change in the app.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, reduceMotion, selected]);

  return (
    <Animated.View
      style={[
        atoms.align_center,
        atoms.justify_center,
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: selected ? t.palette.primary_500 : 'transparent',
          borderColor: selected ? t.palette.primary_500 : t.atoms.border_contrast_high.borderColor,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.8, 1.15, 1],
              }),
            },
          ],
        },
      ]}
      // The row's label already conveys selection state, so the box itself is
      // decorative (plan.md §40).
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={{ opacity: progress }}>
        <CheckMark color={t.palette.white} size={size} />
      </Animated.View>
    </Animated.View>
  );
}

function CheckMark({ color, size }: { color: string; size: number }) {
  // Heavier stroke than the type glyphs, so the check stays unambiguous at
  // 14px against a filled circle.
  const strokeWidth = Math.max(2, size * 0.24);
  return (
    <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
      <Path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = {
  box: {
    borderWidth: 1.5,
  },
} as const;
