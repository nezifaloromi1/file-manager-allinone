import { Alert } from 'react-native';

import { type DeleteResult } from '@/features/operations/OperationsProvider';

/**
 * Reports what a delete actually did, once it has finished.
 *
 * ## Why this cannot be a single "Done" toast
 *
 * A delete is a request, and the outcome is not always the same shape. With the
 * trash on, most items are recoverable; a file over the relocation limit is
 * deleted for good; a file another app holds open fails. A user who is told
 * "moved to trash" and then finds the video gone has been lied to — which is the
 * exact failure this reporting exists to prevent.
 *
 * So the message states the counts, and the two cases that break the promise —
 * something deleted permanently, or something that failed — get their own
 * alert rather than a line in a summary the user has already dismissed.
 */
export function reportDeleteOutcome(result: DeleteResult): void {
  const { completed, failed, trashed, deleted, tooLarge } = result;

  // Nothing happened. No alert: the caller already knows, and an alert for a
  // no-op is noise.
  if (completed === 0 && failed === 0) return;

  if (failed > 0) {
    Alert.alert(
      completed > 0 ? 'Some items could not be deleted' : 'Nothing was deleted',
      failed === 1
        ? 'One item is held open by another app. Close it and try again.'
        : `${failed} items are held open by another app. Close them and try again.`,
    );
    return;
  }

  // Mixed outcome, or everything was permanent. One alert, because two stacked
  // alerts is a dialog the user has to dismiss twice to learn one thing.
  if (deleted > 0) {
    const names =
      tooLarge.length > 0
        ? `${tooLarge.length === 1 ? 'A file' : 'Files'} too large to move to the trash (over 150 MB) were deleted permanently.`
        : 'Some items could not be moved to the trash and were deleted permanently.';

    Alert.alert(
      trashed > 0 ? 'Moved to trash, with exceptions' : 'Deleted permanently',
      trashed > 0
        ? `${trashed} ${trashed === 1 ? 'item is' : 'items are'} in the trash. ${names}`
        : names,
    );
    return;
  }

  // The ordinary case: everything is recoverable. Said explicitly, because the
  // alternative is a user who does not know to look in the trash.
  if (trashed > 0) {
    Alert.alert(
      'Moved to trash',
      `${trashed} ${trashed === 1 ? 'item can' : 'items can'} be restored from Trash.`,
    );
  }
}
