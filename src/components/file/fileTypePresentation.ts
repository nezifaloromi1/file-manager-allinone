import { type FileType } from '#/domain/models/fileType';
import { type Theme } from '#/flux/base/themes';
import { fileTypeTint } from '#/flux/base/tokens';
import { type FileItem } from '#/domain/models/fileItem';

/**
 * Type → label + colour, with no SVG or React Native import (plan.md §13, §39).
 *
 * Kept separate from the glyph components on purpose: this module is what the
 * accessibility strings and the filter chips are built from, and those need to
 * be checkable without a renderer. Importing `react-native-svg` here would drag
 * the whole native surface into any consumer of a label.
 *
 * Colour is a *secondary* signal — every type also has a distinct glyph shape,
 * so the UI still reads correctly for a colour-blind user or in forced high
 * contrast (plan.md §40, "Don't communicate important information through color
 * alone"). Only folders and media are tinted; tinting all eleven types would
 * recreate the "monochrome plus one" rule design.md is built on.
 */

/** Accessible names, used in row labels and filter chips. */
export const FILE_TYPE_LABELS: Record<FileType, string> = {
  DIRECTORY: 'Folder',
  IMAGE: 'Image',
  VIDEO: 'Video',
  AUDIO: 'Audio',
  DOCUMENT: 'Document',
  ARCHIVE: 'Archive',
  APK: 'App',
  TEXT: 'Text',
  CODE: 'Code',
  FONT: 'Font',
  UNKNOWN: 'File',
};

/**
 * The tint set, read from the tokens.
 *
 * Declared as a module-level `Set` so the membership test is O(1) on a value
 * that is looked up once per rendered row.
 */
const TINTED = new Set<FileType>(fileTypeTint.tinted);

export type FileTypePresentation = {
  /** Spoken and shown where there is no room for a name row. */
  label: string;
  /** `null` means "inherit the row's text colour". */
  color: string | null;
};

/**
 * Resolves presentation for a type in a given theme.
 *
 * Takes the theme rather than reading context so it stays a pure function,
 * which keeps it testable and usable from a list cell without a hook call.
 */
export function fileTypePresentation(type: FileType, t: Theme): FileTypePresentation {
  return {
    color: TINTED.has(type) ? t.palette.primary_500 : null,
    label: FILE_TYPE_LABELS[type] ?? FILE_TYPE_LABELS.UNKNOWN,
  };
}

/** Presentation for an item, honouring `isDirectory` over `type`. */
export function itemPresentation(item: FileItem, t: Theme): FileTypePresentation {
  return fileTypePresentation(item.isDirectory ? 'DIRECTORY' : item.type, t);
}
