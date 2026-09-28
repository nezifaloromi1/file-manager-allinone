import { AppError, toAppError } from '#/core/errors';
import { type FileItem } from '#/domain/models/fileItem';
import {
  type TrashItem,
  isRestorable,
  selectExpiredTrash,
  totalTrashSize,
  trashRootFor,
  trashTargetNameFor,
} from '#/domain/models/trash';
import { type StorageProvider } from '#/domain/storage/StorageProvider';

/**
 * The trash flow: delete, restore, purge, sweep (plan.md §25).
 *
 * ## Why the dependencies are injected
 *
 * `data/trash.ts` binds these to the real native modules and the real record
 * store. Everything here takes them as arguments, so the interesting decisions —
 * when a delete falls back to being permanent, whether a batch survives one
 * failure, when a restore must refuse rather than invent a destination — can be
 * checked against a fake, on a machine with no Android.
 *
 * That matters more here than elsewhere. The alternative is what this file
 * previously was: a complete second implementation of move and restore that
 * nothing called, tested separately, and quietly diverging. Two implementations
 * of something destructive is worse than none, because the dead one reads as
 * though the case is handled.
 *
 * ## Why the trash lives in app-private storage
 *
 * A hidden `.trash` on the user's own volume is confusing to look at, gets
 * swept up by "clear Downloads", and is not writable on every provider. App
 * storage always is, and is removed with the install, so the retention promise
 * cannot silently outlive the app. The cost — a trashed file occupies the user's
 * storage until it is purged — is stated in the UI, not only here.
 */

export type TrashDeps = {
  /** The app's private document directory, slash-terminated. */
  documentUri: string;
  /** The provider that owns the trash itself, whatever the file's origin was. */
  trash: StorageProvider;
  /**
   * Bytes from one filesystem backend to another. A whole-file read, which is
   * why `MAX_TRASH_RELOCATE_BYTES` exists and why callers check it.
   */
  transfer: (sourceUri: string, destinationUri: string) => Promise<void>;
  /**
   * The provider that owns a URI. Injected rather than imported so this module
   * stays free of `expo-file-system` — and so a restore can be checked against a
   * fake local/SAF pair.
   */
  providerForUri: (uri: string) => StorageProvider;
  listRecords: () => Promise<TrashItem[]>;
  addRecord: (record: TrashItem) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
};

export type TrashOutcome = {
  /** Items whose bytes were moved into the trash. */
  trashed: number;
  /** Items deleted for good, because the trash was off or could not hold them. */
  deleted: number;
  failed: number;
  /**
   * Names of items that were too large to relocate and were deleted instead.
   * Surfaced so the UI can say so: a user told "moved to trash" is wrong about
   * this one file, and it is the file they cared about.
   */
  tooLarge: string[];
};

/**
 * Deletes a selection, through the trash when it is enabled.
 *
 * Falls back to a permanent delete rather than failing, because a user who asked
 * to delete something still wants it gone. Every such case is counted, so the
 * caller can report it rather than implying everything was recoverable.
 */
export async function trashOrDelete(
  items: readonly FileItem[],
  provider: StorageProvider,
  options: { useTrash: boolean; deps: TrashDeps },
): Promise<TrashOutcome> {
  const outcome: TrashOutcome = { trashed: 0, deleted: 0, failed: 0, tooLarge: [] };
  if (items.length === 0) return outcome;

  if (!options.useTrash || !provider.capabilities.canRelocateToTrash) {
    for (const item of items) {
      try {
        await provider.delete(item.uri);
        outcome.deleted += 1;
      } catch {
        outcome.failed += 1;
      }
    }
    return outcome;
  }

  const { deps } = options;
  const root = trashRootFor(deps.documentUri);

  for (const item of items) {
    // Re-read per item: two files with the same name in one selection must not
    // collide with each other inside the trash, and the existing records are
    // exactly what the name allocator checks.
    const existing = await deps.listRecords();

    try {
      if (item.isDirectory && !(await deps.trash.exists(root))) {
        await deps.trash.createDirectory(deps.documentUri, '.trash');
      }

      if (item.isDirectory && !provider.capabilities.canMove) {
        // A directory cannot be transferred file by file, and SAF cannot move
        // one. Trashing a SAF folder would mean walking and recreating it, which
        // loses everything `expo-file-system` does not model — hidden flags,
        // exact timestamps, symlinks. Deleted permanently, and counted.
        await provider.delete(item.uri);
        outcome.deleted += 1;
        continue;
      }

      const targetName = trashTargetNameFor(
        { originalName: item.name, originalUri: item.uri },
        existing,
      );
      const targetUri = `${root}${targetName}`;

      // Bytes are relocated *before* the record is written, so a crash between
      // the two leaves an orphan file — harmless, and reclaimable by the next
      // sweep — rather than a record pointing at nothing.
      if (provider.capabilities.canMove) {
        await provider.move(item.uri, root, {
          targetName,
          onConflict: async () => 'REPLACE',
        });
      } else {
        await deps.transfer(item.uri, targetUri);
        // The original goes only after the copy is safely written, so a transfer
        // failure leaves the user's file exactly where it was.
        await provider.delete(item.uri);
      }

      await deps.addRecord(createTrashRecord(item, targetUri));
      outcome.trashed += 1;
    } catch (error) {
      const appError = toAppError(error, { operation: 'trash', uri: item.uri });
      if (appError.code === 'UNSUPPORTED') {
        // Too large to relocate. Delete for good rather than leaving the user
        // with a failed delete and an untouched selection.
        try {
          await provider.delete(item.uri);
          outcome.deleted += 1;
          outcome.tooLarge.push(item.name);
        } catch {
          outcome.failed += 1;
        }
      } else {
        // A single failure must not abandon the rest of the batch. Deleting 20
        // files and stopping at the first locked one leaves a partial delete the
        // user neither asked for nor can predict.
        outcome.failed += 1;
      }
    }
  }

  return outcome;
}

