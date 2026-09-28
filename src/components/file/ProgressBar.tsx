import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { atoms, tokens, useTheme } from '#/flux';
import { useReducedMotion } from '#/flux/util/useReducedMotion';
import { type OperationProgress, formatProgressLabel } from '#/domain/models/operation';

/**
 * Operation progress (plan.md §22, §48).
 *
 * `2.1 GB / 3.2 GB` over a bar, with the percentage spelled out. The bar is
 * driven by `Animated` with the native driver so a 5 GB copy animates smoothly
 * on the UI thread while JS is busy streaming bytes — animating it in JS would
 * stutter for the whole duration of the copy.
 *
 * An unknown total renders an indeterminate bar rather than a 0% one: "we don't
 * know yet" and "no progress" are different states and must not look alike.
 */

export function ProgressBar({
  progress,
  label,
  onCancel,
  compact = false,
  testID = 'progressBar',
}: {
  progress: OperationProgress;
  /** Operation title, e.g. `Copying 12 items`. */
  label?: string;
  onCancel?: () => void;
  compact?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const animated = useRef(new Animated.Value(progress.ratio)).current;
  const indeterminate = progress.total === null;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (indeterminate || reduceMotion) return;
    Animated.timing(animated, {
      toValue: progress.ratio,
      // Short enough to track a fast copy, long enough not to jitter on every
      // chunk callback.
      duration: tokens.duration.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animated, indeterminate, progress.ratio, reduceMotion]);

  const percent = Math.round(progress.ratio * 100);

  return (
    <View
      style={[atoms.p_lg, atoms.gap_sm, compact && styles.compact]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        label
          ? `${label}. ${indeterminate ? 'Calculating' : `${percent} percent`}. ${formatProgressLabel(progress)}`
          : formatProgressLabel(progress)
      }
      testID={testID}
    >
      {label ? (
        <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}

      <View style={[styles.track, t.atoms.bg_contrast_100]}>
        {indeterminate ? (
          <IndeterminateFill color={t.palette.primary_500} />
        ) : (
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: t.palette.primary_500,
                // Width cannot be native-driven, so the scale transform stands
                // in: a native transform keeps this off the JS thread.
                transform: [
                  {
                    scaleX: animated.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
      </View>

      <View style={[atoms.flex_row, atoms.align_center, atoms.justify_between]}>
        <Text style={[atoms.text_xs, t.atoms.text_contrast_medium]}>
          {indeterminate ? 'Calculating…' : formatProgressLabel(progress)}
        </Text>
        {onCancel ? (
          <Text
            accessibilityRole="button"
            accessibilityLabel="Cancel operation"
            onPress={onCancel}
            style={[atoms.text_xs, atoms.font_medium, t.atoms.text_link, styles.cancel]}
            testID={`${testID}.cancel`}
          >
            Cancel
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** A travelling bar for work whose total is not yet known. */
function IndeterminateFill({ color }: { color: string }) {
  const slide = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // An indeterminate bar is meaningless without motion, so under reduce motion
    // it is not started at all. The percentage is rendered alongside it, so no
    // information is lost.
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: tokens.duration.slow,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    animation.start();
    // Stopped on unmount: a looping animation that outlives its component keeps
    // the bridge busy and is a classic source of dropped frames.
    return () => animation.stop();
  }, [reduceMotion, slide]);

  return (
    <Animated.View
      style={[
        styles.indeterminateBar,
        {
          backgroundColor: color,
          transform: [
            {
              translateX: slide.interpolate({
                inputRange: [0, 1],
                outputRange: [-120, 400],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = {
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    width: '100%',
    borderRadius: 3,
    // Scale transforms need a transform origin at the left edge, otherwise the
    // bar shrinks toward its centre.
    transformOrigin: 'left',
  },
  indeterminateBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '28%',
    borderRadius: 3,
  },
  cancel: {
    // Text needs an explicit generous target; `onPress` on `Text` has no
    // intrinsic padding (plan.md §40).
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  compact: {
    paddingVertical: 12,
  },
} as const;
