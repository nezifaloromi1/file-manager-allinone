import { Pressable, Text, View } from 'react-native';

import { atoms, useTheme, tokens } from '#/flux';
import { type ErrorDescription } from '#/core/errors';
import { InfoGlyph } from '@/components/icons/ChromeGlyphs';

/**
 * Error and empty states (plan.md §5, §42).
 *
 * These exist as components rather than ad-hoc views because plan.md §42 is
 * explicit that a failure must be *explained*: "Couldn't move the file. The
 * destination doesn't have enough available storage. Try another location."
 * Three fixed parts — what failed, why, what to do — with an optional retry.
 *
 * The wording comes from `AppError`, so it never contains a filename: a hostile
 * name cannot inject text into this surface (plan.md §31).
 */

export function ErrorState({
  error,
  onRetry,
  retryLabel = 'Try again',
  compact = false,
  testID = 'errorState',
}: {
  error: ErrorDescription;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <View
      style={[atoms.align_center, atoms.p_xl, compact ? atoms.py_md : atoms.py_xl, atoms.gap_sm]}
      accessible
      accessibilityLiveRegion="polite"
      // Announced as one block so TalkBack reads the whole explanation in order
      // rather than three disconnected fragments (plan.md §40).
      accessibilityLabel={`${error.title} ${error.message}${error.hint ? ` ${error.hint}` : ''}`}
      testID={testID}
    >
      <View style={styles.badge}>
        <InfoGlyph size={22} color={t.atoms.text_error.color} />
      </View>

      <Text style={[atoms.text_lg, atoms.font_medium, t.atoms.text, styles.center]}>
        {error.title}
      </Text>

      <Text style={[atoms.text_sm, t.atoms.text_contrast_medium, styles.center, styles.body]}>
        {error.message}
      </Text>

      {error.hint ? (
        <Text style={[atoms.text_sm, t.atoms.text_contrast_low, styles.center, styles.body]}>
          {error.hint}
        </Text>
      ) : null}

      {onRetry ? (
        <SecondaryButton label={retryLabel} onPress={onRetry} testID={`${testID}.retry`} />
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  testID = 'emptyState',
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <View style={[atoms.align_center, atoms.p_xl, atoms.py_2xl, atoms.gap_sm]} testID={testID}>
      <Text style={[atoms.text_lg, atoms.font_medium, t.atoms.text, styles.center]}>{title}</Text>
      {message ? (
        <Text style={[atoms.text_sm, t.atoms.text_contrast_medium, styles.center, styles.body]}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <SecondaryButton label={actionLabel} onPress={onAction} testID={`${testID}.action`} />
      ) : null}
    </View>
  );
}

/** Folder-specific empty copy, so the browser never has to invent wording. */
export function EmptyFolderState({
  isFiltered,
  onClearFilters,
  onCreateFolder,
}: {
  isFiltered: boolean;
  onClearFilters?: () => void;
  onCreateFolder?: () => void;
}) {
  if (isFiltered) {
    return (
      <EmptyState
        title="No matching files"
        message="Nothing here matches the current search and filters."
        actionLabel={onClearFilters ? 'Clear filters' : undefined}
        onAction={onClearFilters}
      />
    );
  }
  return (
    <EmptyState
      title="This folder is empty"
      message="Files you add or move here will show up in this list."
      actionLabel={onCreateFolder ? 'New folder' : undefined}
      onAction={onCreateFolder}
    />
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={[atoms.align_center, atoms.py_xl]} accessibilityLiveRegion="polite">
      <Text style={[atoms.text_sm, t.atoms.text_contrast_medium]}>{label}</Text>
    </View>
  );
}

/**
 * The secondary button.
 *
 * design.md forbids shadows and large radii on interactive elements and caps
 * copy at roughly two actions per screen, so this is flat with a 4px radius and
 * a 40px minimum height.
 */
export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
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
      style={({ pressed }) => [
        atoms.px_lg,
        atoms.py_sm,
        atoms.rounded_xs,
        atoms.border,
        styles.button,
        t.atoms.bg_card,
        t.atoms.border_contrast_medium,
        pressed && !disabled && t.atoms.bg_contrast_50,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text]}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  badge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  body: {
    lineHeight: 20,
    maxWidth: 320,
  },
  button: {
    marginTop: 8,
    minHeight: tokens.touchTarget.comfortable,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
} as const;
