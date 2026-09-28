import { memo } from 'react';
import { FlatList, Pressable, Text, View, type ListRenderItemInfo } from 'react-native';

import { atoms, useTheme } from '#/flux';
import { type FileItem } from '#/domain/models/fileItem';
import { formatBytes } from '#/core/utils/format';
import { FileThumbnail } from '@/components/file/FileThumbnail';
import { SelectionCheck } from '@/components/file/SelectionCheck';
import { GRID_GUTTER, columnsForWidth } from '@/components/file/gridLayout';

export { GRID_GUTTER, columnsForWidth };

/**
 * The grid view (plan.md §6, §39).
 *
 * A `FlatList` with a fixed column count, not a `ScrollView` of `Views`: a
 * folder with 100,000 entries must never build 100,000 views at once
 * (plan.md §46). Cell width is computed from the container so the grid adapts
 * to a phone, a foldable, and a tablet without a separate layout.
 *
 * Wrapped in `memo` because a grid re-renders every visible cell on each parent
 * state change — selection toggles included — and without it a 20-cell grid
 * re-renders 20 times per tap.
 */

const GUTTER = GRID_GUTTER;

export type FileGridProps = {
  items: readonly FileItem[];
  columns: number;
  onPress: (item: FileItem) => void;
  onLongPress?: (item: FileItem) => void;
  selectionMode?: boolean;
  selectedUris?: ReadonlySet<string>;
  showExtension?: boolean;
  emptyState?: React.ReactNode;
  ListHeaderComponent?: React.ReactElement | null;
};

export const FileGrid = memo(function FileGrid({
  items,
  columns,
  onPress,
  onLongPress,
  selectionMode = false,
  selectedUris,
  showExtension = true,
  emptyState,
  ListHeaderComponent,
}: FileGridProps) {
  const t = useTheme();

  const renderItem = ({ item }: ListRenderItemInfo<FileItem>) => (
    <GridCell
      item={item}
      selected={selectionMode && (selectedUris?.has(item.uri) ?? false)}
      selectionMode={selectionMode}
      onPress={onPress}
      onLongPress={onLongPress}
      showExtension={showExtension}
    />
  );

  // `columnWrapperStyle` padding plus an explicit gap is what produces the
  // inset look; `numColumns` alone would run the last row edge to edge.
  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={columns}
      key={`grid-${columns}`}
      ListHeaderComponent={ListHeaderComponent}
      // Guarded rather than passed through: `FlatList`'s `ListEmptyComponent`
      // only accepts an element or a component, and an empty `ReactNode` union
      // is not assignable to either.
      ListEmptyComponent={items.length === 0 && emptyState ? <>{emptyState}</> : null}
      columnWrapperStyle={[styles.column, { backgroundColor: t.atoms.bg.backgroundColor }]}
      contentContainerStyle={styles.content}
      // Rows are a fixed height, so a small window lets the list recycle
      // aggressively without measuring every cell.
      initialNumToRender={columns * 6}
      maxToRenderPerBatch={columns * 4}
      windowSize={7}
      removeClippedSubviews
      // The grid is a long list of a single media type; a larger window keeps
      // fast scrolling from flashing unrendered cells.
      keyboardShouldPersistTaps="handled"
    />
  );
});

type GridCellProps = {
  item: FileItem;
  selected: boolean;
  selectionMode: boolean;
  onPress: (item: FileItem) => void;
  onLongPress?: (item: FileItem) => void;
  showExtension: boolean;
};

const GridCell = memo(function GridCell({
  item,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  showExtension,
}: GridCellProps) {
  const t = useTheme();
  const name = showExtension || item.isDirectory ? item.name : stripExtension(item.name);

  return (
    <View style={styles.cellWrapper}>
      <Pressable
        onPress={() => onPress(item)}
        onLongPress={onLongPress ? () => onLongPress(item) : undefined}
        accessible
        accessibilityRole="button"
        accessibilityState={{ selected: selectionMode ? selected : undefined }}
        accessibilityLabel={
          item.isDirectory ? `${name}, folder` : `${name}, ${formatBytes(item.size)}`
        }
        testID={`fileGrid.${item.name}`}
        style={({ pressed }) => [
          atoms.p_2xs,
          atoms.rounded_md,
          selected && styles.cellSelected,
          selected && { backgroundColor: t.atoms.bg_contrast_100.backgroundColor },
          pressed && !selected && { backgroundColor: t.atoms.bg_contrast_25.backgroundColor },
        ]}
      >
        <View style={[styles.thumbnailFrame, t.atoms.bg_pane]}>
          <FileThumbnail item={item} size={72} />
        </View>

        {selectionMode ? (
          <View style={styles.checkOverlay}>
            <SelectionCheck selected={selected} size={20} />
          </View>
        ) : null}

        <Text
          style={[atoms.text_2xs, atoms.font_medium, t.atoms.text, styles.cellName]}
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {name}
        </Text>
      </Pressable>
    </View>
  );
});

// `columnsForWidth` and `GRID_GUTTER` live in ./gridLayout so they can be
// tested without a device; they are re-exported here for convenience.

/**
 * Identity for list recycling.
 *
 * Keyed by URI, not by name: two files can share a name in different folders,
 * and keying by name makes `FlatList` reuse the wrong row (plan.md §12).
 */
function keyExtractor(item: FileItem): string {
  return item.uri;
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return name;
  return name.slice(0, dot);
}

const styles = {
  content: {
    paddingHorizontal: GUTTER,
    paddingBottom: 96,
  },
  column: {
    gap: GUTTER,
  },
  // `flex: 1` alone is correct: `columnWrapperStyle` lays out `columns` of them
  // per row, so each cell divides the row evenly. A percentage `maxWidth` would
  // hard-code a two-column layout and break every other column count.
  cellWrapper: {
    flex: 1,
  },
  thumbnailFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellName: {
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 14,
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: 'transparent',
  },
  checkOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
} as const;
