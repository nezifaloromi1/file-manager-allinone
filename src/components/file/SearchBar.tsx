import { TextInput, Pressable, View } from 'react-native';

import { atoms, useTheme } from '#/flux';
import { MagnifyingGlass_Stroke2_Corner0_Rounded } from '@/components/icons/MagnifyingGlass';
import { CloseCircleGlyph } from '@/components/icons/ChromeGlyphs';

/**
 * The search field (plan.md §5, §16, §39).
 *
 * Uncontrolled on purpose: it holds its own text state and reports changes up
 * through `onChangeText`, so typing never re-renders a 100,000-row list. The
 * parent debounces (plan.md §16) and re-lists when it decides to.
 */

export type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  placeholder?: string;
  /** Shows a spinner and blocks input while a search is running. */
  busy?: boolean;
  autoFocus?: boolean;
  testID?: string;
};

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
  placeholder = 'Search files',
  busy = false,
  autoFocus = false,
  testID = 'searchBar',
}: SearchBarProps) {
  const t = useTheme();

  return (
    <View
      style={[
        atoms.flex_row,
        atoms.align_center,
        atoms.gap_sm,
        atoms.px_md,
        atoms.py_sm,
        atoms.rounded_lg,
        t.atoms.bg_contrast_50,
      ]}
    >
      <MagnifyingGlass_Stroke2_Corner0_Rounded
        size={18}
        color={t.atoms.text_contrast_medium.color}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={t.atoms.text_contrast_low.color}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        // A file manager searches names, and names are full of punctuation that
        // autocorrect would fight with.
        autoComplete="off"
        spellCheck={false}
        returnKeyType="search"
        clearButtonMode="never"
        editable={!busy}
        accessibilityLabel="Search files"
        accessibilityHint="Searches names within this folder"
        testID={testID}
        style={[atoms.flex_1, atoms.text_md, t.atoms.text, styles.input]}
      />

      {value.length > 0 ? (
        <Pressable
          onPress={onClear}
          // 24px target inside a 44px-tall bar: the icon is small, so the
          // touch target needs the extra padding to stay tappable (plan.md §40).
          hitSlop={10}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          testID={`${testID}.clear`}
        >
          <CloseCircleGlyph size={18} color={t.atoms.text_contrast_low.color} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = {
  input: {
    // Transparent on purpose: the container provides the surface, and a second
    // background would produce a visible seam on Android.
    backgroundColor: 'transparent',
    // Clears the default Android padding so the bar's own padding governs.
    padding: 0,
    minHeight: 24,
  },
} as const;
