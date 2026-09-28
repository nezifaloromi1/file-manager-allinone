import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AppError, describeError } from '#/core/errors';
import { type FileItem } from '#/domain/models/fileItem';
import {
  type ConflictPolicy,
  type FileOperation,
  createOperation,
  isTerminal,
  transition,
  withProgress,
} from '#/domain/models/operation';
import { type StorageProvider } from '#/domain/storage/StorageProvider';
import { trashOrDelete } from '#/data/trash';
import {
  type TransferResult,
  createConflictResolver,
  executeTransfer,
  planTransfer,
} from '#/domain/usecases/transfer';

/**
 * The operation queue (plan.md §22, §23, §48).
 *
 * Copying 5 GB is not something a component can await, so every operation is a
 * first-class record with its own lifecycle, and this store is the single owner
 * of them. Screens observe; they never own. That is what lets a user navigate
 * away mid-copy and come back to a progress bar — a component-local `useState`
 * could never do that.
 *
 * ## Why cancellation is a flag and not an exception
 *
 * `expo-file-system` has no cancellation hook mid-file, so `streamCopy` checks a
 * `CancelSignal` between chunks and cancelling takes effect at the next chunk
 * boundary. An exception would unwind through the provider and look like a
 * failure; a flag lets the copy finish its current chunk, delete the partial
 * file, and report `CANCELLED`, which is what actually happened.
 *
 * ## Why operations are serialised
 *
 * Several multi-gigabyte copies at once contend for the same I/O and finish
 * slower overall, and one honest progress number beats five racing ones. A
 * promise chain serialises them; a second copy waits rather than interleaving.
 *
 * ## Why planning happens before queueing
 *
 * `planTransfer` resolves every name collision up front, so a 12-item copy
 * cannot half-finish and then discover a collision on the last file
 * (plan.md §24).
 */

export type OperationResult = {
  completed: number;
  failed: number;
  skipped: number;
};

/**
 * What a delete actually did, which is not the same as what it was asked to do.
 *
 * `trashed` and `deleted` are kept apart because only one of them is
 * recoverable, and the UI has to be able to say which happened to *this* file —
 * a user who is told "moved to trash" and then cannot restore it has been lied
 * to, which is the exact failure Phase 10 was opened to fix.
 */
export type DeleteResult = {
  /** Items that are gone from the source location. */
  completed: number;
  failed: number;
  trashed: number;
  deleted: number;
  /** Items too large to relocate, so they were deleted instead. */
  tooLarge: string[];
};

export type OperationEntry = {
  operation: FileOperation;
  /** Set once the operation settles, for the summary line. */
  result: OperationResult | null;
};

export type QueueState = 'idle' | 'running';

export type StartTransferInput = {
  kind: 'copy' | 'move';
  items: readonly FileItem[];
  destinationUri: string;
  provider: StorageProvider;
  /** Asked once per collision, or once per batch when the user picks Apply to all. */
  askConflict: (name: string, item: FileItem) => Promise<ConflictPolicy>;
};

type OperationsContextValue = {
  entries: readonly OperationEntry[];
  state: QueueState;
  /** The operation currently consuming I/O, if any. */
  active: FileOperation | null;
  /** Operations that have neither finished nor been cancelled. */
  pendingCount: number;
  startTransfer: (input: StartTransferInput) => Promise<TransferResult | null>;
  /**
   * Deletes a selection as a queued operation, through the trash when enabled.
   *
   * Queued rather than run inline for the same reason copies are: a delete of 200
   * files must be visible in the Operations screen and must run *after* anything
   * already in flight, not race it.
   */
  deleteItems: (
    items: readonly FileItem[],
    provider: StorageProvider,
    options: { useTrash: boolean },
  ) => Promise<DeleteResult>;
  cancel: (id: string) => void;
  clearFinished: () => void;
};

const OperationsContext = createContext<OperationsContextValue | null>(null);

/** Monotonic per-session id. Avoids `Date.now()` collisions for rapid starts. */
let operationCounter = 0;
function nextOperationId(): string {
  operationCounter += 1;
  return `op-${Date.now().toString(36)}-${operationCounter}`;
}

