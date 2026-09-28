import { type FileItem, type StorageProviderId } from '#/domain/models/fileItem';
import { type Volume } from '#/domain/models/storage';
import { type ConflictPolicy } from '#/domain/models/operation';

/**
 * The storage abstraction (plan.md §9) — the most important architectural
 * decision in the plan.
 *
 * "Don't make your entire app depend directly on Android's filesystem APIs."
 * The UI must not care whether a file came from internal storage, an SD card, a
 * USB stick, or — later — SMB or WebDAV. That becomes an implementation detail
 * behind this interface.
 *
 * ## Why `capabilities` exists
 *
 * It is not hypothetical. `expo-file-system@19.0.24` throws
 * `"This method cannot be used with content URIs"` from `copy()`, `move()`, and
 * `rename()`, because all three route through a `java.io.File` accessor that
 * refuses `content://` URIs (see `FileSystemPath.kt`). So a SAF-backed
 * provider genuinely cannot rename or move.
 *
 * Declaring that up front means the browser can disable those actions and
 * explain why, instead of the user discovering it by hitting an error. It is
 * also what makes a future native module that implements those primitives for
 * `DocumentFile` a drop-in replacement rather than a rewrite.
 */
export type ProviderCapabilities = {
  canList: boolean;
  canCreateDirectory: boolean;
  canCreateFile: boolean;
  canRename: boolean;
  canCopy: boolean;
  canMove: boolean;
  /** False when the provider can only stage deletions for the trash to handle. */
  canDeletePermanently: boolean;
  canWrite: boolean;
  /** Whether `trashUri` relocation is meaningful for this provider. */
  canRelocateToTrash: boolean;
};

/** Progress callback for streaming operations (plan.md §22, §47). */
export type ProgressReporter = (transferred: number, total: number | null) => void;

/** Aborts a long-running operation cooperatively (plan.md §48). */
export type CancelSignal = {
  readonly isCancelled: boolean;
};

export const NEVER_CANCELLED: CancelSignal = { isCancelled: false };

export type ListOptions = {
  /** Include dotfiles and other hidden entries. */
  showHidden: boolean;
  signal?: CancelSignal;
};

export type WriteOptions = {
  /**
   * How to resolve a name collision (plan.md §24).
   *
   * Required for anything that can overwrite: there is no default, so no
   * caller can accidentally destroy a file by omitting it.
   */
  onConflict: (name: string) => Promise<ConflictPolicy>;
  signal?: CancelSignal;
};

export type RenameOptions = {
  onConflict: (name: string) => Promise<ConflictPolicy>;
};

export type CopyOptions = {
  onConflict: (name: string) => Promise<ConflictPolicy>;
  onProgress?: ProgressReporter;
  signal?: CancelSignal;
  /**
   * Write under this name instead of the source's own name.
   *
   * Required for the `KEEP_BOTH` branch of conflict resolution, where the
   * planner has already chosen `report (2).pdf`. Omitting it means the
   * destination keeps the source name and the planner's rename is silently lost.
   */
  targetName?: string;
  /**
   * Attempt an atomic move instead of copy-then-delete.
   *
   * A provider may ignore this; callers must treat a fallback to copy as
   * success, since a non-atomic move is still a correct move.
   */
  preferAtomic?: boolean;
};

/**
 * One source of files. Implementations exist per backend:
 * `LocalFileSystemProvider` (file:// paths), `SafStorageProvider`
 * (content:// trees), and later cloud/FTP/SMB providers (plan.md §36).
 */
export interface StorageProvider {
  readonly id: StorageProviderId;
  readonly capabilities: ProviderCapabilities;

  /**
   * Volumes this provider can reach, for the Storage tab and Home's storage
   * card. An empty list is valid — a single-root provider just reports one.
   */
  listVolumes(): Promise<Volume[]>;

  /** Immediate children of `uri`. Never recursive (plan.md §46). */
  list(uri: string, options?: ListOptions): Promise<FileItem[]>;

  /**
   * Metadata for a single item, or `null` if it is gone.
   *
   * `list()` already returns this, so this exists for the details screen and
   * for re-reading one row after an external change.
   */
  getMetadata(uri: string): Promise<FileItem | null>;

  exists(uri: string): Promise<boolean>;

  /**
   * Creates a directory and returns it.
   *
   * Rejects with `ALREADY_EXISTS` rather than silently reusing a folder of the
   * same name — plan.md §21 requires this to be validated, not merged.
   */
  createDirectory(parentUri: string, name: string, options?: WriteOptions): Promise<FileItem>;

  createFile(parentUri: string, name: string, mimeType?: string): Promise<FileItem>;

  rename(uri: string, newName: string, options?: RenameOptions): Promise<FileItem>;

  copy(sourceUri: string, destinationDirUri: string, options?: CopyOptions): Promise<FileItem>;

  move(sourceUri: string, destinationDirUri: string, options?: CopyOptions): Promise<FileItem>;

  /**
   * Permanently deletes. Callers that want a recoverable delete must relocate
   * the item first and record a `TrashItem` (plan.md §25).
   */
  delete(uri: string, options?: { signal?: CancelSignal }): Promise<void>;

  /**
   * Total bytes beneath `uri`, or `null` when it cannot be determined cheaply.
   *
   * Directories are expensive to measure (plan.md §19), so implementations are
   * expected to return `null` rather than block, and to expose an async
   * measuring path instead.
   */
  getSize(uri: string): Promise<number | null>;

  /** A URI suitable for handing to another app via an intent (plan.md §14). */
  toShareableUri(uri: string): Promise<string>;

  /**
   * A `file://` path for libraries that cannot read `content://` URIs —
   * image decoders, hashers, archive readers. Returns `null` when the provider
   * has no local path, which callers must handle rather than assume away.
   */
  toLocalPath(uri: string): Promise<string | null>;
}

/** Throws `UNSUPPORTED` unless the provider advertises the capability. */
export function assertCapability(
  provider: StorageProvider,
  capability: keyof ProviderCapabilities,
  action: string,
): void {
  if (!provider.capabilities[capability]) {
    throw new Error(`${action} is not supported by the ${provider.id} storage provider.`);
  }
}