/**
 * Puts one trashed item back.
 *
 * The record is dropped only after the bytes are safely back, so a failed
 * restore leaves the item recoverable rather than losing it.
 */
export async function restoreItem(record: TrashItem, deps: TrashDeps): Promise<FileItem> {
  if (!isRestorable(record)) {
    throw new AppError('NOT_FOUND', { message: 'This item is no longer in the trash.' });
  }

  // The original folder may have been a SAF grant, in which case its URI is
  // `content://` and only the SAF provider can write to it. The trash copy is
  // always local.
  const destination = deps.providerForUri(record.originalParentUri);
  const name = record.originalName;

  let restored: FileItem;
  try {
    if (destination.capabilities.canMove) {
      // Straight move: the trash copy and the original folder share a backend.
      restored = await destination.move(record.trashUri, record.originalParentUri, {
        targetName: name,
        onConflict: async () => 'REPLACE',
      });
    } else {
      // Cross-backend: app-private storage back into the granted folder. SAF
      // cannot move or copy, so the bytes are transferred and the staged copy is
      // deleted only once the destination write has been read back.
      if (record.isDirectory) {
        throw new AppError('UNSUPPORTED', {
          message: 'Folders granted through the system picker cannot be restored in place.',
          hint: 'The folder was deleted permanently when it was trashed.',
        });
      }

      if (!(await destination.exists(record.originalParentUri))) {
        throw new AppError('NOT_FOUND', {
          message: 'The original folder is no longer available.',
          hint: 'Grant access to that folder again, then restore.',
        });
      }

      const targetUri = `${record.originalParentUri}${name}`;
      await deps.transfer(record.trashUri, targetUri);

      // Read back rather than assuming the write landed. A SAF write can report
      // success and leave nothing readable, and a record dropped on that basis
      // would be the only copy of the file, gone.
      const created = await destination.getMetadata(targetUri);
      if (!created) {
        throw new AppError('UNKNOWN', {
          message: 'The restored file could not be read back.',
          hint: 'Check the folder before deleting this trash entry.',
        });
      }

      await deps.trash.delete(record.trashUri);
      restored = created;
    }
  } catch (error) {
    throw toAppError(error, { operation: 'restore', trashUri: record.trashUri });
  }

  await deps.removeRecord(record.id);
  return restored;
}

/**
 * Removes a trashed item's bytes for good.
 *
 * The existence check is not an optimisation: a record can outlive its bytes —
 * the OS reclaimed the space, or the item was restored elsewhere — and a
 * `delete()` on a missing file throws, which would abort the rest of an
 * "empty trash" and leave the screen permanently non-empty.
 */
export async function purgeFromTrash(provider: StorageProvider, record: TrashItem): Promise<void> {
  try {
    if (await provider.exists(record.trashUri)) {
      await provider.delete(record.trashUri);
    }
  } catch (error) {
    throw toAppError(error, { operation: 'purge', trashUri: record.trashUri });
  }
}

/**
 * Purges anything past its retention.
 *
 * ## Why this is called at launch and not on a timer
 *
 * "Deleted after 30 days" is a promise, and a promise needs something that
 * checks. On Android a timer is not that: Doze defers it, process death cancels
 * it, a force-stopped app never runs it. A timer would make retention true only
 * on devices that happen to stay in the foreground — exactly the devices whose
 * owner is not worried about it. Running on launch means the trash is
 * guaranteed to shrink, and no background work is claimed that the OS will not
 * honour.
 *
 * A record whose bytes cannot be removed is still dropped. The user asked for
 * retention, the bytes are unreachable, and a record that can never be purged is
 * a permanent entry on a screen meant to empty itself.
 */
export async function sweepExpired(
  retentionDays: number,
  deps: TrashDeps,
  now = Date.now(),
): Promise<number> {
  const expired = selectExpiredTrash(await deps.listRecords(), retentionDays, now);

  let purged = 0;
  for (const record of expired) {
    try {
      await purgeFromTrash(deps.trash, record);
      purged += 1;
    } catch {
      // Swallowed on purpose — see above.
    }
    await deps.removeRecord(record.id);
  }
  return purged;
}

/** Records a trashed item. */
export function createTrashRecord(item: FileItem, trashUri: string, now = Date.now()): TrashItem {
  return {
    id: item.id,
    originalUri: item.uri,
    originalName: item.name,
    trashUri,
    originalParentUri: item.parentUri,
    isDirectory: item.isDirectory,
    size: item.size,
    deletedAt: now,
    provider: item.provider,
    mimeType: item.mimeType,
    state: 'STORED',
    reason: null,
  };
}

export { totalTrashSize, trashRootFor };
