import { Directory, File, Paths } from 'expo-file-system';

import { AppError, toAppError } from '#/core/errors';
import { type ConflictPolicy } from '#/domain/models/operation';
import { MAX_TRASH_RELOCATE_BYTES } from '#/domain/models/trash';
import {
  type CancelSignal,
  NEVER_CANCELLED,
  type ProgressReporter,
} from '#/domain/storage/StorageProvider';

/**
 * The one place that knows `expo-file-system` exists.
 *
 * Everything above this file speaks in `FileItem` and provider methods; nothing
 * above it imports `expo-file-system`. That is the practical payoff of plan §9
 * — swapping the backend, or supporting a second one, touches this adapter and
 * nothing else.
 *
 * ## Why these two classes are separate
 *
 * `LocalStorageProvider` and `SafStorageProvider` look almost identical from the
 * outside but are not interchangeable underneath:
 *
 * - `file://` paths go through `java.io.File`, so copy/move/rename work.
 * - `content://` URIs go through `DocumentFile`, and `copy()`, `move()`, and
 *   `rename()` **throw** `"This method cannot be used with content URIs"` because
 *   all three route through a `javaFile` accessor that refuses content URIs
 *   (`expo-file-system/android/.../FileSystemPath.kt`).
 *
 * Rather than let that surface as a runtime crash, `SafStorageProvider` reports
 * `canRename/canCopy/canMove: false` and the UI disables those actions with an
 * explanation. `create()` is likewise unavailable on SAF — `createDirectory()`
 * and `createFile()` are the supported calls.
 */

/** Resolves an item URI to the right `expo-file-system` class. */
export function toFileSystemObject(uri: string): File | Directory {
  // `Directory` needs a trailing slash to be recognised as a directory; callers
  // pass directory URIs with one, but normalise defensively rather than throw.
  const isDirectoryUri = uri.endsWith('/') || uri.endsWith(':');
  return isDirectoryUri ? new Directory(uri) : new File(uri);
}

/** Normalises a URI to the canonical form: directories end in `/`. */
export function normalizeDirectoryUri(uri: string): string {
  if (uri.endsWith('/')) return uri;
  return `${uri}/`;
}

export type EntryTimestamps = {
  modifiedAt: number | null;
  createdAt: number | null;
};

/**
 * Reads timestamps off a `File` or `Directory`.
 *
 * The two classes disagree: `File` exposes `modificationTime` / `creationTime`
 * as properties, while `Directory` only exposes them through `info()`. Both
 * return `null` below Android API 26 for creation time, which is surfaced as
 * `null` rather than a fabricated epoch.
 */
export function readTimestamps(entry: File | Directory, isDirectory: boolean): EntryTimestamps {
  try {
    if (isDirectory) {
      const info = (entry as Directory).info();
      return {
        modifiedAt: info.modificationTime ?? null,
        createdAt: info.creationTime ?? null,
      };
    }
    const file = entry as File;
    return {
      modifiedAt: file.modificationTime ?? null,
      createdAt: file.creationTime ?? null,
    };
  } catch {
    // Metadata is best-effort: an unreadable timestamp must not fail a listing.
    return { modifiedAt: null, createdAt: null };
  }
}

// Paths live in ./paths, which has no native imports, so consumers that only
// need a URI string do not pull in `expo-file-system` transitively.
export { INTERNAL_STORAGE_URI, WELL_KNOWN_DIRECTORIES, volumeRootFor } from './paths';

export type { ConflictPolicy };

/**
 * Total and free bytes on the primary volume.
 *
 * `Paths.totalDiskSpace` / `Paths.availableDiskSpace` report the internal
 * volume, not the SD card, so a second volume's numbers come from its own
 * provider rather than being faked from these.
 */
export function readDiskSpace(): { total: number | null; available: number | null } {
  try {
    return { total: Paths.totalDiskSpace, available: Paths.availableDiskSpace };
  } catch {
    // Some emulators and scoped-storage configurations refuse this. Degrade to
    // "unknown" rather than crashing the storage screen.
    return { total: null, available: null };
  }
}

/**
 * The app's private document directory, where the trash lives.
 *
 * Already slash-terminated by `Paths.document`, which is the convention every
 * directory URI here follows — `Directory` needs it, and `isDirectoryUri` in
 * `toFileSystemObject` tests for it.
 */
export function appDocumentUri(): string {
  return Paths.document.uri;
}

/**
 * Copies a file across filesystem backends, byte for byte.
 *
 * ## Why this exists at all
 *
 * `copy()`, `move()`, `rename()`, and `open()` all route through a `javaFile`
 * accessor that refuses `content://` URIs. So a `content://` file and a
 * `file://` path cannot be streamed between each other, and the only route left
 * is `File.bytes()` plus `File.write()` — which goes through an input/output
 * stream and therefore *does* work on a SAF URI.
 *
 * The cost is that the whole file is in memory at once, which is why
 * `MAX_TRASH_RELOCATE_BYTES` exists and why this is not the general copy path.
 *
 * ## Ordering
 *
 * The source is read in full before the destination is touched, so a read
 * failure cannot leave a truncated file that looks complete. The size is
 * re-checked after the read, because a file that grew between the stat and the
 * read would otherwise be written out having silently lost its tail.
 */
