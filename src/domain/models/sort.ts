import { type FileItem } from './fileItem';
import { type FileType } from './fileType';

/**
 * Sort and filter specs (plan.md §17, §18), plus the pure comparators that
 * apply them.
 *
 * These are deliberately plain functions over arrays rather than something
 * clever: sorting is the hottest path in the app, and a comparator that a human
 * can read is one that can be unit tested (plan.md §44) and reasoned about
 * when a directory holds 100,000 entries (§46).
 */

export const SORT_KEYS = ['name', 'modifiedAt', 'createdAt', 'size', 'type'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type SortDirection = 'asc' | 'desc';

export type SortSpec = {
  key: SortKey;
  direction: SortDirection;
  /** Keep directories above files regardless of key and direction. */
  foldersFirst: boolean;
};

export const DEFAULT_SORT: SortSpec = {
  key: 'name',
  direction: 'asc',
  foldersFirst: true,
};

export const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  modifiedAt: 'Date modified',
  createdAt: 'Date created',
  size: 'Size',
  type: 'Type',
};

/** Size buckets from plan.md §18. */
export const SIZE_RANGES = ['lt1mb', '1to100mb', 'gt100mb'] as const;
export type SizeRange = (typeof SIZE_RANGES)[number];

export const SIZE_RANGE_LABELS: Record<SizeRange, string> = {
  lt1mb: 'Less than 1 MB',
  '1to100mb': '1–100 MB',
  gt100mb: 'Over 100 MB',
};

export const DATE_RANGES = ['today', 'thisWeek', 'thisMonth'] as const;
export type DateRange = (typeof DATE_RANGES)[number];

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'Today',
  thisWeek: 'This week',
  thisMonth: 'This month',
};

export type FilterSpec = {
  /** Empty means "no type filter" — not "match nothing". */
  types: FileType[];
  sizes: SizeRange[];
  dates: DateRange[];
  /** Case-insensitive substring match on the name. */
  query: string;
};

export const EMPTY_FILTER: FilterSpec = {
  types: [],
  sizes: [],
  dates: [],
  query: '',
};

export function isFilterActive(filter: FilterSpec): boolean {
  return (
    filter.types.length > 0 ||
    filter.sizes.length > 0 ||
    filter.dates.length > 0 ||
    filter.query.trim().length > 0
  );
}

/**
 * Sorts a directory listing.
 *
 * Returns a new array — providers hand us their own backing array and mutating
 * it would corrupt a cache. `Array.prototype.sort` is stable, so ties keep
 * provider order, which is why every comparator falls through to `name`.
 */
export function sortItems(items: readonly FileItem[], spec: SortSpec): FileItem[] {
  const direction = spec.direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    if (spec.foldersFirst && a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    // An unknown size or date is missing data, not an extreme value. It must
    // sort last in *both* directions — otherwise "Size ↓" floats every
    // size-less directory to the top, which reads as a bug. Handling this
    // outside the `* direction` multiplication is what keeps it direction-free.
    if (spec.key !== 'name' && spec.key !== 'type') {
      const missing = compareMissing(a, b, spec.key);
      if (missing !== 0) return missing;
    }

    return compareByKey(a, b, spec.key) * direction;
  });
}

/** `1` when `a` has no value for the key and `b` does, `-1` for the reverse. */
function compareMissing(a: FileItem, b: FileItem, key: SortKey): number {
  const aValue = valueForKey(a, key);
  const bValue = valueForKey(b, key);
  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return 1;
  if (bValue === null) return -1;
  return 0;
}

function valueForKey(item: FileItem, key: SortKey): number | null {
  switch (key) {
    case 'modifiedAt':
      return item.modifiedAt;
    case 'createdAt':
      return item.createdAt;
    case 'size':
      return item.size;
    case 'name':
    case 'type':
      return null;
  }
}

function compareByKey(a: FileItem, b: FileItem, key: SortKey): number {
  switch (key) {
    case 'name':
      return compareNames(a.name, b.name);
    case 'modifiedAt':
      return (a.modifiedAt ?? 0) - (b.modifiedAt ?? 0);
    case 'createdAt':
      return (a.createdAt ?? 0) - (b.createdAt ?? 0);
    case 'size':
      return (a.size ?? 0) - (b.size ?? 0);
    case 'type':
      return compareByType(a, b);
  }
}

/**
 * Locale-aware, case-insensitive name comparison.
 *
 * `numeric: true` so `file2` sorts before `file10` — the ordering users expect
 * from every other file manager, and the default a plain string compare gets
 * wrong.
 */
function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function compareByType(a: FileItem, b: FileItem): number {
  return compareNames(displayTypeName(a), displayTypeName(b)) || compareNames(a.name, b.name);
}

function displayTypeName(item: FileItem): string {
  return item.isDirectory ? 'directory' : item.type;
}

/**
 * Applies filters, then the search query.
 *
 * An empty type/size/date list means "no filter on this axis", not "match
 * nothing" — so a caller can leave one axis alone without special-casing it.
 */
export function filterItems(
  items: readonly FileItem[],
  filter: FilterSpec,
  now = Date.now(),
): FileItem[] {
  const query = filter.query.trim().toLowerCase();
  const hasTypeFilter = filter.types.length > 0;
  const hasSizeFilter = filter.sizes.length > 0;
  const hasDateFilter = filter.dates.length > 0;
  if (!hasTypeFilter && !hasSizeFilter && !hasDateFilter && query.length === 0) {
    return [...items];
  }

  return items.filter((item) => {
    if (hasTypeFilter && !filter.types.includes(item.type)) return false;
    if (hasSizeFilter && item.size !== null && !matchesSize(item.size, filter.sizes)) return false;
    if (hasDateFilter && !matchesDate(item.modifiedAt, filter.dates, now)) return false;
    if (query.length > 0 && !item.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

function matchesSize(size: number, ranges: readonly SizeRange[]): boolean {
  const megabyte = 1024 * 1024;
  return ranges.some((range) => {
    switch (range) {
      case 'lt1mb':
        return size < megabyte;
      case '1to100mb':
        return size >= megabyte && size <= 100 * megabyte;
      case 'gt100mb':
        return size > 100 * megabyte;
    }
  });
}

function matchesDate(timestamp: number | null, ranges: readonly DateRange[], now: number): boolean {
  // An unknown date cannot satisfy a date filter — including it would show
  // files the user filtered out.
  if (timestamp === null) return false;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();

  const day = 24 * 60 * 60 * 1000;
  return ranges.some((range) => {
    switch (range) {
      case 'today':
        return timestamp >= todayStart;
      case 'thisWeek':
        return timestamp >= todayStart - 7 * day;
      case 'thisMonth':
        return timestamp >= todayStart - 30 * day;
    }
  });
}

/** Filter then sort — the order the browser screen always needs them in. */
export function applyView(
  items: readonly FileItem[],
  options: { filter: FilterSpec; sort: SortSpec; showHidden: boolean; now?: number },
): FileItem[] {
  const visible = options.showHidden ? [...items] : items.filter((item) => !item.isHidden);
  return sortItems(filterItems(visible, options.filter, options.now), options.sort);
}
