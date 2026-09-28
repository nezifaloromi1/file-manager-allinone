import { type FileItem } from '#/domain/models/fileItem';
import { type FileType } from '#/domain/models/fileType';

/**
 * Recursive filename search (plan.md §16).
 *
 * "Start with local indexing/search appropriate to your dataset. Don't add
 * Elasticsearch to a mobile file manager."
 *
 * Two constraints shape this design:
 *
 *  1. A directory can hold 100,000 entries and a whole volume can hold
 *     millions, so the walk is incremental, cancellable, and reports results as
 *     it goes rather than returning one giant array (§46, §48).
 *  2. `provider.list()` is a native round-trip per directory, so the walk is
 *     breadth-first with a bounded frontier. A depth-first walk of a deep tree
 *     would hold a single enormous stack instead.
 */

export type SearchOptions = {
  /** Case-insensitive substring. An empty query matches nothing. */
  query: string;
  /** Restrict results to these types. Empty means every type. */
  types?: readonly FileType[];
  /** Include dotfiles. */
  showHidden?: boolean;
  /** Hard cap on directories visited, so one bad volume can't hang the app. */
  maxDirectories?: number;
  /** Hard cap on results retained. */
  maxResults?: number;
  /** Hard cap on depth below the start directory. */
  maxDepth?: number;
  signal?: { readonly isCancelled: boolean };
  /** Called as results arrive, for incremental rendering. */
  onResults?: (items: FileItem[]) => void;
  /** Called periodically with scan progress. */
  onProgress?: (scanned: number, found: number) => void;
};

export type SearchOutcome = {
  results: FileItem[];
  /** Directories visited before the walk finished or hit a limit. */
  scannedDirectories: number;
  /** True when a limit or cancellation stopped the walk early. */
  truncated: boolean;
};

const DEFAULT_MAX_DIRECTORIES = 20_000;
const DEFAULT_MAX_RESULTS = 2_000;
const DEFAULT_MAX_DEPTH = 12;

export async function searchFiles(
  provider: { list: (uri: string) => Promise<FileItem[]> },
  startUri: string,
  options: SearchOptions,
): Promise<SearchOutcome> {
  const query = options.query.trim().toLowerCase();
  if (query.length === 0) {
    return { results: [], scannedDirectories: 0, truncated: false };
  }

  const maxDirectories = options.maxDirectories ?? DEFAULT_MAX_DIRECTORIES;
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const showHidden = options.showHidden ?? false;
  const types = options.types ?? [];

  const results: FileItem[] = [];
  // BFS frontier: each entry carries its depth so maxDepth is enforceable
  // without recursing.
  const frontier: { uri: string; depth: number }[] = [{ uri: startUri, depth: 0 }];

  let scannedDirectories = 0;
  let truncated = false;

  while (frontier.length > 0) {
    if (options.signal?.isCancelled) {
      return { results, scannedDirectories, truncated: true };
    }
    if (scannedDirectories >= maxDirectories) {
      // A volume can contain millions of directories. Without this ceiling a
      // search on a full phone runs for minutes and blocks the UI thread's
      // await chain indefinitely (plan.md §46).
      return { results, scannedDirectories, truncated: true };
    }

    const { uri, depth } = frontier.shift() as { uri: string; depth: number };
    scannedDirectories += 1;

    let children: FileItem[];
    try {
      children = await provider.list(uri);
    } catch {
      // An unreadable directory (permissions, a disconnected SD card, a
      // dangling SAF grant) must not abort the whole search. Skip it and keep
      // going — a partial result set is far more useful than an error.
      continue;
    }

    for (const child of children) {
      if (!showHidden && child.isHidden) continue;
      if (child.isDirectory) {
        if (depth < maxDepth) {
          frontier.push({ uri: child.uri, depth: depth + 1 });
        }
        continue;
      }
      if (types.length > 0 && !types.includes(child.type)) continue;
      if (!child.name.toLowerCase().includes(query)) continue;

      results.push(child);
      if (results.length >= maxResults) {
        truncated = true;
        break;
      }
    }

    options.onProgress?.(scannedDirectories, results.length);
    if (results.length >= maxResults) break;
  }

  if (frontier.length > 0) {
    truncated = true;
  }

  results.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
  options.onResults?.(results);

  return { results, scannedDirectories, truncated };
}