export async function transferFile(
  sourceUri: string,
  destinationUri: string,
  options: { signal?: CancelSignal } = {},
): Promise<void> {
  const source = new File(sourceUri);
  const destination = new File(destinationUri);
  const signal = options.signal ?? NEVER_CANCELLED;

  const size = source.size ?? 0;
  if (size > MAX_TRASH_RELOCATE_BYTES) {
    throw new AppError('UNSUPPORTED', {
      message: 'This file is too large to move into the trash.',
      hint: 'Files over 150 MB are deleted permanently instead.',
    });
  }

  let bytes: Uint8Array;
  try {
    bytes = await source.bytes();
  } catch (error) {
    throw toAppError(error, { operation: 'readForTransfer', uri: sourceUri });
  }

  if (signal.isCancelled) {
    throw new AppError('ABORTED');
  }

  if (size > 0 && bytes.byteLength !== size) {
    // Another app is writing to the file. Refusing is the honest answer: writing
    // out a prefix would silently lose the tail.
    throw new AppError('IN_USE', {
      message: 'This file is being changed by another app.',
      hint: 'Close the other app and try again.',
    });
  }

  try {
    destination.create({ intermediates: true, overwrite: true });
    destination.write(bytes);
  } catch (error) {
    // A partial destination is worse than none: it looks like a real file.
    try {
      if (destination.exists) destination.delete();
    } catch {
      // Best-effort cleanup; the original error is the one that matters.
    }
    throw toAppError(error, { operation: 'writeForTransfer', uri: destinationUri });
  }
}

/** Resolves a conflict callback into a decision, defaulting to KEEP_BOTH. */
export async function askConflict(
  onConflict: ((name: string) => Promise<ConflictPolicy>) | undefined,
  name: string,
): Promise<ConflictPolicy> {
  if (!onConflict) return 'KEEP_BOTH';
  return onConflict(name);
}

/**
 * Streams a copy with progress, checking cancellation between chunks.
 *
 * plan.md §47: "Never load a huge file entirely into memory just to copy it."
 * `expo-file-system` already streams, but it offers no cancellation hook
 * mid-file, so this reads and writes in fixed-size chunks and abandons the
 * partial destination when cancelled — a half-written 4 GB file left behind is
 * worse than a clean failure.
 */
export const COPY_CHUNK_BYTES = 1024 * 1024;

export async function streamCopy(
  source: File,
  destination: File,
  options: { onProgress?: ProgressReporter; signal?: CancelSignal; overwrite: boolean } = {
    overwrite: true,
  },
): Promise<void> {
  const signal = options.signal ?? NEVER_CANCELLED;
  const total = source.size;

  try {
    if (!options.overwrite && destination.exists) {
      throw new AppError('ALREADY_EXISTS');
    }
    if (destination.exists) {
      destination.delete();
    }

    destination.create({ intermediates: true, overwrite: true });

    // Two handles, deliberately. A `FileHandle` wraps a single `FileChannel`
    // with one shared position, so reading and writing through the same handle
    // would write each chunk at the offset the read just advanced past — quietly
    // producing a corrupt file. The source handle reads, the destination handle
    // writes, and each keeps its own cursor.
    const reader = source.open();
    const writer = destination.open();
    let transferred = 0;

    try {
      for (;;) {
        if (signal.isCancelled) {
          throw new AppError('ABORTED');
        }
        // `readBytes` returns at most the remaining bytes, so the final chunk
        // is short rather than zero-padded, and an empty read means EOF.
        const chunk = reader.readBytes(COPY_CHUNK_BYTES);
        if (chunk.byteLength === 0) break;
        writer.writeBytes(chunk);
        transferred += chunk.byteLength;
        options.onProgress?.(transferred, total);
      }
    } finally {
      // Both always released, or the destination stays locked and cannot be
      // moved or deleted until the app restarts.
      closeQuietly(reader);
      closeQuietly(writer);
    }
  } catch (error) {
    // Do not leave a partial file that looks complete to the user.
    try {
      if (destination.exists) destination.delete();
    } catch {
      // Best-effort cleanup; the original error is the one that matters.
    }
    throw toAppError(error, { operation: 'streamCopy' });
  }
}

/** Releases a handle, ignoring close failures. */
export function closeQuietly(handle: { close: () => void } | null): void {
  if (!handle) return;
  try {
    handle.close();
  } catch {
    // Already closed, or never opened.
  }
}
