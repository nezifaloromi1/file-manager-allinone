import { type FileItem } from '#/domain/models/fileItem';
import { type FileType } from '#/domain/models/fileType';

/**
 * Duplicate detection (plan.md §30).
 *
 * "Do not identify duplicates by filename alone." Same name is not same
 * content. The pipeline is size → cheap hash → full hash, because hashing every
 * byte of a 4 GB video to answer "is this a duplicate?" is not a reasonable
 * default.
 */

export type DuplicateCandidate = {
  /** Files sharing a size — the cheap first pass. */
  size: number;
  items: FileItem[];
};

export type DuplicateGroup = {
  key: string;
  items: FileItem[];
  /** How the group was proven identical. */
  confidence: 'size-only' | 'partial-hash' | 'full-hash';
};

/**
 * Groups files that share a size.
 *
 * Pure and cheap, so it can run over a whole volume without I/O. The result is
 * a candidate set, never an assertion of duplication — that distinction is the
 * whole point of plan.md §30.
 */
export function findSizeCandidates(items: readonly FileItem[]): DuplicateCandidate[] {
  const bySize = new Map<number, FileItem[]>();

  for (const item of items) {
    // A zero-byte "duplicate" is meaningless, and directories have no size.
    if (item.isDirectory || item.size === null || item.size === 0) continue;
    const bucket = bySize.get(item.size);
    if (bucket) {
      bucket.push(item);
    } else {
      bySize.set(item.size, [item]);
    }
  }

  return [...bySize.entries()]
    .filter(([, bucket]) => bucket.length > 1)
    .map(([size, bucket]) => ({ size, items: bucket }))
    .sort((a, b) => b.size - a.size);
}

/** Reads the first and last `sampleBytes` of a file — see `hashFile`. */
export type SampleHasher = (item: FileItem) => Promise<string>;

export type DuplicateOptions = {
  /** Full-content hasher. Omit to stop after the partial-hash stage. */
  fullHasher?: SampleHasher;
  signal?: { readonly isCancelled: boolean };
};

/**
 * Resolves size candidates into verified duplicate groups.
 *
 * Two stages, because the cost difference is enormous: a partial hash reads
 * 128 KB per file, a full hash reads the entire file. Files are only promoted
 * to `full-hash` confidence when a full hasher is actually available.
 */
export async function findDuplicates(
  items: readonly FileItem[],
  hasher: SampleHasher,
  options: DuplicateOptions = {},
): Promise<DuplicateGroup[]> {
  const candidates = findSizeCandidates(items);
  const groups: DuplicateGroup[] = [];

  for (const candidate of candidates) {
    if (options.signal?.isCancelled) break;

    const bySample = new Map<string, FileItem[]>();
    for (const item of candidate.items) {
      let digest: string;
      try {
        digest = await hasher(item);
      } catch {
        // An unreadable file cannot be proven duplicate; skip it rather than
        // guessing from its size.
        continue;
      }
      const bucket = bySample.get(digest);
      if (bucket) {
        bucket.push(item);
      } else {
        bySample.set(digest, [item]);
      }
    }

    for (const [sampleKey, bucket] of bySample) {
      if (bucket.length < 2) continue;

      if (!options.fullHasher) {
        groups.push({
          key: `size:${candidate.size}:sample:${sampleKey}`,
          items: bucket,
          confidence: 'partial-hash',
        });
        continue;
      }

      const byFull = new Map<string, FileItem[]>();
      for (const item of bucket) {
        try {
          const digest = await options.fullHasher(item);
          const full = byFull.get(digest);
          if (full) {
            full.push(item);
          } else {
            byFull.set(digest, [item]);
          }
        } catch {
          continue;
        }
      }

      for (const [fullKey, group] of byFull) {
        if (group.length < 2) continue;
        groups.push({
          key: `size:${candidate.size}:full:${fullKey}`,
          items: group,
          confidence: 'full-hash',
        });
      }
    }
  }

  return groups;
}

/**
 * Bytes reclaimable by deleting duplicates, keeping the newest of each group.
 *
 * "Don't automatically delete anything" (plan.md §30) — this only reports a
 * figure for the user to act on.
 */
export function reclaimableBytes(groups: readonly DuplicateGroup[]): number {
  let total = 0;
  for (const group of groups) {
    const keep = [...group.items].sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))[0];
    for (const item of group.items) {
      if (item !== keep) total += item.size ?? 0;
    }
  }
  return total;
}

/** Oldest-first list of files untouched for `days`, for the "old files" view. */
export function findOldFiles(
  items: readonly FileItem[],
  days: number,
  now = Date.now(),
): FileItem[] {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return items
    .filter((item) => !item.isDirectory && item.modifiedAt !== null && item.modifiedAt < cutoff)
    .sort((a, b) => (a.modifiedAt ?? 0) - (b.modifiedAt ?? 0));
}

export function totalSizeOf(items: readonly FileItem[]): number {
  return items.reduce((sum, item) => sum + (item.size ?? 0), 0);
}

export function countByType(items: readonly FileItem[]): Record<FileType, number> {
  const counts = {} as Record<FileType, number>;
  for (const item of items) {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }
  return counts;
}
