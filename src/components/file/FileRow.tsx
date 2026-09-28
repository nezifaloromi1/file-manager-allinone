import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { atoms, useTheme } from '#/flux';
import { type FileItem } from '#/domain/models/fileItem';
import { formatBytes, formatCount, formatRelativeTime } from '#/core/utils/format';
import { itemPresentation } from '@/components/file/fileTypePresentation';
import { SelectionCheck } from '@/components/file/SelectionCheck';

/**
 * The list row (plan.md §5, §6, §39).
 *
 * One row per file, showing name, size or item count, and modified time. The
 * row owns its touch target and its accessibility label; it does not own
 * selection, which the list screen drives through `selected`.
 */

export type FileRowProps = {
  item: FileItem;
  /** Item count for a directory, when known. `null` while still counting. */
  childCount?: number | null;
  onPress: (item: FileItem) => void;
  onLongPress?: (item: FileItem) => void;
  /** Selection mode is active, so the checkbox is shown. */
  selectionMode?: boolean;
  selected?: boolean;
  /** Extension is hidden by the "Show file extensions" setting. */
  showExtension?: boolean;
  /** Raw selection affordance, e.g. a long-press hint. */
  trailing?: ReactNode;
  /** Overrides the row's own test id, so a list can target a specific row. */
  testID?: string;
};

export function FileRow({
  item,
  childCount = null,
  onPress,
  onLongPress,
  selectionMode = false,
  selected = false,
  showExtension = true,
  trailing,
  testID,
}: FileRowProps) {
  const t = useTheme();
  const presentation = itemPresentation(item, t);

  const name = showExtension || item.isDirectory ? item.name : stripExtension(item.name);

  // A directory shows its item count, a file its size. Directories have no
  // meaningful size without an expensive recursive walk (plan §19), so this
  // avoids showing a misleading `0 B` or blocking the row on a scan.
  const subtitle = item.isDirectory
    ? childCount === null
      ? 'Folder'
      : formatCount(childCount, 'item')
    : `${formatBytes(item.size)} · ${formatRelativeTime(item.modifiedAt)}`;

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      accessible
      accessibilityRole="button"
      accessibilityState={{ selected: selectionMode ? selected : undefined }}
      accessibilityLabel={accessibilityLabel(item, childCount, presentation.label)}
      accessibilityHint={
        item.isDirectory ? 'Opens this folder' : 'Opens this file. Long press to select.'
      }
      testID={testID ?? `fileRow.${item.name}`}
      style={({ pressed }) => [
        atoms.flex_row,
        atoms.align_center,
        atoms.gap_md,
        atoms.px_lg,
        atoms.py_md,
        selected && t.atoms.bg_contrast_50,
        pressed && !selected && t.atoms.bg_contrast_25,
      ]}
    >
      {selectionMode ? <SelectionCheck selected={selected} /> : null}

      <View style={atoms.w_full}>
        <Text
          style={[atoms.text_md, atoms.font_medium, t.atoms.text, styles.name]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {name}
        </Text>
        <Text style={[atoms.text_xs, t.atoms.text_contrast_medium]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {trailing}
    </Pressable>
  );
}

/**
 * Trims a trailing extension for display.
 *
 * Ellipsises from the *middle*, not the end: a file called
 * `Q3 2026 financial report final.pdf` must still show the extension when
 * truncated, since that is the part that identifies the format.
 */
function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return name;
  return name.slice(0, dot);
}

/**
 * One spoken sentence per row.
 *
 * Announced as a single label rather than as separate name/size nodes, so
 * TalkBack reads "report dot P D F, 2.4 megabytes, 2 days ago" in one pass
 * instead of three (plan.md §40).
 */
function accessibilityLabel(item: FileItem, childCount: number | null, typeLabel: string): string {
  const parts = [item.name, typeLabel];

  if (item.isDirectory) {
    if (childCount !== null) parts.push(formatCount(childCount, 'item'));
    if (item.isHidden) parts.push('hidden');
  } else {
    parts.push(formatBytes(item.size));
    const time = formatRelativeTime(item.modifiedAt);
    if (time !== '—') parts.push(time);
  }
  return parts.join(', ');
}

const styles = {
  name: {
    // Generous vertical leading keeps multi-byte filenames from clipping when
    // the user has enlarged their system font (plan.md §40).
    lineHeight: 22,
  },
} as const;
