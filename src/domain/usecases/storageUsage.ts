import { type FileItem } from '#/domain/models/fileItem';
import { type FileType } from '#/domain/models/fileType';
import {
  type StorageUsage,
  type UsageBreakdown,
  type Volume,
  createStorageUsage,
} from '#/domain/models/storage';

/**
 * Storage usage and per-type breakdown (plan.md §4, §19, §29).
 *
 * Measuring a volume means walking it, which on a real device is tens of
 * thousands of directories. So the cheap numbers (total/free from the
 * platform) and the expensive ones (bytes per type) are deliberately separate:
 * the header renders instantly from the former, and the analyzer fills in from
 * the latter while reporting that it is still working.
 */

export function describeVolumes(volumes: readonly Volume[]): StorageUsage[] {
  return volumes.map(createStorageUsage);
}

export function findVolume(volumes: readonly Volume[], id: string): Volume | undefined {
  return volumes.find((volume) => volume.id === id);
}

/** The volume a screen should open when the user just says "Storage". */
export function primaryVolume(volumes: readonly Volume[]): Volume | undefined {
  return volumes.find((volume) => volume.isPrimary) ?? volumes[0];
}

export type BreakdownOptions = {
  /** Stop and report partial results past this many directories. */
  maxDirectories?: number;
  signal?: { readonly isCancelled: boolean };
  onProgress?: (scanned: number) => void;
};

export type BreakdownResult = {
  breakdown: UsageBreakdown;
  scannedDirectories: number;
  truncated: boolean;
};

const DEFAULT_MAX_DIRECTORIES = 5_000;

/**
 * Accumulates bytes per file type across a volume.
 *
 * Walks breadth-first and skips re-entering a directory it has already seen, so
 * a symlink loop or a bind mount cannot make this run forever.
 */
export async function computeUsageBreakdown(
  provider: { list: (uri: string) => Promise<FileItem[]> },
  volume: Volume,
  options: BreakdownOptions = {},
): Promise<BreakdownResult> {
  const maxDirectories = options.maxDirectories ?? DEFAULT_MAX_DIRECTORIES;
  const breakdown: UsageBreakdown = {};
  const visited = new Set<string>();
  const frontier: { uri: string; depth: number }[] = [{ uri: volume.rootUri, depth: 0 }];

  let scannedDirectories = 0;
  let truncated = false;

  while (frontier.length > 0) {
    if (options.signal?.isCancelled) {
      return { breakdown, scannedDirectories, truncated: true };
    }

    const { uri, depth } = frontier.shift() as { uri: string; depth: number };
    if (visited.has(uri)) continue;
    visited.add(uri);

    scannedDirectories += 1;
    if (scannedDirectories > maxDirectories) {
      truncated = true;
      break;
    }

    let children: FileItem[];
    try {
      children = await provider.list(uri);
    } catch {
      continue;
    }

    for (const child of children) {
      if (child.isDirectory) {
        frontier.push({ uri: child.uri, depth: depth + 1 });
        continue;
      }
      const size = child.size ?? 0;
      breakdown[child.type] = (breakdown[child.type] ?? 0) + size;
    }

    options.onProgress?.(scannedDirectories);
  }

  if (frontier.length > 0) truncated = true;
  return { breakdown, scannedDirectories, truncated };
}

/** Breakdown rows, largest first, for the storage analyzer list. */
export function toBreakdownRows(breakdown: UsageBreakdown): {
  type: FileType;
  bytes: number;
  ratio: number;
}[] {
  const total = Object.values(breakdown).reduce((sum, bytes) => sum + bytes, 0);
  const rows = Object.entries(breakdown) as [FileType, number][];

  return rows
    .map(([type, bytes]) => ({
      type,
      bytes,
      ratio: total > 0 ? bytes / total : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

/**
 * `documents/Foo.txt` — a path relative to the volume, for search results and
 * the details screen, where an absolute path is too long to be useful.
 */
export function relativeDisplayPath(item: FileItem, volumeRootUri: string): string {
  if (!item.uri.startsWith(volumeRootUri)) return item.name;
  const remainder = item.uri.slice(volumeRootUri.length);
  return remainder.length > 0 ? `${remainder.replace(/\/$/, '')}/${item.name}` : item.name;
}
