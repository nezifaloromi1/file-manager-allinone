import { type FileItem } from '#/domain/models/fileItem';

/**
 * The transfer the user has started but not yet aimed.
 *
 * A tiny module-level store, and deliberately not React state.
 *
 * Copy and move are a two-step gesture — pick the items, then pick a
 * destination — and the two steps happen on two different screens. Passing the
 * selection through route params means serialising `FileItem[]` into a URL (or
 * threading a callback through the navigation tree, which the browser behind
 * the picker may be re-created and lose).
 *
 * It is cleared as soon as a transfer starts, so a stale selection can never be
 * picked up by an unrelated later copy.
 */

export type TransferMode = 'copy' | 'move';

type PendingTransfer = {
  mode: TransferMode;
  items: readonly FileItem[];
};

let pending: PendingTransfer | null = null;

export function setPendingTransfer(mode: TransferMode, items: readonly FileItem[]): void {
  pending = { mode, items: [...items] };
}

export function takePendingTransfer(): PendingTransfer | null {
  const current = pending;
  // Cleared on read, not on success: an abandoned picker should not leave a
  // selection armed for the next copy.
  pending = null;
  return current;
}

export function peekPendingTransfer(): PendingTransfer | null {
  return pending;
}

export function clearPendingTransfer(): void {
  pending = null;
}
