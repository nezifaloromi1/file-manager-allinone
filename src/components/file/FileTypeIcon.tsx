import { type FileItem } from '#/domain/models/fileItem';
import { glyphForFileType, type FileTypeGlyphProps } from '@/components/icons/FileTypeGlyph';
import {
  FILE_TYPE_LABELS,
  fileTypePresentation,
  itemPresentation,
  type FileTypePresentation,
} from '@/components/file/fileTypePresentation';

/**
 * The rendered icon for a file.
 *
 * The label and colour live in `./fileTypePresentation`, which has no SVG
 * import and is therefore checkable without a renderer. This file adds the
 * glyph lookup, which does need one.
 *
 * Re-exports the presentation helpers so a screen can take everything from one
 * place.
 */

export type FileTypePresentationWithGlyph = FileTypePresentation & {
  glyph: (props: FileTypeGlyphProps) => React.JSX.Element;
};

/** Presentation plus the glyph to draw, for a given theme. */
export function fileTypeVisual(
  type: FileItem['type'],
  t: Parameters<typeof fileTypePresentation>[1],
) {
  return { ...fileTypePresentation(type, t), glyph: glyphForFileType(type) };
}

/**
 * A ready-to-render glyph for an item.
 *
 * Hidden from screen readers on purpose: the row's own label already announces
 * the file type, so a second announcement would be noise (plan.md §40).
 */
export function FileTypeIcon({
  item,
  t,
  size = 22,
}: {
  item: FileItem;
  t: Parameters<typeof fileTypePresentation>[1];
  size?: number;
}) {
  const presentation = itemPresentation(item, t);
  const color = presentation.color ?? t.atoms.text.color;
  const Glyph = glyphForFileType(item.isDirectory ? 'DIRECTORY' : item.type);

  return (
    <Glyph
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export { FILE_TYPE_LABELS, fileTypePresentation, itemPresentation };
export type { FileTypePresentation, FileTypeGlyphProps };
