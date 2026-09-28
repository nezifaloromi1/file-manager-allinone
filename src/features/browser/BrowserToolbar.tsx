import { Pressable, Text, View } from 'react-native';

import { atoms, useTheme } from '@/flux';
import { Header } from '@/components/layout/Header';
import {
  EyeGlyph,
  GridGlyph,
  ListGlyph,
  NewFolderGlyph,
  OverflowGlyph,
  SortGlyph,
  StarGlyph,
} from '@/components/icons/ChromeGlyphs';
import { MagnifyingGlass_Stroke2_Corner0_Rounded } from '@/components/icons/MagnifyingGlass';
import { type SortSpec } from '#/domain/models/sort';
import { SORT_LABELS } from '#/domain/models/sort';

/**
 * The browser toolbar (plan.md §5).
 *
 * `←  Download             🔍  ⋮` — a back affordance, the folder name, and the
 * three actions that apply to the current view. Folder-level actions
 * (new folder, sort, view, hidden files, select all) live in the overflow menu
 * rather than crowding the bar; plan.md's own sketch puts them there.
 */
/**
 * The browser's app bar.
 *
 * A thin wrapper over the shared `Header`, so its height cannot drift from the
 * tab roots' the way the hand-rolled version did. Only the browser has a back
 * button, which is the difference the shared header exists to express.
 */
export function BrowserToolbar({
  title,
  onBack,
  onSearch,
  onOverflow,
  testID = 'browser.toolbar',
}: {
  title: string;
  onBack: () => void;
  onSearch: () => void;
  onOverflow: () => void;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <Header
      title={title}
      onBack={onBack}
      testID={testID}
      actions={[
        {
          label: 'Search in this folder',
          onPress: onSearch,
          icon: <MagnifyingGlass_Stroke2_Corner0_Rounded size={20} color={t.atoms.text.color} />,
          testID: `${testID}.search`,
        },
        {
          label: 'More options',
          onPress: onOverflow,
          icon: <OverflowGlyph size={20} color={t.atoms.text.color} />,
          testID: `${testID}.overflow`,
        },
      ]}
    />
  );
}

/**
 * The overflow sheet contents (plan.md §5, §17).
 *
 * Rendered inline rather than in a sheet here so the screen controls its own
 * presentation; the items themselves are here so their labels and states stay in
 * one place.
 */
export function BrowserMenuItems({
  onNewFolder,
  onSort,
  sort,
  onToggleHidden,
  hiddenShown,
  onToggleView,
  view,
  onSelectAll,
  onToggleFavorite,
  isFavorite,
  testID = 'browser.menu',
}: {
  onNewFolder: () => void;
  onSort: () => void;
  sort: SortSpec;
  onToggleHidden: () => void;
  hiddenShown: boolean;
  onToggleView: () => void;
  view: 'list' | 'grid';
  onSelectAll: () => void;
  onToggleFavorite?: () => void;
  /** `undefined` when the current folder has never been bookmarked. */
  isFavorite?: boolean;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <View style={atoms.gap_2xs}>
      <MenuRow
        label="New folder"
        icon={<NewFolderGlyph size={18} color={t.atoms.text.color} />}
        onPress={onNewFolder}
        testID={`${testID}.newFolder`}
      />
      <MenuRow
        label={`Sort · ${SORT_LABELS[sort.key]}`}
        icon={<SortGlyph size={18} color={t.atoms.text.color} />}
        onPress={onSort}
        testID={`${testID}.sort`}
      />
      <MenuRow
        label={view === 'list' ? 'Show as grid' : 'Show as list'}
        icon={
          view === 'list' ? (
            <GridGlyph size={18} color={t.atoms.text.color} />
          ) : (
            <ListGlyph size={18} color={t.atoms.text.color} />
          )
        }
        onPress={onToggleView}
        testID={`${testID}.view`}
      />
      {/* The strikethrough is the state, not just the colour — plan.md §40
          requires hidden files to be legible without relying on colour. */}
      <MenuRow
        label={hiddenShown ? 'Hide hidden files' : 'Show hidden files'}
        icon={<EyeGlyph size={18} color={t.atoms.text.color} off={!hiddenShown} />}
        onPress={onToggleHidden}
        testID={`${testID}.hidden`}
      />
      <MenuRow label="Select all" onPress={onSelectAll} testID={`${testID}.selectAll`} />
      {onToggleFavorite ? (
        <MenuRow
          // The filled and outline stars are the state; the label says it in
          // words as well, so the meaning survives a screen reader (plan.md §40).
          label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          icon={<StarGlyph size={18} color={t.atoms.text.color} filled={isFavorite} />}
          onPress={onToggleFavorite}
          testID={`${testID}.favorite`}
        />
      ) : null}
    </View>
  );
}

function MenuRow({
  label,
  icon,
  onPress,
  testID,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        atoms.flex_row,
        atoms.align_center,
        atoms.gap_md,
        atoms.p_lg,
        pressed && t.atoms.bg_contrast_50,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : <View style={styles.icon} />}
      <Text style={[atoms.text_md, t.atoms.text]}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  icon: {
    width: 24,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
} as const;
