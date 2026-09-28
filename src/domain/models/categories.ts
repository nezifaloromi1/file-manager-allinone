import { type FileType } from '#/domain/models/fileType';

/**
 * Home category shortcuts (plan.md §4).
 *
 * Each entry is a filter the search pass will apply, declared here so the tile
 * grid, the type filter, and the future search screen all agree on what
 * "Videos" means. `paths` are well-known directories to seed the walk with,
 * which is far cheaper than scanning the whole volume.
 */

export type CategoryId =
  'IMAGES' | 'VIDEOS' | 'AUDIO' | 'DOCUMENTS' | 'DOWNLOADS' | 'ARCHIVES' | 'APKS';

export type Category = {
  id: CategoryId;
  label: string;
  /** File types a match must be one of. */
  types: FileType[];
  /** Well-known directories to search first, relative to the volume root. */
  paths: string[];
};

export const CATEGORIES: readonly Category[] = [
  {
    id: 'IMAGES',
    label: 'Images',
    types: ['IMAGE'],
    paths: ['DCIM', 'Pictures', 'Screenshots', 'Camera'],
  },
  {
    id: 'VIDEOS',
    label: 'Videos',
    types: ['VIDEO'],
    paths: ['DCIM', 'Movies', 'Pictures'],
  },
  {
    id: 'AUDIO',
    label: 'Audio',
    types: ['AUDIO'],
    paths: ['Music', 'Downloads', 'Ringtones', 'Recordings'],
  },
  {
    id: 'DOCUMENTS',
    label: 'Documents',
    types: ['DOCUMENT', 'TEXT', 'CODE', 'FONT'],
    paths: ['Documents', 'Download'],
  },
  {
    id: 'DOWNLOADS',
    label: 'Downloads',
    types: [],
    paths: ['Download'],
  },
  {
    id: 'ARCHIVES',
    label: 'Archives',
    types: ['ARCHIVE'],
    paths: ['Download', 'Documents'],
  },
  {
    id: 'APKS',
    label: 'Apps',
    types: ['APK'],
    paths: ['Download', 'Documents'],
  },
] as const;

export function findCategory(id: CategoryId): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

/** Every file type covered by any category, for the "all types" filter. */
export function categoryFileTypes(): FileType[] {
  const types = new Set<FileType>();
  for (const category of CATEGORIES) {
    for (const type of category.types) types.add(type);
  }
  return [...types];
}
