import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { atoms, useTheme, tokens } from '#/flux';
import {
  DATE_RANGES,
  DATE_RANGE_LABELS,
  SIZE_RANGES,
  SIZE_RANGE_LABELS,
  type DateRange,
  type FilterSpec,
  type SizeRange,
  type SortSpec,
  SORT_LABELS,
  SORT_KEYS,
  isFilterActive,
} from '#/domain/models/sort';
import { FILE_TYPE_LABELS } from '@/components/file/fileTypePresentation';
import { CATEGORY_FILE_TYPES, type FileType } from '#/domain/models/fileType';
import { CheckGlyph } from '@/components/icons/ChromeGlyphs';
import { glyphForFileType } from '@/components/icons/FileTypeGlyph';

/**
 * The sort and filter sheet (plan.md §17, §18, §39).
 *
 * Both live in one bottom sheet because they answer the same question — "how
 * should this list look" — and plan.md's toolbar treats them as siblings. The
 * filter section is collapsed by default: plan.md §18 rates filtering as a P1
 * feature, and showing six checkbox groups above a file list on first open
 * buries the files.
 */

export type SortFilterSheetProps = {
  visible: boolean;
  sort: SortSpec;
  filter: FilterSpec;
  onSortChange: (sort: SortSpec) => void;
  onFilterChange: (filter: FilterSpec) => void;
  onClose: () => void;
  /** Live count so the user can see a filter is narrowing the list. */
  matchCount?: number;
  totalCount?: number;
};

