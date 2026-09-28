import { AppError, toAppError } from '#/core/errors';
import { withCopySuffix } from '#/core/utils/validate';
import { type FileItem } from '#/domain/models/fileItem';
import { type ConflictPolicy } from '#/domain/models/operation';
import {
  type CancelSignal,
  NEVER_CANCELLED,
  type ProgressReporter,
  type StorageProvider,
} from '#/domain/storage/StorageProvider';
import { basenameOf, joinUri, parentUriOf } from './folder';

/**
 * Copy and move (plan.md §22, §24, §47).
 *
 * Both are the same walk with a different tail, so they share one planner.
 * The planner is separated from execution for two reasons: it is pure, so the
 * conflict-resolution decisions are unit-testable without a filesystem
 * (plan.md §44); and it resolves every name collision *before* any bytes move,
 * so a 12-item copy cannot half-finish and then discover a collision.
 */

export type TransferKind = 'copy' | 'move';

/**
 * Upper bound on `name (n)` probing, so `KEEP_BOTH` can never spin forever.
 *
 * Also fixes the starting index: the first collision must try `(2)`, not `(1)`,
 * because `name (1)` implies a `(1)` that never existed.
 */
const MAX_KEEP_BOTH_ATTEMPTS = 1000;
const FIRST_COPY_SUFFIX = 2;

export type TransferPlanEntry = {
  item: FileItem;
  sourceUri: string;
  /** Destination directory URI. */
  destinationDirUri: string;
  /** Final name, after conflict resolution. `null` when the item is skipped. */
  targetName: string | null;
  targetUri: string | null;
};

export type TransferPlan = {
  kind: TransferKind;
  entries: TransferPlanEntry[];
  /** Items that were dropped by a `SKIP` decision. */
  skipped: FileItem[];
  /** True when the user cancelled partway through planning. */
  cancelled: boolean;
  /** Set when the user asked to stop everything. */
  policy: ConflictPolicy | null;
};

/**
 * A conflict callback, one question per collision.
 *
 * "Apply to all" (plan.md §24) is modelled here rather than in the UI, so that
 * asking 40 files the same question — or showing 40 identical dialogs — is
 * impossible to get wrong.
 */
export type ConflictResolver = (name: string, item: FileItem) => Promise<ConflictPolicy>;

/**
 * Wraps a per-collision prompt so "apply to all" works.
 *
 * **Deliberately not sticky by default.** An earlier version cached the first
 * concrete answer and reused it for every later collision, which meant a user
 * who replaced one file had "replace" applied silently to the other 39. That is
 * the exact failure plan.md §24 is written against — "Never silently overwrite
 * user files" — just in the opposite direction: instead of overwriting without
 * asking, it *decides* to overwrite without asking.
 *
 * So each collision is asked, and only `APPLY_TO_ALL` latches an answer. It
 * latches a *concrete* strategy, obtained by asking once more, because
 * "apply to all" is a gesture rather than an action the planner understands.
 */
export function createConflictResolver(
  ask: (name: string, item: FileItem) => Promise<ConflictPolicy>,
): ConflictResolver {
  let latched: ConflictPolicy | null = null;

  return async (name, item) => {
    if (latched !== null) return latched;

    const decision = await ask(name, item);
    if (decision !== 'APPLY_TO_ALL') return decision;

    latched = await ask(name, item);
    return latched;
  };
}

export async function planTransfer(
  provider: StorageProvider,
  items: readonly FileItem[],
  destinationDirUri: string,
  kind: TransferKind,
  ask: ConflictResolver,
): Promise<TransferPlan> {
  const entries: TransferPlanEntry[] = [];
  const skipped: FileItem[] = [];
  let cancelled = false;
  let policy: ConflictPolicy | null = null;

  // Names already claimed earlier in this same transfer, so two source items
  // that both map to `report.pdf` don't collide with each other after the
  // first one is written.
  const claimed = new Set<string>();

  for (const item of items) {
    if (kind === 'copy' && isSameLocation(item.uri, destinationDirUri)) {
      throw new AppError('ALREADY_EXISTS', {
        message: 'A file cannot be copied onto itself.',
      });
    }
    if (kind === 'move' && isMovingIntoOwnSubdirectory(item, destinationDirUri)) {
      throw new AppError('INVALID_NAME', {
        message: 'A folder cannot be moved into itself.',
      });
    }

    let targetName = item.name;
    let attempts = FIRST_COPY_SUFFIX;

    for (;;) {
      const targetUri = joinUri(destinationDirUri, targetName);

      if (!claimed.has(targetName) && !(await provider.exists(targetUri))) {
        claimed.add(targetName);
        entries.push({ item, sourceUri: item.uri, destinationDirUri, targetName, targetUri });
        break;
      }

      const decision = await ask(targetName, item);
      if (decision === 'CANCEL') {
        cancelled = true;
        break;
      }
      if (decision === 'SKIP') {
        skipped.push(item);
        break;
      }
      if (decision === 'REPLACE') {
        claimed.add(targetName);
        entries.push({ item, sourceUri: item.uri, destinationDirUri, targetName, targetUri });
        break;
      }
      // KEEP_BOTH — try `name (2)`, `name (3)`, …
      targetName = withCopySuffix(item.name, attempts);
      attempts += 1;
      if (attempts >= FIRST_COPY_SUFFIX + MAX_KEEP_BOTH_ATTEMPTS) {
        // A destination that already holds every `name (n)` up to 1000 is not
        // a real scenario; bail rather than spin.
        throw new AppError('ALREADY_EXISTS', {
          message: 'Could not find a free name for this item.',
        });
      }
    }

    if (cancelled) break;
  }

  return { kind, entries, skipped, cancelled, policy };
}

