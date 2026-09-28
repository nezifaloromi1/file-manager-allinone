/**
 * Well-known storage paths, with no native imports.
 *
 * Separated from `expoFileSystemAdapter` so anything that only needs a path
 * string — the breadcrumb trail, the category seeds, the checks — can use it
 * without pulling `expo-file-system` (and therefore React Native) into the
 * module graph.
 */

/** Android's emulated primary external storage, shown as `Internal storage`. */
export const INTERNAL_STORAGE_URI = 'file:///storage/emulated/0/';

/** Conventional top-level folders, used as category search seeds. */
export const WELL_KNOWN_DIRECTORIES = [
  { label: 'Download', uri: `${INTERNAL_STORAGE_URI}Download/` },
  { label: 'Documents', uri: `${INTERNAL_STORAGE_URI}Documents/` },
  { label: 'DCIM', uri: `${INTERNAL_STORAGE_URI}DCIM/` },
  { label: 'Pictures', uri: `${INTERNAL_STORAGE_URI}Pictures/` },
  { label: 'Movies', uri: `${INTERNAL_STORAGE_URI}Movies/` },
  { label: 'Music', uri: `${INTERNAL_STORAGE_URI}Music/` },
] as const;

export function isLocalUri(uri: string): boolean {
  return uri.startsWith('file://');
}

/** The volume root a URI belongs to, for building a breadcrumb trail. */
export function volumeRootFor(uri: string): { rootUri: string; label: string } {
  if (isLocalUri(uri)) {
    return { rootUri: INTERNAL_STORAGE_URI, label: 'Internal storage' };
  }
  // A SAF grant has no well-known root to anchor on, so the trail is relative
  // to `/` and the first crumb names the granted folder.
  return { rootUri: '/', label: 'Selected folder' };
}
