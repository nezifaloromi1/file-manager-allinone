/**
 * Storage usage and volume identity (plan.md §4, §19).
 *
 * Android exposes several volumes — internal, SD card, USB — each with its own
 * capacity. A file manager that shows one global number is lying to the user
 * once a second volume exists, so a volume is modelled explicitly.
 */

export type VolumeId = string;

export type Volume = {
  id: VolumeId;
  /** User-facing label, e.g. `Internal storage`, `SD card`. */
  label: string;
  /** The provider that owns this volume. */
  provider: 'local' | 'saf';
  /** Directory URI to open this volume's browser at. */
  rootUri: string;
  totalBytes: number | null;
  availableBytes: number | null;
  /** `true` for the primary emulated volume, which is not ejectable. */
  isPrimary: boolean;
  isRemovable: boolean;
};

export type StorageUsage = {
  volume: Volume;
  usedBytes: number | null;
  freeBytes: number | null;
  totalBytes: number | null;
  /** 0–1, or `null` when the total is unknown. */
  ratio: number | null;
  /**
   * Per-type breakdown (plan.md §29).
   *
   * Computing this requires walking the volume, so it is `null` until a scan
   * finishes. The UI shows a progress state rather than a wrong number.
   */
  breakdown: UsageBreakdown | null;
  isScanning: boolean;
};

export type UsageBreakdown = Record<string, number>;

export function createStorageUsage(volume: Volume): StorageUsage {
  const totalBytes = volume.totalBytes;
  const freeBytes = volume.availableBytes;
  const usedBytes =
    totalBytes !== null && freeBytes !== null ? Math.max(0, totalBytes - freeBytes) : null;

  return {
    volume,
    usedBytes,
    freeBytes,
    totalBytes,
    ratio:
      totalBytes !== null && totalBytes > 0 && usedBytes !== null ? usedBytes / totalBytes : null,
    breakdown: null,
    isScanning: false,
  };
}

/** `1.4 GB of 128 GB · 1% used` */
export function formatUsageSummary(usage: StorageUsage): string {
  if (usage.totalBytes === null || usage.usedBytes === null) return 'Calculating…';
  const percent = Math.round((usage.ratio ?? 0) * 100);
  return `${formatBytesShort(usage.usedBytes)} of ${formatBytesShort(usage.totalBytes)} · ${percent}% used`;
}

/**
 * Formats a volume's size the way Android's Settings app does — GB above 1 GB,
 * MB below — because that is the number users have already internalised.
 */
function formatBytesShort(bytes: number): string {
  const gigabyte = 1024 * 1024 * 1024;
  const megabyte = 1024 * 1024;
  if (bytes >= gigabyte) return `${round(bytes / gigabyte)} GB`;
  if (bytes >= megabyte) return `${round(bytes / megabyte)} MB`;
  return `${bytes} B`;
}

function round(value: number): string {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}