export type TransferResult = {
  completed: FileItem[];
  failed: { item: FileItem; error: AppError }[];
  skipped: FileItem[];
};

/**
 * Executes a plan, reporting progress and honouring cancellation.
 *
 * Sequential rather than parallel on purpose: copying several multi-gigabyte
 * files at once on a phone contends for the same I/O and is slower overall,
 * and a single progress number is honest in a way five racing ones are not.
 */
export async function executeTransfer(
  provider: StorageProvider,
  plan: TransferPlan,
  options: {
    onProgress?: ProgressReporter;
    onItemComplete?: (item: FileItem) => void;
    signal?: CancelSignal;
  } = {},
): Promise<TransferResult> {
  const signal = options.signal ?? NEVER_CANCELLED;
  const completed: FileItem[] = [];
  const failed: { item: FileItem; error: AppError }[] = [];

  let transferred = 0;
  const total = plan.entries.reduce((sum, entry) => sum + (entry.item.size ?? 0), 0);

  for (const entry of plan.entries) {
    if (signal.isCancelled) break;

    let itemTransferred = 0;
    const perItem: ProgressReporter = (bytes) => {
      itemTransferred = bytes;
      // Report cumulative progress across the whole batch, so the bar advances
      // smoothly instead of resetting to 0% on every file.
      options.onProgress?.(transferred + bytes, total > 0 ? total : null);
    };

    try {
      // The plan already resolved every collision, so the provider is told the
      // final name and never asked again. If the planner chose KEEP_BOTH, the
      // name it picked is authoritative and must be passed down, or the
      // `(2)` suffix is lost on the way to disk.
      const options_ = {
        onConflict: async () => 'REPLACE' as const,
        targetName: entry.targetName ?? undefined,
        onProgress: perItem,
        signal,
      };

      const result =
        plan.kind === 'copy'
          ? await provider.copy(entry.sourceUri, entry.destinationDirUri, options_)
          : await provider.move(entry.sourceUri, entry.destinationDirUri, options_);

      // Fall back to the item's own size when the provider reported nothing,
      // so the bar still advances for a file whose length was unknown up front.
      transferred += itemTransferred || (entry.item.size ?? 0);
      completed.push(result);
      options.onItemComplete?.(result);
    } catch (error) {
      failed.push({ item: entry.item, error: toAppError(error, { operation: plan.kind }) });
      // Count the failed item's bytes so the remaining items' share of the bar
      // is not permanently understated.
      transferred += entry.item.size ?? 0;
    }
  }

  return { completed, failed, skipped: plan.skipped };
}

/** Two URIs denote the same location when they differ only by a trailing slash. */
export function isSameLocation(a: string, b: string): boolean {
  return stripTrailingSlash(a) === stripTrailingSlash(b);
}

/** Guards against moving a folder into its own subtree, which would orphan it. */
function isMovingIntoOwnSubdirectory(item: FileItem, destinationDirUri: string): boolean {
  if (!item.isDirectory) return false;
  return stripTrailingSlash(destinationDirUri).startsWith(stripTrailingSlash(item.uri));
}

function stripTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri.slice(0, -1) : uri;
}

/**
 * The default destination for copy: the item's current parent.
 *
 * Returning the parent rather than the volume root matches what every file
 * manager does when the user picks "Copy" and hasn't chosen a target yet.
 */
export function defaultCopyDestination(item: FileItem): string {
  return item.parentUri || parentUriOf(item.uri) || item.uri;
}

/** `Documents/report.pdf` for pickers that need a human-readable target. */
export function describeDestination(provider: StorageProvider, destinationDirUri: string): string {
  return basenameOf(destinationDirUri) || provider.id;
}
