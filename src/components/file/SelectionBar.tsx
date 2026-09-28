import { Pressable, Text, View } from 'react-native';

import { atoms, useTheme, tokens } from '#/flux';
import { formatBytes } from '#/core/utils/format';
import { type FileItem } from '#/domain/models/fileItem';
import { type FileOperation, isTerminal } from '#/domain/models/operation';
import { ProgressBar } from '@/components/file/ProgressBar';
import {
  CopyGlyph,
  MoveGlyph,
  OverflowGlyph,
  ShareGlyph,
  TrashGlyph,
} from '@/components/icons/ChromeGlyphs';
import { SelectionCheck } from '@/components/file/SelectionCheck';

/**
 * The selection action bar (plan.md §7, §22).
 *
 * Replaces the toolbar's right-hand actions while a multi-selection is active,
 * showing `3 selected` plus Copy / Move / Share / Delete / More.
 *
 * Every action can be *unavailable* rather than absent. plan.md §9's SAF
 * limitation means Copy and Move genuinely do not work on a system-picked
 * folder, and hiding them makes the app look broken. They stay visible but
 * disabled, and `disabledReason` is passed straight to the accessibility hint
 * so TalkBack explains why.
 */

export type SelectionAction = 'copy' | 'move' | 'share' | 'delete' | 'rename' | 'more';

export type SelectionBarProps = {
  selectedItems: readonly FileItem[];
  onClear: () => void;
  onSelectAll: () => void;
  onAction: (action: SelectionAction) => void;
  /** Actions the current provider cannot perform. */
  disabledActions?: Partial<Record<SelectionAction, string>>;
  /** The running operation, shown instead of the actions while it works. */
  operation?: FileOperation | null;
  onCancelOperation?: () => void;
  testID?: string;
};

export function SelectionBar({
  selectedItems,
  onClear,
  onSelectAll,
  onAction,
  disabledActions = {},
  operation,
  onCancelOperation,
  testID = 'selectionBar',
}: SelectionBarProps) {
  const t = useTheme();
  const count = selectedItems.length;

  if (operation && !isTerminal(operation.state)) {
    return (
      <View
        style={[styles.root, t.atoms.bg, t.atoms.border_contrast_low, atoms.border_t]}
        testID={`${testID}.operation`}
      >
        <ProgressBar
          progress={operation.progress}
          label={operation.label}
          onCancel={onCancelOperation}
          compact
          testID={`${testID}.progress`}
        />
      </View>
    );
  }

  if (count === 0) return null;

  const totalBytes = selectedItems.reduce((sum, item) => sum + (item.size ?? 0), 0);
  const selectionSummary = `${count} selected${
    totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ''
  }`;

  return (
    <View
      style={[styles.root, t.atoms.bg, t.atoms.border_contrast_low, atoms.border_t]}
      accessible
      accessibilityLabel={selectionSummary}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <View style={[atoms.flex_row, atoms.align_center, atoms.px_md, atoms.gap_sm]}>
        <Pressable
          onPress={onClear}
          hitSlop={8}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Clear selection"
          testID={`${testID}.clear`}
        >
          <SelectionCheck selected={false} size={22} />
        </Pressable>

        <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text]} numberOfLines={1}>
          {selectionSummary}
        </Text>

        <View style={atoms.flex_1} />

        <Pressable
          onPress={onSelectAll}
          hitSlop={8}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Select all"
          testID={`${testID}.selectAll`}
          style={styles.smallAction}
        >
          <Text style={[atoms.text_xs, atoms.font_medium, t.atoms.text_link]}>All</Text>
        </Pressable>
      </View>

      <View style={[atoms.flex_row, atoms.border_t, t.atoms.border_contrast_low]}>
        <BarAction
          action="copy"
          label="Copy"
          icon={<CopyGlyph size={20} color={t.atoms.text.color} />}
          onPress={() => onAction('copy')}
          disabledReason={disabledActions.copy}
          testID={`${testID}.copy`}
        />
        <BarAction
          action="move"
          label="Move"
          icon={<MoveGlyph size={20} color={t.atoms.text.color} />}
          onPress={() => onAction('move')}
          disabledReason={disabledActions.move}
          testID={`${testID}.move`}
        />
        <BarAction
          action="share"
          label="Share"
          icon={<ShareGlyph size={20} color={t.atoms.text.color} />}
          onPress={() => onAction('share')}
          testID={`${testID}.share`}
        />
        <BarAction
          action="delete"
          label="Delete"
          icon={<TrashGlyph size={20} color={t.atoms.text_error.color} />}
          onPress={() => onAction('delete')}
          destructive
          testID={`${testID}.delete`}
        />
        <BarAction
          action="more"
          label="More"
          icon={<OverflowGlyph size={20} color={t.atoms.text.color} />}
          onPress={() => onAction('more')}
          testID={`${testID}.more`}
        />
      </View>
    </View>
  );
}

function BarAction({
  action,
  label,
  icon,
  onPress,
  disabledReason,
  destructive = false,
  testID,
}: {
  action: SelectionAction;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabledReason?: string;
  destructive?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const disabled = disabledReason !== undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      // The reason travels in the hint, so a screen-reader user learns *why*
      // the control is unavailable rather than only that it is (plan.md §42).
      accessibilityHint={disabledReason}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        atoms.flex_1,
        atoms.align_center,
        atoms.justify_center,
        atoms.py_sm,
        atoms.gap_2xs,
        styles.action,
        pressed && !disabled && t.atoms.bg_contrast_50,
        disabled && styles.disabled,
      ]}
    >
      {icon}
      <Text
        style={[
          atoms.text_2xs,
          destructive ? { color: t.atoms.text_error.color } : t.atoms.text_contrast_medium,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = {
  root: {
    // Sits above the bottom tab bar, so it carries its own surface and a hairline.
    borderTopWidth: 1,
  },
  action: {
    minHeight: tokens.touchTarget.row,
  },
  smallAction: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  disabled: {
    opacity: 0.35,
  },
} as const;
