import { Pressable, Text, View } from 'react-native';

import { atoms, useTheme, tokens } from '#/flux';
import { formatCount } from '#/core/utils/format';

/**
 * The storage-access card (plan.md §11, §39).
 *
 * Plan.md is explicit that access must be *explained before it is requested*,
 * and that the screen states what each grant actually enables. This card is the
 * whole point of the "Hybrid" decision: SAF is privacy-first but cannot rename
 * or move, and All Files Access can. Both are offered side by side with their
 * consequences spelled out rather than hidden behind a single toggle.
 */

export type AccessKind = 'saf' | 'allFiles';

export type AccessState = {
  kind: AccessKind;
  granted: boolean;
  /** Count of individually granted SAF roots. */
  rootCount?: number;
};

export function PermissionCard({
  state,
  onGrant,
  onRevoke,
  onLearnMore,
  testID,
}: {
  state: AccessState;
  onGrant: () => void;
  onRevoke?: () => void;
  onLearnMore?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const isSaf = state.kind === 'saf';

  const title = isSaf ? 'Folder access' : 'Full file access';
  const consequence = isSaf
    ? 'You choose which folders this app can read and write. Browsing, creating, deleting, and sharing all work. Renaming and moving need full file access.'
    : 'This app can read, change, and delete any file on this device. Renaming, moving, and copying work everywhere. Needed for a complete file manager.';

  const statusText = state.granted
    ? isSaf && state.rootCount !== undefined
      ? `${formatCount(state.rootCount, 'folder')} granted`
      : 'Granted'
    : 'Not granted';

  return (
    <View
      style={[
        atoms.p_lg,
        atoms.gap_sm,
        atoms.rounded_lg,
        t.atoms.bg_card,
        t.atoms.border_contrast_low,
        atoms.border,
      ]}
      testID={testID}
    >
      <View style={[atoms.flex_row, atoms.align_center, atoms.justify_between, atoms.gap_sm]}>
        <Text style={[atoms.text_md, atoms.font_medium, t.atoms.text]}>{title}</Text>
        <StatusPill granted={state.granted} label={statusText} />
      </View>

      <Text style={[atoms.text_xs, t.atoms.text_contrast_medium, styles.body]}>{consequence}</Text>

      <View style={[atoms.flex_row, atoms.gap_sm, atoms.flex_wrap]}>
        <ActionButton
          label={state.granted ? (onRevoke ? 'Review access' : 'Granted') : 'Grant access'}
          onPress={state.granted && onRevoke ? onRevoke : onGrant}
          disabled={state.granted && !onRevoke}
          testID={testID ? `${testID}.action` : undefined}
        />
        {onLearnMore ? (
          <ActionButton
            label="Why?"
            onPress={onLearnMore}
            testID={testID ? `${testID}.why` : undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Granted state.
 *
 * Uses `text_success` for the label text but pairs it with a filled dot, so the
 * state is legible without relying on the colour (plan.md §40).
 */
export function StatusPill({ granted, label }: { granted: boolean; label: string }) {
  const t = useTheme();
  const color = granted ? t.atoms.text_success.color : t.atoms.text_contrast_low.color;

  return (
    <View
      style={[atoms.flex_row, atoms.align_center, atoms.gap_2xs]}
      accessible
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: granted ? t.atoms.text_success.color : t.atoms.text_contrast_low.color,
          },
        ]}
      />
      <Text style={[atoms.text_2xs, atoms.font_medium, { color }]}>{label}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  primary = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      // 40px minimum, above the 44px WCAG guidance for icon targets and enough
      // for a comfortable tap on a 20px-glyph button (plan.md §40).
      style={({ pressed }) => [
        atoms.px_lg,
        atoms.rounded_xs,
        atoms.align_center,
        atoms.justify_center,
        styles.action,
        primary ? t.atoms.bg_accent : t.atoms.bg_contrast_50,
        !primary && t.atoms.border_contrast_low,
        !primary && atoms.border,
        pressed && !disabled && { opacity: 0.75 },
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[atoms.text_sm, atoms.font_medium, primary ? t.atoms.text_inverted : t.atoms.text]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = {
  body: {
    lineHeight: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  action: {
    minHeight: tokens.touchTarget.comfortable,
    minWidth: 88,
  },
  disabled: {
    opacity: 0.4,
  },
} as const;
