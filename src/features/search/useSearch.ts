import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type AppError, toAppError } from '#/core/errors';
import { type FileItem } from '#/domain/models/fileItem';
import { type FileType } from '#/domain/models/fileType';
import { type SearchOutcome, searchFiles } from '#/domain/usecases/search';
import { type CancelSignal, type StorageProvider } from '#/domain/storage/StorageProvider';
import { debounce } from '#/core/utils/debounce';

/**
 * Debounced volume-wide search (plan.md §16, §46).
 *
 * ## Why the debounce is this long
 *
 * 250ms is long enough that a fast typist produces one search rather than ten,
 * and short enough to feel live. The walk itself is cancellable and bounded, so
 * a superseded search stops rather than competing for I/O with the one that
 * replaced it.
 *
 * ## Why a minimum query length
 *
 * A single character matches most of a volume — searching `a` on a phone with
 * 50,000 files walks essentially the whole tree and returns a useless list. Two
 * characters is the point where results become selective, and the UI says so
 * rather than appearing to hang.
 */

export const SEARCH_DEBOUNCE_MS = 250;
export const MIN_QUERY_LENGTH = 2;

export type SearchState =
  | { status: 'idle' }
  | { status: 'too-short' }
  | { status: 'searching' }
  | { status: 'done'; outcome: SearchOutcome }
  | { status: 'error'; error: AppError };

export type UseSearchOptions = {
  rootUri: string;
  provider: StorageProvider;
  /** Restrict results to these types. Empty means every type. */
  types?: readonly FileType[];
  showHidden?: boolean;
  /** Overrides for the walk's own limits, for tests. */
  maxResults?: number;
  maxDirectories?: number;
};

export function useSearch(options: UseSearchOptions) {
  const { rootUri, provider, types = [], showHidden = false, maxResults, maxDirectories } = options;

  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ status: 'idle' });

  // The signal the running walk checks between directories. Replacing it cancels
  // the previous search rather than letting both walk at once.
  const signal = useRef<CancelSignal>({ isCancelled: false });
  const generation = useRef(0);

  /**
   * A stable key for the type filter.
   *
   * The search must restart when the *set* of types changes, but not when a
   * caller passes a new array holding the same contents — which is what happens
   * on every render if the caller derives it inline.
   */
  const typeKey = useMemo(() => [...types].sort().join(','), [types]);

  const run = useCallback(
    async (text: string) => {
      const trimmed = text.trim();

      if (trimmed.length < MIN_QUERY_LENGTH) {
        signal.current = { isCancelled: true };
        generation.current += 1;
        setState(trimmed.length === 0 ? { status: 'idle' } : { status: 'too-short' });
        return;
      }

      // Cancel whatever is running; its result will be discarded.
      signal.current = { isCancelled: true };
      const current = ++generation.current;
      const currentSignal: CancelSignal = { isCancelled: false };
      signal.current = currentSignal;

      setState({ status: 'searching' });

      try {
        const outcome = await searchFiles(provider, rootUri, {
          query: trimmed,
          types,
          showHidden,
          maxResults,
          maxDirectories,
          signal: currentSignal,
        });

        // A newer search started, or this one was cancelled: drop the result
        // rather than letting stale rows replace fresher ones.
        if (current !== generation.current) return;
        setState({ status: 'done', outcome });
      } catch (caught) {
        if (current !== generation.current) return;
        setState({ status: 'error', error: toAppError(caught, { operation: 'search' }) });
      }
    },
    // `typeKey` rather than `types`: it encodes the same information, but as a
    // primitive, so the callback does not rebuild on every array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxDirectories, maxResults, provider, rootUri, showHidden, typeKey],
  );

  const schedule = useMemo(() => debounce(run, SEARCH_DEBOUNCE_MS), [run]);

  const onChangeQuery = useCallback(
    (text: string) => {
      setQuery(text);
      schedule(text);
    },
    [schedule],
  );

  // A new root or a changed type filter restarts the search immediately rather
  // than waiting for the next keystroke.
  useEffect(() => {
    if (query.trim().length >= MIN_QUERY_LENGTH) {
      void run(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootUri, typeKey]);

  // Cancels any in-flight walk when the screen goes away, so a background
  // search does not keep hitting the filesystem.
  useEffect(() => {
    return () => {
      signal.current = { isCancelled: true };
    };
  }, []);

  const clear = useCallback(() => {
    signal.current = { isCancelled: true };
    generation.current += 1;
    setQuery('');
    setState({ status: 'idle' });
  }, []);

  return {
    query,
    onChangeQuery,
    clear,
    state,
    results: state.status === 'done' ? state.outcome.results : [],
    truncated: state.status === 'done' ? state.outcome.truncated : false,
    scanned: state.status === 'done' ? state.outcome.scannedDirectories : 0,
  };
}

/** Grouping for the recent-files sections (plan.md §27). */
export type RecentGroup = {
  bucket: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'older';
  items: FileItem[];
};

export function groupRecent(items: readonly FileItem[], now = Date.now()): RecentGroup[] {
  const order: RecentGroup['bucket'][] = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'older'];
  const groups = new Map<RecentGroup['bucket'], FileItem[]>();

  for (const item of items) {
    const bucket = bucketFor(item.modifiedAt, now);
    const list = groups.get(bucket);
    if (list) list.push(item);
    else groups.set(bucket, [item]);
  }

  return order
    .filter((bucket) => groups.has(bucket))
    .map((bucket) => ({ bucket, items: groups.get(bucket) as FileItem[] }));
}

function bucketFor(timestamp: number | null, now: number): RecentGroup['bucket'] {
  if (timestamp === null) return 'older';
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const todayStart = start.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (timestamp >= todayStart) return 'today';
  if (timestamp >= todayStart - day) return 'yesterday';
  if (timestamp >= todayStart - 7 * day) return 'thisWeek';
  if (timestamp >= todayStart - 30 * day) return 'thisMonth';
  return 'older';
}
