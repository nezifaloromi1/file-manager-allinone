import { Pressable, Text } from 'react-native';

import { atoms, useTheme } from '@/flux';
import { type Category } from '#/domain/models/categories';
import { glyphForFileType } from '@/components/icons/FileTypeGlyph';

/**
 * A category tile on Home (plan.md §4).
 *
 * The glyph is the category's primary file type, so "Videos" looks like a video
 * without needing a bespoke illustration per tile. The label carries the
 * meaning for anyone who cannot distinguish the glyph, which keeps the tile
 * readable without colour (plan.md §40).
 */
export function CategoryTile({
  category,
  onPress,
  color,
}: {
  category: Category;
  onPress: () => void;
  color: string;
}) {
  const t = useTheme();
  // A category with no `types` (Downloads) borrows the folder glyph, which is
  // the honest representation: it is a directory, not a format.
  const Glyph = glyphForFileType(category.types[0] ?? 'DIRECTORY');

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${category.label} files`}
      accessibilityHint="Opens a filtered list of matching files"
      testID={`categoryTile.${category.id}`}
      style={({ pressed }) => [
        atoms.p_sm,
        atoms.gap_2xs,
        atoms.align_center,
        atoms.rounded_lg,
        t.atoms.bg_card,
        t.atoms.border_contrast_low,
        atoms.border,
        pressed && t.atoms.bg_contrast_50,
      ]}
    >
      <Glyph size={26} color={color} />
      <Text style={[atoms.text_2xs, atoms.font_medium, t.atoms.text]} numberOfLines={1}>
        {category.label}
      </Text>
    </Pressable>
  );
}