export function SortFilterSheet({
  visible,
  sort,
  filter,
  onSortChange,
  onFilterChange,
  onClose,
  matchCount,
  totalCount,
}: SortFilterSheetProps) {
  const t = useTheme();

  // A bottom sheet, hand-rolled rather than pulled from a library: it is one
  // scrim, one animated view, and a scroll view, and the project already
  // depends on `@gorhom/bottom-sheet` for exactly this. Kept self-contained so
  // the phase has no new dependency; swapping in the library later is local.
  if (!visible) return null;

  return (
    <View style={styles.backdrop} testID="sortFilterSheet">
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" accessible />
      <View style={[styles.sheet, t.atoms.bg]} testID="sortFilterSheet.sheet">
        <View style={[styles.grabber, t.atoms.bg_contrast_200]} />

        <ScrollView
          contentContainerStyle={[atoms.p_lg, atoms.gap_lg]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[atoms.flex_row, atoms.align_center, atoms.justify_between]}>
            <Text style={[atoms.text_lg, atoms.font_medium, t.atoms.text]}>Sort & filter</Text>
            {isFilterActive(filter) ? (
              <Pressable
                onPress={() =>
                  onFilterChange({ ...filter, types: [], sizes: [], dates: [], query: '' })
                }
                accessible
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                testID="sortFilterSheet.clear"
                style={styles.clear}
              >
                <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text_link]}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          {matchCount !== undefined && totalCount !== undefined && totalCount > matchCount ? (
            <Text style={[atoms.text_xs, t.atoms.text_contrast_medium]}>
              Showing {matchCount} of {totalCount} items
            </Text>
          ) : null}

          <Section title="Sort by">
            {SORT_KEYS.map((key) => (
              <ChoiceRow
                key={key}
                label={SORT_LABELS[key]}
                selected={sort.key === key}
                onPress={() => onSortChange({ ...sort, key })}
                testID={`sortFilterSheet.sort.${key}`}
              />
            ))}
          </Section>

          <Section title="Order">
            <View style={atoms.flex_row}>
              {(['asc', 'desc'] as const).map((direction) => (
                <SegmentedOption
                  key={direction}
                  label={direction === 'asc' ? 'Ascending' : 'Descending'}
                  selected={sort.direction === direction}
                  onPress={() => onSortChange({ ...sort, direction })}
                  testID={`sortFilterSheet.direction.${direction}`}
                />
              ))}
            </View>
            <ToggleRow
              label="Folders first"
              hint="Keep folders above files, whatever the sort key"
              value={sort.foldersFirst}
              onChange={(value) => onSortChange({ ...sort, foldersFirst: value })}
              testID="sortFilterSheet.foldersFirst"
            />
          </Section>

          <Section title="Type">
            <View style={atoms.flex_row}>
              {CATEGORY_FILE_TYPES.map((type) => (
                <TypeChip
                  key={type}
                  type={type}
                  label={FILE_TYPE_LABELS[type]}
                  selected={filter.types.includes(type)}
                  onPress={() => onFilterChange(toggleType(filter, type))}
                  testID={`sortFilterSheet.type.${type}`}
                />
              ))}
            </View>
          </Section>

          <Section title="Size">
            <View style={atoms.flex_row}>
              {SIZE_RANGES.map((range) => (
                <Pill
                  key={range}
                  label={SIZE_RANGE_LABELS[range]}
                  selected={filter.sizes.includes(range)}
                  onPress={() => onFilterChange(toggleSize(filter, range))}
                  testID={`sortFilterSheet.size.${range}`}
                />
              ))}
            </View>
          </Section>

          <Section title="Date modified">
            <View style={atoms.flex_row}>
              {DATE_RANGES.map((range) => (
                <Pill
                  key={range}
                  label={DATE_RANGE_LABELS[range]}
                  selected={filter.dates.includes(range)}
                  onPress={() => onFilterChange(toggleDate(filter, range))}
                  testID={`sortFilterSheet.date.${range}`}
                />
              ))}
            </View>
          </Section>
        </ScrollView>

        <Pressable
          onPress={onClose}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Done"
          testID="sortFilterSheet.done"
          style={({ pressed }) => [
            atoms.mx_lg,
            atoms.mb_lg,
            atoms.p_md,
            atoms.rounded_xs,
            atoms.align_center,
            styles.done,
            t.atoms.bg,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text_inverted]}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Toggling a type off when it is the only one selected yields "no filter". */
function toggleType(filter: FilterSpec, type: FileType): FilterSpec {
  return { ...filter, types: toggle(filter.types, type) };
}

function toggleSize(filter: FilterSpec, range: SizeRange): FilterSpec {
  return { ...filter, sizes: toggle(filter.sizes, range) };
}

function toggleDate(filter: FilterSpec, range: DateRange): FilterSpec {
  return { ...filter, dates: toggle(filter.dates, range) };
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={atoms.gap_sm}>
      <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function ChoiceRow({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      style={({ pressed }) => [
        atoms.flex_row,
        atoms.align_center,
        atoms.gap_sm,
        styles.row,
        pressed && t.atoms.bg_contrast_25,
      ]}
    >
      {/* Radio mark rather than a checkbox: exactly one sort key is active. */}
      <View
        style={[
          styles.radio,
          selected ? { borderColor: t.palette.primary_500 } : t.atoms.border_contrast_medium,
        ]}
      >
        {selected ? (
          <View style={[styles.radioDot, { backgroundColor: t.palette.primary_500 }]} />
        ) : null}
      </View>
      <Text style={[atoms.text_sm, selected ? atoms.font_medium : atoms.font_normal, t.atoms.text]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  testID,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      testID={testID}
      style={({ pressed }) => [
        atoms.flex_row,
        atoms.align_center,
        atoms.gap_sm,
        styles.row,
        pressed && t.atoms.bg_contrast_25,
      ]}
    >
      <View
        style={[
          styles.checkbox,
          value
            ? { backgroundColor: t.palette.primary_500, borderColor: t.palette.primary_500 }
            : t.atoms.border_contrast_medium,
        ]}
      >
        {value ? <CheckGlyph size={14} color={t.palette.white} /> : null}
      </View>
      <View style={atoms.flex_1}>
        <Text style={[atoms.text_sm, t.atoms.text]}>{label}</Text>
        {hint ? <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

function SegmentedOption({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      style={({ pressed }) => [
        atoms.px_md,
        atoms.py_sm,
        atoms.rounded_xs,
        atoms.align_center,
        styles.segment,
        selected ? t.atoms.bg : t.atoms.bg_contrast_50,
        !selected && t.atoms.border_contrast_low,
        !selected && atoms.border,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[atoms.text_sm, selected ? atoms.font_medium : atoms.font_normal, t.atoms.text]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Pill({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      testID={testID}
      style={({ pressed }) => [
        atoms.px_md,
        atoms.py_sm,
        atoms.rounded_xs,
        atoms.align_center,
        styles.pill,
        selected ? t.atoms.bg : t.atoms.bg_contrast_50,
        !selected && t.atoms.border_contrast_low,
        !selected && atoms.border,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[atoms.text_sm, selected ? atoms.font_medium : atoms.font_normal, t.atoms.text]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A type chip carrying its own glyph, so the filter previews the icon. */
function TypeChip({
  type,
  label,
  selected,
  onPress,
  testID,
}: {
  type: FileType;
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const Glyph = glyphForFileType(type);

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      testID={testID}
      style={({ pressed }) => [
        atoms.px_sm,
        atoms.py_sm,
        atoms.rounded_xs,
        atoms.flex_row,
        atoms.align_center,
        atoms.gap_2xs,
        styles.pill,
        selected ? t.atoms.bg : t.atoms.bg_contrast_50,
        !selected && t.atoms.border_contrast_low,
        !selected && atoms.border,
        pressed && styles.pressed,
      ]}
    >
      <Glyph size={16} color={selected ? t.atoms.text_inverted.color : t.atoms.text.color} />
      <Text style={[atoms.text_xs, selected ? atoms.font_medium : atoms.font_normal, t.atoms.text]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = {
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'tokens.scrim.background',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  row: {
    minHeight: tokens.touchTarget.comfortable,
    paddingHorizontal: 4,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    flex: 1,
    minHeight: tokens.touchTarget.comfortable,
  },
  pill: {
    minHeight: tokens.touchTarget.compact,
  },
  clear: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  done: {
    minHeight: tokens.touchTarget.comfortable,
  },
  pressed: {
    opacity: 0.75,
  },
} as const;