export function OperationsProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly OperationEntry[]>([]);

  // Cancellation lives in a ref, not state: the streaming loop reads it between
  // chunks and must not trigger a re-render or re-subscribe on every check.
  const cancelled = useRef(new Set<string>());

  // Serialises execution. Each run appends to this chain, so operations execute
  // in the order they were queued.
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const patch = useCallback((id: string, update: (entry: OperationEntry) => OperationEntry) => {
    setEntries((current) =>
      current.map((entry) => (entry.operation.id === id ? update(entry) : entry)),
    );
  }, []);

  const startTransfer = useCallback<OperationsContextValue['startTransfer']>(
    async ({ kind, items, destinationUri, provider, askConflict }) => {
      if (items.length === 0) return null;

      const plan = await planTransfer(
        provider,
        items,
        destinationUri,
        kind,
        createConflictResolver(askConflict),
      );

      // Every item was skipped or the user cancelled during planning; there is
      // nothing to run, and an empty operation row would be noise.
      if (plan.entries.length === 0) return null;

      const id = nextOperationId();
      const label = `${kind === 'copy' ? 'Copying' : 'Moving'} ${plan.entries.length} ${
        plan.entries.length === 1 ? 'item' : 'items'
      }`;

      const operation = createOperation({
        id,
        kind,
        itemUris: plan.entries.map((entry) => entry.item.uri),
        label,
        destinationUri,
      });

      setEntries((current) => [...current, { operation, result: null }]);

      const run = async (): Promise<TransferResult> => {
        patch(id, (entry) => ({ ...entry, operation: transition(entry.operation, 'RUNNING') }));

        const result = await executeTransfer(provider, plan, {
          signal: {
            get isCancelled() {
              return cancelled.current.has(id);
            },
          },
          onProgress: (transferred, total) => {
            patch(id, (entry) => ({
              ...entry,
              operation: withProgress(entry.operation, transferred, total),
            }));
          },
        });

        if (cancelled.current.has(id)) {
          patch(id, (entry) => ({ ...entry, operation: transition(entry.operation, 'CANCELLED') }));
        } else if (result.failed.length > 0) {
          patch(id, (entry) => ({
            ...entry,
            operation: transition(entry.operation, 'FAILED', {
              error: describeError(result.failed[0].error),
              // The bar cannot be trusted to have reached 1; showing a full bar
              // on a failed copy would be a lie.
              progress: { ratio: 0, transferred: 0, total: null },
            }),
          }));
        } else {
          patch(id, (entry) => ({
            ...entry,
            operation: transition(entry.operation, 'COMPLETED'),
          }));
        }

        const summary: OperationResult = {
          completed: result.completed.length,
          failed: result.failed.length,
          skipped: result.skipped.length,
        };
        patch(id, (entry) => ({ ...entry, result: summary }));
        return result;
      };

      let resolveResult: (value: TransferResult | null) => void = () => {};
      const resultPromise = new Promise<TransferResult | null>((resolve) => {
        resolveResult = resolve;
      });

      // Append to the chain so this operation runs *after* anything already
      // queued. The chain never rejects: a failed operation must not poison
      // every operation queued behind it.
      chain.current = chain.current
        .then(run)
        .catch((error: unknown) => {
          patch(id, (entry) => ({
            ...entry,
            operation: transition(entry.operation, 'FAILED', {
              error: describeError(error),
              progress: { ratio: 0, transferred: 0, total: null },
            }),
          }));
        })
        .then((settled) => {
          resolveResult((settled as TransferResult | undefined) ?? null);
        });

      return resultPromise;
    },
    [patch],
  );

  const deleteItems = useCallback<OperationsContextValue['deleteItems']>(
    async (items, provider, { useTrash }) => {
      if (items.length === 0) {
        return { completed: 0, failed: 0, trashed: 0, deleted: 0, tooLarge: [] };
      }

      const id = nextOperationId();
      const label = `Deleting ${items.length} ${items.length === 1 ? 'item' : 'items'}`;

      setEntries((current) => [
        ...current,
        {
          operation: createOperation({
            id,
            kind: 'delete',
            itemUris: items.map((item) => item.uri),
            label,
          }),
          result: null,
        },
      ]);

      const run = async (): Promise<DeleteResult> => {
        patch(id, (entry) => ({ ...entry, operation: transition(entry.operation, 'RUNNING') }));

        // `trashOrDelete` never throws per item: it counts failures so a batch
        // completes with a partial result the UI can report, rather than stopping
        // at the first locked file and leaving an unpredictable half-delete.
        const outcome = await trashOrDelete(items, provider, { useTrash });

        const completed = outcome.trashed + outcome.deleted;
        if (outcome.failed > 0) {
          patch(id, (entry) => ({
            ...entry,
            operation: transition(entry.operation, 'FAILED', {
              error: describeError(
                new AppError('IN_USE', {
                  message: `Could not delete ${outcome.failed} of ${items.length} items.`,
                  hint: 'Another app may have some of them open.',
                }),
              ),
            }),
          }));
        } else {
          patch(id, (entry) => ({
            ...entry,
            operation: transition(entry.operation, 'COMPLETED'),
          }));
        }

        const result: DeleteResult = {
          completed,
          failed: outcome.failed,
          trashed: outcome.trashed,
          deleted: outcome.deleted,
          tooLarge: outcome.tooLarge,
        };
        patch(id, (entry) => ({
          ...entry,
          result: { completed, failed: outcome.failed, skipped: 0 },
        }));
        return result;
      };

      // Appended to the same chain as transfers so a delete cannot interleave
      // with a copy of the same files.
      let resolveResult: (value: DeleteResult) => void = () => {};
      const resultPromise = new Promise<DeleteResult>((resolve) => {
        resolveResult = resolve;
      });

      chain.current = chain.current.then(run).then((value) => {
        resolveResult(value);
        return value;
      });

      return resultPromise;
    },
    [patch],
  );

  const cancel = useCallback(
    (id: string) => {
      cancelled.current.add(id);
      patch(id, (entry) => {
        if (isTerminal(entry.operation.state)) return entry;
        return { ...entry, operation: transition(entry.operation, 'CANCELLED') };
      });
    },
    [patch],
  );

  const clearFinished = useCallback(() => {
    setEntries((current) => current.filter((entry) => !isTerminal(entry.operation.state)));
  }, []);

  const active = useMemo(
    () => entries.find((entry) => entry.operation.state === 'RUNNING')?.operation ?? null,
    [entries],
  );

  // Derived, never set by hand: a hand-maintained flag races with the chain and
  // can report `idle` while a queued operation is still waiting to start.
  const state: QueueState = active ? 'running' : 'idle';

  const pendingCount = useMemo(
    () => entries.filter((entry) => !isTerminal(entry.operation.state)).length,
    [entries],
  );

  const value = useMemo<OperationsContextValue>(
    () => ({
      entries,
      state,
      active,
      pendingCount,
      startTransfer,
      deleteItems,
      cancel,
      clearFinished,
    }),
    [active, cancel, clearFinished, deleteItems, entries, pendingCount, startTransfer, state],
  );

  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}

export function useOperations(): OperationsContextValue {
  const value = useContext(OperationsContext);
  if (!value) {
    throw new AppError('UNKNOWN', {
      message: 'useOperations must be used inside an OperationsProvider.',
    });
  }
  return value;
}
