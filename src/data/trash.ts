import { type FileItem } from '#/domain/models/fileItem';
import { type StorageProvider } from '#/domain/storage/StorageProvider';
import {
  type TrashItem,
  isTrashedIn,
  selectExpiredTrash,
  totalTrashSize,
  trashRootFor,
} from '#/domain/models/trash';
import {
  type TrashDeps,
  type TrashOutcome,
  createTrashRecord,
  purgeFromTrash,
  restoreItem as restoreItemWith,
  sweepExpired as sweepExpiredWith,
  totalTrashSize as sumTrashSize,
  trashOrDelete as trashOrDeleteWith,
} from '#/domain/usecases/trash';
import { appDocumentUri, localProvider, providerForUri, transferFile } from '#/data/storage';
import { settingsRepository, trashRepository } from '#/data/repositories';

/**
 * The trash, bound to the real device (plan.md §25).
 *
 * ## Why this file is so thin
 *
 * The flow — when a delete falls back to being permanent, whether a batch
 * survives one failure, when a restore must refuse rather than invent a
 * destination — lives in `domain/usecases/trash.ts` and takes its dependencies
 * as arguments. This file's only job is to supply them: the native filesystem,
 * the cross-backend transfer, and the record store.
 *
 * That is what makes the flow checkable. The version this replaces held a
 * complete second implementation of move and restore that nothing called,
 * which had already drifted from the live one — two `trashTargetNameFor`
 * functions with different collision rules, neither of them reachable.
 */

/** The trash's location, for display and for tests that need the real one. */
export function trashRootUri(): string {
  return trashRootFor(appDocumentUri());
}

/** True when a URI lives inside the trash. */
export function isTrashedUri(uri: string): boolean {
  return isTrashedIn(uri, appDocumentUri());
}

function realDeps(): TrashDeps {
  return {
    documentUri: appDocumentUri(),
    // The trash is always a `file://` path in app storage, even for items that
    // arrived over SAF, so the local provider is always the right one.
    trash: localProvider(),
    transfer: (sourceUri, destinationUri) => transferFile(sourceUri, destinationUri),
    providerForUri,
    listRecords: () => trashRepository.list(),
    addRecord: (record) => trashRepository.add(record),
    removeRecord: (id) => trashRepository.remove(id),
  };
}

/** Deletes a selection, through the trash when it is enabled. */
export async function trashOrDelete(
  items: readonly FileItem[],
  provider: StorageProvider,
  options: { useTrash: boolean },
): Promise<TrashOutcome> {
  return trashOrDeleteWith(items, provider, { useTrash: options.useTrash, deps: realDeps() });
}

/** Puts one trashed item back where it came from. */
export async function restoreItem(record: TrashItem): Promise<FileItem> {
  return restoreItemWith(record, realDeps());
}

/** Deletes one trashed item for good: bytes, then record. */
export async function purgeItem(record: TrashItem): Promise<void> {
  await purgeFromTrash(localProvider(), record);
  await trashRepository.remove(record.id);
}

/**
 * Empties the trash.
 *
 * Every record is attempted; the store is cleared regardless. A file the OS
 * will not delete — held open, or on a card that has gone away — cannot be
 * purged, and keeping its record would show a ghost on a screen whose whole
 * purpose is to empty itself.
 */
export async function emptyTrash(): Promise<number> {
  const records = await trashRepository.list();
  let purged = 0;

  for (const record of records) {
    try {
      await purgeFromTrash(localProvider(), record);
      purged += 1;
    } catch {
      // Unreachable bytes; the record still goes.
    }
  }

  await trashRepository.clear();
  return purged;
}

export type TrashSummary = {
  items: TrashItem[];
  count: number;
  bytes: number;
  isEmpty: boolean;
};

export async function trashSummary(): Promise<TrashSummary> {
  const items = await trashRepository.list();
  return { items, count: items.length, bytes: totalTrashSize(items), isEmpty: items.length === 0 };
}

/**
 * Enforces the retention window. Called once at launch, never on a timer —
 * see the reasoning on `sweepExpired` in the domain module.
 */
export async function sweepExpired(): Promise<number> {
  const settings = await settingsRepository.get();
  return sweepExpiredWith(settings.trashRetentionDays, realDeps());
}

export {
  createTrashRecord,
  purgeFromTrash,
  selectExpiredTrash,
  sumTrashSize as totalTrashSize,
  trashRootFor,
};
export type { TrashDeps, TrashOutcome };
