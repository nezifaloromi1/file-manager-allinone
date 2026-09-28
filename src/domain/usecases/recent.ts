import { type FileItem } from '#/domain/models/fileItem';
import { type StorageProvider } from '#/domain/storage/StorageProvider';

/**
 * Resolving a stored record back into a live `FileItem` (plan.md §26, §27, §28).
 *
 * Favourites, recent files, and trash entries are *pointers*. The filesystem is
 * the source of truth, so every one of them can be stale: the user deleted the
 * file in another app, renamed the folder, or revoked a SAF grant. Nothing here
 * may crash or invent data — a dead pointer is dropped, and the caller prunes it.
 */

/**
 * Re-reads one record, reporting staleness rather than throwing.
 *
 * Returns `null` when the item is gone, which is the same signal as a throw: a
 * revoked SAF grant cannot be distinguished from a deleted file, and both mean
 * "this record is dead".
 */
export async function resolveStoredItem(
  provider: StorageProvider,
  uri: string,
): Promise<FileItem | null> {
  try {
    return await provider.getMetadata(uri);
  } catch {
    return null;
  }
}

/**
 * Resolves many records concurrently, in bounded batches.
 *
 * `Promise.all` over a 100-item recent list would fire 100 native calls at once
 * and can exhaust file descriptors on a large volume, so this walks in small
 * batches. Preserves input order so the caller can map results back.
 */
export async function resolveStoredItems(
  provider: StorageProvider,
  uris: readonly string[],
  batchSize = 8,
): Promise<(FileItem | null)[]> {
  const results: (FileItem | null)[] = new Array(uris.length).fill(null);

  for (let start = 0; start < uris.length; start += batchSize) {
    const batch = uris.slice(start, start + batchSize);
    const resolved = await Promise.all(
      batch.map(async (uri) => {
        try {
          return await provider.getMetadata(uri);
        } catch {
          return null;
        }
      }),
    );
    resolved.forEach((item, index) => {
      results[start + index] = item;
    });
  }

  return results;
}

/**
 * Whether a stored record is still usable, without a full metadata read.
 *
 * Cheaper than resolving, so the favourites list can stay responsive; the
 * details screen does the full read.
 */
export async function isStillPresent(provider: StorageProvider, uri: string): Promise<boolean> {
  try {
    return await provider.exists(uri);
  } catch {
    return false;
  }
}
