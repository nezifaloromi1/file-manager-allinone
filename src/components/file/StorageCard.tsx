import { Pressable, Text, View } from 'react-native';

import { atoms, useTheme, tokens } from '#/flux';
import { toUsageRatio } from '#/core/utils/format';
import { formatUsageSummary, type StorageUsage } from '#/domain/models/storage';

/**
 * The storage card (plan.md §4, §19, §39).
 *
 * `1.4 GB of 128 GB · 60% used` over a single progress bar. No per-type
 * breakdown here — that needs a full volume walk, which belongs on the analyzer
 * screen, not above a file list (plan.md §29).
 *
 * The bar is never colour-only: the percentage is always spelled out, so the
 * reading survives colour-blindness and greyscale (plan.md §40).
 */

export function StorageCard({
  usage,
  onPress,
  testID = 'storageCard',
}: {
  usage: StorageUsage;
  onPress?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const usedBytes = usage.usedBytes;
  const totalBytes = usage.totalBytes;

  // Free space is a "may be wrong" figure: it moves while the user is reading
  // it, and some devices refuse to report it. Show what is known, not zero.
  const ratio = toUsageRatio(usedBytes ?? 0, totalBytes ?? 0);
  const hasFigures = usedBytes !== null && totalBytes !== null;

  const summary = hasFigures ? formatUsageSummary(usage) : 'Calculating storage usage…';

  const body = (
    <View style={[atoms.p_lg, atoms.gap_sm, styles.body]}>
      <View style={[atoms.flex_row, atoms.align_center, atoms.justify_between]}>
        <Text style={[atoms.text_lg, atoms.font_medium, t.atoms.text]} numberOfLines={1}>
          {usage.volume.label}
        </Text>
        {hasFigures ? (
          <Text style={[atoms.text_xs, t.atoms.text_contrast_medium]}>
            {usage.volume.isRemovable ? 'Removable' : 'On device'}
          </Text>
        ) : null}
      </View>

      <View
        style={[styles.track, t.atoms.bg_contrast_100]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${usage.volume.label} storage`}
        accessibilityValue={
          hasFigures ? { now: Math.round(ratio * 100), min: 0, max: 100 } : { text: 'unknown' }
        }
      >
        {hasFigures ? (
          <View
            style={[
              styles.fill,
              { width: `${Math.round(ratio * 100)}%`, backgroundColor: t.palette.primary_500 },
            ]}
          />
        ) : (
          // An indeterminate bar, not a fake zero-width one: a 0% fill would
          // read as "empty drive", which is worse than admitting ignorance.
          <View style={[styles.fill, styles.indeterminate, t.atoms.bg_contrast_300]} />
        )}
      </View>

      <Text style={[atoms.text_xs, t.atoms.text_contrast_medium]}>{summary}</Text>
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={[atoms.rounded_lg, t.atoms.bg_card]}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${usage.volume.label}. ${summary}`}
      accessibilityHint="Opens storage details"
      testID={testID}
      style={({ pressed }) => [
        atoms.rounded_lg,
        t.atoms.bg_card,
        pressed && t.atoms.bg_contrast_50,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = {
  body: {
    minHeight: tokens.touchTarget.comfortable,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  indeterminate: {
    width: '35%',
  },
} as const;
