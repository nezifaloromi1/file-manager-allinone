/**
 * Human-readable formatting for file metadata.
 *
 * Sizes and dates are rendered in a fixed, locale-independent format so that
 * sorting, list rows, and detail screens all agree, and so tests can assert on
 * exact output.
 */

/**
 * Byte base and unit labels come from the design tokens rather than literals:
 * a file manager is about bytes, so 1024 and the unit table are part of the
 * design system, not a detail buried in a formatter.
 */
import { byteUnitLabels, byteUnits } from '#/flux/base/tokens';

/**
 * Formats a byte count.
 *
 * Uses binary units (1 KB = 1024 B) because that is what Android's own storage
 * settings report, and a file manager that disagrees with the system about
 * "how much space is left" reads as a bug.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  if (bytes < 0) return '—';
  if (bytes < byteUnits.kilo) return `${bytes} ${byteUnitLabels[0]}`;

  let value = bytes;
  let unit = 0;
  while (value >= byteUnits.kilo && unit < byteUnitLabels.length - 1) {
    value /= byteUnits.kilo;
    unit += 1;
  }

  // One decimal below 10 keeps "9.4 GB" readable; above that the decimal is
  // noise, since the number is already imprecise at that magnitude.
  const decimals = value < 10 ? 1 : 0;
  return `${value.toFixed(decimals)} ${byteUnitLabels[unit]}`;
}

export type RelativeTimeUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Coarse relative time, used for recent-file grouping (plan.md §27).
 *
 * Deliberately coarse: "3 days ago" is enough to group a list, and avoids the
 * false precision of "3 days, 4 hours ago" for a file the user opened this
 * morning.
 */
export function formatRelativeTime(timestamp: number | null | undefined, now = Date.now()): string {
  if (timestamp === null || timestamp === undefined || Number.isNaN(timestamp)) return '—';

  const elapsed = now - timestamp;
  if (elapsed < 0) return 'just now';
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < WEEK) return plural(Math.floor(elapsed / DAY), 'day');
  if (elapsed < MONTH) return plural(Math.floor(elapsed / WEEK), 'week');
  if (elapsed < YEAR) return plural(Math.floor(elapsed / MONTH), 'month');
  return plural(Math.floor(elapsed / YEAR), 'year');
}

/** Absolute date for detail screens: `Sep 27, 2026`. */
export function formatDate(timestamp: number | null | undefined): string {
  if (timestamp === null || timestamp === undefined || Number.isNaN(timestamp)) return '—';
  const date = new Date(timestamp);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** `14:32` — the time portion only, for today-grouped rows. */
export function formatTime(timestamp: number | null | undefined): string {
  if (timestamp === null || timestamp === undefined || Number.isNaN(timestamp)) return '—';
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type DateBucket = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'older';

/** Buckets a timestamp for the recent-files sections (plan.md §27). */
export function toDateBucket(timestamp: number, now = Date.now()): DateBucket {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();

  if (timestamp >= todayStart) return 'today';
  if (timestamp >= todayStart - DAY) return 'yesterday';
  if (timestamp >= todayStart - WEEK) return 'thisWeek';
  if (timestamp >= todayStart - MONTH) return 'thisMonth';
  return 'older';
}

export const DATE_BUCKET_LABELS: Record<DateBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  thisMonth: 'This month',
  older: 'Older',
};

/** `127 items`, pluralised. */
export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * A retention window in words: `30 days`, `1 day`, `12 hours`.
 *
 * Days alone reads oddly below a week — "kept for 1 days" — and a user who has
 * set a short window needs to know it is short.
 */
export function formatRetention(days: number): string {
  if (days <= 0) return 'no time';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  return `${days} days`;
}

/** `1.4 GB of 128 GB` for storage headers. */
export function formatStorageUsage(used: number, total: number): string {
  if (total <= 0) return '—';
  return `${formatBytes(used)} of ${formatBytes(total)}`;
}

/** 0–1, clamped. Returns 0 when the total is unknown rather than NaN. */
export function toUsageRatio(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, used / total));
}

function plural(value: number, unit: RelativeTimeUnit): string {
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
