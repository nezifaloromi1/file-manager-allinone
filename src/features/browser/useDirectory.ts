import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type AppError, toAppError } from '#/core/errors';
import { type FileItem } from '#/domain/models/fileItem';
import {
  type FilterSpec,
  EMPTY_FILTER,
  type SortSpec,
  applyView,
  isFilterActive,
} from '#/domain/models/sort';
import { providerForUri, type StorageProvider } from '#/data/storage';

/**
 * The directory-listing state machine behind the browser (plan.md §5, §46).
 *
 * Kept out of the screen component for two reasons: it is where the
 * load/refresh/error transitions live, and a screen that owns them re-renders
 * its whole list on every state change.
 *
 * ## Why `applyView` is memoised rather than run in render
 *
 * A directory can hold 100,000 entries. Filtering and sorting that array on
 * every render — which is what happens if the screen calls `applyView`
 * inline — turns a tap on the sort toggle into a visible stall. Memoising on
 * the inputs means the work only happens when the listing or the view settings
 * actually change.
 *
 * ## Why cancellation is cooperative
 *
 * Navigating quickly up and down a deep tree starts a new listing before the
 * previous one finishes. Without a generation counter, a slow earlier response
 * can land after a fast later one and overwrite it with stale contents — the
 * user sees the wrong folder. `generation` makes late responses no-ops.
 */

export type LoadState = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';

export type UseDirectoryOptions = {
  uri: string;
  sort: SortSpec;
  showHidden: boolean;
  /** Optional in-folder filter. Empty means "show everything". */
  filter?: FilterSpec;
};

export type DirectoryView = {
  items: FileItem[];
  state: LoadState;
  error: AppError | null;
  /** True when a filter is hiding items that exist. */
  isFiltered: boolean;
  /** Folders before files, for the "23 items · 4 folders" summary. */
  folderCount: number;
  fileCount: number;
  totalBytes: number;
  refresh: () => void;
  retry: () => void;
};

export function useDirectory({
  uri,
  sort,
  showHidden,
  filter = EMPTY_FILTER,
}: UseDirectoryOptions): DirectoryView {
  const [raw, setRaw] = useState<FileItem[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<AppError | null>(null);

  // Increments on every load; a response from an older generation is discarded.
  const generation = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const current = ++generation.current;
      setState(mode === 'refresh' ? 'refreshing' : 'loading');
      setError(null);

      try {
        const provider = providerForUri(uri);
        const items = await provider.list(uri, { showHidden });
        // A response that lost the race is dropped rather than rendered.
        if (!mounted.current || current !== generation.current) return;
        setRaw(items);
        setState('ready');
      } catch (caught) {
        if (!mounted.current || current !== generation.current) return;
        setError(toAppError(caught, { operation: 'list', uri }));
        setState('error');
      }
    },
    [showHidden, uri],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  // Reloading when `showHidden` flips means the provider filters server-side, so
  // the previous listing genuinely does not contain what is now needed.
  const previousShowHidden = useRef(showHidden);
  useEffect(() => {
    if (previousShowHidden.current === showHidden) return;
    previousShowHidden.current = showHidden;
    void load('refresh');
  }, [load, showHidden]);

  const view = useMemo(
    () => applyView(raw, { filter, sort, showHidden }),
    [filter, raw, showHidden, sort],
  );

  const summary = useMemo(() => {
    let folderCount = 0;
    let fileCount = 0;
    let totalBytes = 0;
    for (const item of view) {
      if (item.isDirectory) folderCount += 1;
      else {
        fileCount += 1;
        totalBytes += item.size ?? 0;
      }
    }
    return { folderCount, fileCount, totalBytes };
  }, [view]);

  const refresh = useCallback(() => {
    void load('refresh');
  }, [load]);

  const retry = useCallback(() => {
    void load('initial');
  }, [load]);

  return {
    items: view,
    state,
    error,
    isFiltered: isFilterActive(filter),
    folderCount: summary.folderCount,
    fileCount: summary.fileCount,
    totalBytes: summary.totalBytes,
    refresh,
    retry,
  };
}

/**
 * Multi-selection state (plan.md §7).
 *
 * A `Set` of URIs rather than an array: membership is the only question asked
 * ("is this selected?"), and `Set.has` is O(1) where `Array.includes` is O(n) —
 * which matters when a long-press in a 100,000-row list has to check every row.
 *
 * Selection is keyed by URI because keying by name breaks the moment two
 * folders in different parents share a filename (plan.md §12).
 */
export type UseSelection = {
  selectedUris: ReadonlySet<string>;
  count: number;
  isSelected: (uri: string) => boolean;
  isActive: boolean;
  toggle: (uri: string) => void;
  select: (uri: string) => void;
  clear: () => void;
  selectAll: (uris: readonly string[]) => void;
  isEverythingSelected: (uris: readonly string[]) => boolean;
};

export function useSelection(): UseSelection {
  const [selectedUris, setSelectedUris] = useState<ReadonlySet<string>>(() => new Set());

  const isSelected = useCallback((uri: string) => selectedUris.has(uri), [selectedUris]);

  const toggle = useCallback((uri: string) => {
    setSelectedUris((current) => {
      const next = new Set(current);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  }, []);

  const select = useCallback((uri: string) => {
    setSelectedUris((current) => {
      if (current.has(uri)) return current;
      const next = new Set(current);
      next.add(uri);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedUris(new Set()), []);

  const selectAll = useCallback((uris: readonly string[]) => {
    setSelectedUris(new Set(uris));
  }, []);

  const isEverythingSelected = useCallback(
    (uris: readonly string[]) => uris.length > 0 && uris.every((uri) => selectedUris.has(uri)),
    [selectedUris],
  );

  return {
    selectedUris,
    count: selectedUris.size,
    isSelected,
    isActive: selectedUris.size > 0,
    toggle,
    select,
    clear,
    selectAll,
    isEverythingSelected,
  };
}

/** Convenience: a provider for a URI, memoised per URI. */
export function useProviderForUri(uri: string): StorageProvider {
  return useMemo(() => providerForUri(uri), [uri]);
}
