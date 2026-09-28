import { type FileType } from './fileType';

/**
 * Which backend a location belongs to (plan.md §9).
 *
 * The UI never branches on this — it asks a `StorageProvider` — but operations
 * are tagged with it for logging (plan.md §49) and for deciding whether a move
 * can be atomic.
 */
export type StorageProviderId = 'local' | 'saf' | 'cache' | 'trash';

/**
 * The normalised internal representation of anything the app can show
 * (plan.md §12).
 *
 * `id` is derived from the URI, never from the name: "Don't use filenames as
 * unique identifiers" — renaming a file must not change its identity, and two
 * directories can each contain a `notes.txt`.
 */
export type FileItem = {
  /** Stable identity, derived from `uri`. */
  id: string;
  name: string;
  /** Canonical location — `file://…` for local, `content://…` for SAF. */
  uri: string;
  parentUri: string;
  type: FileType;
  mimeType: string | null;
  /** Bytes. `null` for directories, whose size is computed on demand. */
  size: number | null;
  /** Epoch ms, or `null` when the filesystem does not report it. */
  modifiedAt: number | null;
  /** Epoch ms, or `null` below Android API 26. */
  createdAt: number | null;
  isDirectory: boolean;
  isHidden: boolean;
  /** Lowercase, without the dot. Empty string when there is none. */
  extension: string;
  provider: StorageProviderId;
};

/**
 * Identity derived from a URI.
 *
 * Hashed rather than used raw because URIs are long and are used as list keys —
 * a 200-character key per row is measurable in a 100k-row directory. Any stable
 * hash works; this only needs to be collision-resistant within one device.
 */
export function fileIdFromUri(uri: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < uri.length; i += 1) {
    hash ^= uri.charCodeAt(i);
    // FNV-1a prime, via shifts to stay in int32 under Hermes.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return `${hash.toString(36)}-${uri.length.toString(36)}`;
}

/** A dotfile is hidden on Android. Applies at any depth, not just at the root. */
export function isHiddenName(name: string): boolean {
  return name.startsWith('.');
}

/** True when the item should be hidden unless "show hidden files" is on (§51). */
export function shouldHide(item: FileItem, showHidden: boolean): boolean {
  return !showHidden && item.isHidden;
}
