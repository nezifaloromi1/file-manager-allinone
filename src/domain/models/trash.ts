import { type FileItem, type StorageProviderId } from './fileItem';

/**
 * Trash records (plan.md §25).
 *
 * Android storage behaviour varies by provider and by volume, so a trash entry
 * is a *record of intent*, not a promise that the bytes are recoverable: the
 * original may live on a volume with no way to relocate it. `state` makes that
 * explicit rather than discovering it at restore time.
 */

export const TRASH_STATES = ['STORED', 'RESTORED', 'PURGED', 'UNRECOVERABLE'] as const;
export type TrashState = (typeof TRASH_STATES)[number];

export type TrashItem = {
  /** Stable identity. Derived from the original URI, so it survives renames. */
  id: string;
  originalUri: string;
  originalName: string;
  /** Where the bytes now live. Usually inside the app's own directory. */
  trashUri: string;
  originalParentUri: string;
  isDirectory: boolean;
  size: number | null;
  deletedAt: number;
  provider: StorageProviderId;
  mimeType: string | null;
  state: TrashState;
  /** Set when state is `UNRECOVERABLE`, explaining why. */
  reason: string | null;
};

export function createTrashItem(input: {
  item: FileItem;
  trashUri: string;
  now?: number;
}): TrashItem {
  return {
    id: input.item.id,
    originalUri: input.item.uri,
    originalName: input.item.name,
    trashUri: input.trashUri,
    originalParentUri: input.item.parentUri,
    isDirectory: input.item.isDirectory,
    size: input.item.size,
    deletedAt: input.now ?? Date.now(),
    provider: input.item.provider,
    mimeType: input.item.mimeType,
    state: 'STORED',
    reason: null,
  };
}

/** A trashed item can only be restored while its bytes are still present. */
export function isRestorable(item: TrashItem): boolean {
  return item.state === 'STORED' || item.state === 'UNRECOVERABLE';
}

/**
 * The trash's location inside the app's private directory.
 *
 * A hidden `.trash` on the user's own volume would be confusing to look at, get
 * swept up by "clear Downloads", and is not writable on every provider. App
 * storage is always writable and is removed with the install, so the retention
 * promise cannot silently outlive the app.
 *
 * Takes the document directory as an argument rather than reading a native
 * module, which keeps every path rule here checkable without a device.
 */
export const TRASH_DIR_NAME = '.trash';

export function trashRootFor(documentUri: string): string {
  const base = documentUri.endsWith('/') ? documentUri : `${documentUri}/`;
  return `${base}${TRASH_DIR_NAME}/`;
}

/** True when a URI lives inside the trash. */
export function isTrashedIn(uri: string, documentUri: string): boolean {
  return uri.startsWith(trashRootFor(documentUri));
}

/**
 * The largest file that can be relocated into the trash across filesystem
 * backends (`content://` to `file://` or the reverse).
 *
 * `copy()`, `move()`, `rename()`, and `open()` all refuse `content://` URIs in
 * `expo-file-system`, so a cross-backend transfer cannot be streamed — the only
 * route left reads the whole file into memory. A 2 GB video would become a 2 GB
 * heap allocation and take the process down.
 *
 * Callers fall back to a permanent delete above this cap rather than pretending
 * to trash something they cannot. That a user with a large video loses the
 * ability to recover it is stated in the UI, not discovered at delete time.
 *
 * 150 MB sits under the heap an ordinary mid-range phone can spare while
 * comfortably covering documents, photos, and short video.
 */
export const MAX_TRASH_RELOCATE_BYTES = 150 * 1024 * 1024;

/**
 * A filename inside the trash that cannot collide with another entry.
 *
 * The original name is kept as a prefix so the trash stays browsable, with a
 * short hash of the URI as a suffix so trashing the same name twice does not
 * overwrite the first. Uniqueness is checked against existing *filenames*,
 * because a filename is what is being allocated.
 */
export function trashTargetNameFor(
  item: Pick<TrashItem, 'originalName' | 'originalUri'>,
  existing: readonly TrashItem[],
): string {
  const taken = new Set(existing.map((entry) => basenameOfTrashTarget(entry.trashUri)));

  const preferred = `${item.originalName}.${shortSuffix(item.originalUri)}`;
  if (!taken.has(preferred)) return preferred;

  let index = 2;
  while (taken.has(`${item.originalName}.${index}`)) index += 1;
  return `${item.originalName}.${index}`;
}

function basenameOfTrashTarget(uri: string): string {
  const withoutQuery = uri.split('?')[0];
  return withoutQuery.split('/').pop() ?? '';
}

/**
 * A short, filesystem-safe discriminator for a URI.
 *
 * `TrashItem.id` is deliberately not used: it is an opaque provider detail and
 * can contain `/` or `:`, which would produce a path rather than a filename.
 */
function shortSuffix(uri: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < uri.length; i += 1) {
    hash ^= uri.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Default retention (plan.md §25, §51).
 *
 * 30 days: long enough that a mistaken delete is caught, short enough that
 * trash never becomes a silent second copy of the user's storage. The user can
 * change it, and empty it manually at any time.
 */
export const DEFAULT_TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Items past their retention, oldest first — the automatic cleanup policy. */
export function selectExpiredTrash(
  items: readonly TrashItem[],
  retentionDays: number = DEFAULT_TRASH_RETENTION_DAYS,
  now = Date.now(),
): TrashItem[] {
  const cutoff = now - retentionDays * DAY_MS;
  return items
    .filter((item) => item.state === 'STORED' && item.deletedAt < cutoff)
    .sort((a, b) => a.deletedAt - b.deletedAt);
}

export function totalTrashSize(items: readonly TrashItem[]): number {
  return items.reduce((sum, item) => sum + (item.size ?? 0), 0);
}
