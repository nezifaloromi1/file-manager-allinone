/**
 * Flux design tokens — the app's own design system.
 *
 * These are the values a screen reaches for instead of inventing. Every group
 * here exists because something in the app needed it and would otherwise have
 * hardcoded a number; if you find yourself typing a magic value, it probably
 * belongs here.
 *
 * Naming follows the conventions in `./README.md` — `_` instead of `-` so the
 * keys are object-accessible, t-shirt sizes where a ramp exists.
 */

export const TRACKING = 0;

/** Spacing. Base unit 4px. */
export const space = {
  _2xs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  _2xl: 32,
  _3xl: 40,
  _4xl: 48,
  _5xl: 80,
} as const;

/** Type scale. `md` (15) is the body size. */
export const fontSize = {
  _2xs: 9.4,
  xs: 11.3,
  sm: 13.1,
  md: 15,
  lg: 16.9,
  xl: 18.8,
  _2xl: 20.6,
  _3xl: 24.3,
  _4xl: 30,
  _5xl: 37.5,
  _6xl: 44,
  _7xl: 56,
  _8xl: 72,
} as const;

/**
 * Letter-spacing. Negative tracking is exclusive to display type; `wide` backs
 * the uppercase caption/label voice used for section headers.
 */
export const tracking = {
  mega: -2.16,
  lg: -0.72,
  md: -0.325,
  sm: -0.11,
  normal: 0,
  wide: 0.88,
} as const;

export const lineHeight = {
  tight: 1.15,
  snug: 1.3,
  relaxed: 1.5,
} as const;

