import { formatBytes } from '#/core/utils/format';
import { type ErrorDescription } from '#/core/errors';

/**
 * File operation model and queue (plan.md §22, §23, §24, §48).
 *
 * Copying a 5 GB file is not something a component can await, so every
 * operation is a first-class record with its own lifecycle. The queue is the
 * single source of truth for what is running; screens observe it, they never
 * own it.
 */

export const OPERATION_KINDS = ['copy', 'move', 'delete', 'compress', 'extract'] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

export const OPERATION_STATES = [
  'QUEUED',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export type OperationState = (typeof OPERATION_STATES)[number];

/** States from which no further transition happens. */
export const TERMINAL_STATES: readonly OperationState[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

export function isTerminal(state: OperationState): boolean {
  return TERMINAL_STATES.includes(state);
}

export type OperationProgress = {
  /** 0–1. `0` when the total size is not yet known. */
  ratio: number;
  /** Bytes finished. */
  transferred: number;
  /** Total bytes, or `null` while still being measured. */
  total: number | null;
};

export type FileOperation = {
  id: string;
  kind: OperationKind;
  state: OperationState;
  /** URIs being acted on. Several for a multi-select. */
  itemUris: readonly string[];
  /** Display name for the operation, e.g. `Copying 12 items`. */
  label: string;
  destinationUri: string | null;
  progress: OperationProgress;
  /**
   * Populated when `state` is `FAILED`.
   *
   * Carries the code as well as the wording so the screen can render an
   * `ErrorState` directly, and so a failure is classified rather than being a
   * paragraph of text that has to be re-read to be understood.
   */
  error: ErrorDescription | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
};

/**
 * How to resolve a name collision (plan.md §24).
 *
 * There is deliberately no "overwrite silently" default: "Never silently
 * overwrite user files." The UI must make the user choose, and `KEEP_BOTH`
 * renames rather than clobbering.
 */
export const CONFLICT_STRATEGIES = ['REPLACE', 'KEEP_BOTH', 'SKIP', 'CANCEL'] as const;
export type ConflictStrategy = (typeof CONFLICT_STRATEGIES)[number];

/** Applies the user's choice to many files at once (plan.md §24). */
export type ConflictPolicy = ConflictStrategy | 'APPLY_TO_ALL';

export function isApplyToAll(policy: ConflictPolicy): policy is 'APPLY_TO_ALL' {
  return policy === 'APPLY_TO_ALL';
}

export function createOperation(input: {
  id: string;
  kind: OperationKind;
  itemUris: readonly string[];
  label: string;
  destinationUri?: string | null;
  now?: number;
}): FileOperation {
  return {
    id: input.id,
    kind: input.kind,
    state: 'QUEUED',
    itemUris: input.itemUris,
    label: input.label,
    destinationUri: input.destinationUri ?? null,
    progress: { ratio: 0, transferred: 0, total: null },
    error: null,
    createdAt: input.now ?? Date.now(),
    startedAt: null,
    finishedAt: null,
  };
}

/**
 * Advances an operation to `state`, stamping timestamps on the way in and out.
 *
 * Written as a pure function so the queue's reducer stays trivially testable
 * (plan.md §44) and so an illegal transition can't half-apply.
 */
export function transition(
  operation: FileOperation,
  state: OperationState,
  patch: Partial<Omit<FileOperation, 'id' | 'kind' | 'state'>> = {},
  now = Date.now(),
): FileOperation {
  const next: FileOperation = { ...operation, ...patch, state };

  if (state === 'RUNNING' && operation.state !== 'RUNNING') {
    next.startedAt = operation.startedAt ?? now;
  }
  if (isTerminal(state)) {
    next.finishedAt = now;
    if (state === 'COMPLETED') {
      next.progress = { ...next.progress, ratio: 1 };
    }
  }
  if (state === 'RUNNING' || state === 'QUEUED') {
    next.error = null;
  }
  return next;
}

export function withProgress(
  operation: FileOperation,
  transferred: number,
  total: number | null,
): FileOperation {
  const ratio = total !== null && total > 0 ? Math.min(1, transferred / total) : 0;
  return { ...operation, progress: { ratio, transferred, total } };
}

/** `2.1 GB / 3.2 GB` for the progress sheet (plan.md §22). */
export function formatProgressLabel(progress: OperationProgress): string {
  if (progress.total === null) return 'Calculating…';
  return `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}`;
}