/** Corner radii. Interactive elements stay at `xs` (4px) or smaller. */
export const borderRadius = {
  _2xs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
  full: 9999,
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const;

/**
 * Typefaces.
 *
 * Inter carries every text surface; JetBrains Mono carries anything where
 * character alignment is meaningful — file paths, sizes, hashes, code.
 *
 * SDK 54's `useFonts` map treats each key as a standalone family, so these are
 * the per-weight PostScript names rather than one `Inter` family.
 */
export const fontFamily = {
  sans_400: 'Inter_400Regular',
  sans_500: 'Inter_500Medium',
  sans_600: 'Inter_600SemiBold',
  sans_700: 'Inter_700Bold',
  mono_400: 'JetBrainsMono_400Regular',
} as const;

// ---------------------------------------------------------------------- motion

/**
 * Durations, in milliseconds.
 *
 * Three are enough. `quick` for a state that has already been decided (a
 * checkbox ticking), `base` for a value that tracks real work (a progress bar
 * following a copy), and `slow` only for something that loops indefinitely.
 */
export const duration = {
  quick: 140,
  base: 180,
  slow: 1200,
} as const;

/**
 * Easing curves, as cubic-bezier control points.
 *
 * `standard` is the only curve for state changes, so every transition in the app
 * decelerates the same way. `emphasised` is for a value the user is actively
 * dragging, where a slight overshoot reads as responsiveness.
 */
export const easing = {
  standard: [0.25, 0.1, 0.25, 1] as const,
  emphasised: [0.2, 0, 0, 1] as const,
  linear: [0, 0, 1, 1] as const,
};

/**
 * `true` when the platform asks for reduced motion.
 *
 * Read from the OS setting, not a user toggle, and it is the OS value that
 * matters: respecting it is an accessibility requirement (plan.md §40), and
 * conflating it with a preference would mean shipping a setting that quietly
 * disables an accessibility feature.
 *
 * Callers should treat a `false` from the synchronous read as "not known yet"
 * and keep the animation, rather than as "the user has not asked" — a user who
 * enabled reduce motion briefly gets a transition, which is a far smaller
 * problem than the reverse. `useReducedMotion` in `#/flux/util` is the
 * reactive version.
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// ------------------------------------------------------------- touch targets

/**
 * Minimum heights for anything tappable.
 *
 * `accessible` is 48 — the WCAG 2.2 AAA target and Android's own guidance for
 * a11y-critical controls. `comfortable` is 44, the AA floor, and the default for
 * buttons. `compact` is 36 and only for dense list rows where the *row* is the
 * target, not the control inside it.
 */
export const touchTarget = {
  compact: 36,
  accessible: 48,
  comfortable: 44,
  /** The whole-row fallback: a list row is at least this tall. */
  row: 52,
} as const;

// -------------------------------------------------------------------- header

/**
 * The app-bar height.
 *
 * Its own token rather than borrowing `touchTarget.row`, which is what the
 * browser toolbar used to do — a list-row target and an app-bar height are
 * unrelated measurements that happen to share the number 52, and borrowing one
 * for the other is how three different header heights end up in one app.
 *
 * 44 is the AA touch-target floor, so the icon buttons inside can sit at their
 * natural size without the bar growing to accommodate them. The icons rely on
 * `hitSlop` to reach 44, which keeps the bar dense while the targets stay legal.
 */
export const headerHeight = 44;

/** The title size in a header, one step below the old per-screen `text_2xl`. */
export const headerTitleSize = fontSize.xl;

/** Horizontal gutter inside a header, matching the list rows beneath it. */
export const headerGutter = space.md;

// -------------------------------------------------------------------- layers

/**
 * Stacking order.
 *
 * Exists so "the tab bar must sit above the list, and a sheet above the tab
 * bar" is a stated decision rather than whichever `zIndex` someone happened to
 * type. Only these values are used; anything else is a layering bug.
 */
export const layer = {
  base: 0,
  /** Sticky headers and the selection bar, above scrolling content. */
  sticky: 10,
  /** The bottom tab bar. */
  tabBar: 20,
  /** Menus and popovers anchored to a control. */
  popover: 30,
  /** Bottom sheets. */
  sheet: 40,
  /** Modals and their scrims. */
  modal: 50,
  /** Toasts and transient notices, which must outrank a modal. */
  toast: 60,
} as const;

/**
 * Modal scrims.
 *
 * One value, used by every sheet and dialog, so a dialog and a sheet opened in
 * sequence do not visibly change the dimming behind them.
 */
export const scrim = {
  background: 'rgba(23, 23, 20, 0.45)',
  /** Lighter scrim for a menu that should not feel modal. */
  light: 'rgba(23, 23, 20, 0.28)',
} as const;

// --------------------------------------------------------------------- units

/**
 * Binary size units.
 *
 * A file manager is fundamentally about bytes, so the base and the unit table
 * are tokens rather than literals inside `formatBytes`. 1024, not 1000,
 * because that is what Android's own storage settings report — a file manager
 * that disagrees with the system about free space reads as broken.
 */
export const byteUnits = {
  base: 1024,
  /** 1 KB, 1 MB, … as used in displayed strings. */
  kilo: 1024,
  mega: 1024 ** 2,
  giga: 1024 ** 3,
  tera: 1024 ** 4,
} as const;

/** The unit labels used by `formatBytes`, largest last. */
export const byteUnitLabels = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

// ------------------------------------------------------------- storage fill

/**
 * How full a volume is, as a step.
 *
 * The storage bar cannot be colour-only (plan.md §40), so this is a *step* the
 * UI pairs with a percentage, not a gradient. `nominal` and `high` are the two
 * that matter: a bar past `high` should read as a warning, and a bar below
 * `low` should not.
 */
export const storageFill = {
  low: 0.75,
  nominal: 0.9,
  high: 0.95,
} as const;

export type StorageFillLevel = 'ok' | 'warn' | 'critical';

/** Classifies a 0–1 usage ratio, so the rule lives in one place. */
export function storageFillLevel(ratio: number): StorageFillLevel {
  if (ratio >= storageFill.high) return 'critical';
  if (ratio >= storageFill.nominal) return 'warn';
  return 'ok';
}

// ----------------------------------------------------------------- file types

/**
 * Which file types carry the accent tint.
 *
 * Folders and media, and nothing else. Tinting all of them would recreate the
 * problem a monochrome-plus-one palette exists to avoid, and would make the
 * browser read as noise rather than as a list. The value is data, not a branch
 * in the component, so the same rule can drive the filter chips and the grid.
 */
export const fileTypeTint = {
  /** Types drawn in the primary accent. */
  tinted: ['DIRECTORY', 'IMAGE', 'VIDEO'] as const,
  /** Types inheriting the row's text colour. */
  plain: ['AUDIO', 'DOCUMENT', 'ARCHIVE', 'APK', 'TEXT', 'CODE', 'FONT', 'UNKNOWN'] as const,
} as const;
