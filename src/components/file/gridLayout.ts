/**
 * Grid layout maths, kept free of any React Native import.
 *
 * The numbers that decide how many columns a screen gets are the easiest thing
 * in the file browser to get subtly wrong and the hardest to notice — a grid
 * that renders one column on a tablet looks broken, not subtly wrong. Keeping
 * them here makes them testable without a device or a renderer.
 */

export const MIN_CELL_WIDTH = 104;
export const MAX_COLUMNS = 6;
export const GRID_GUTTER = 12;

/**
 * Columns that fit at a given width, clamped.
 *
 * Clamped at both ends deliberately: a very narrow screen must still get one
 * column (`numColumns={0}` is invalid and throws), and past a handful of
 * columns the cells become too small to read a filename or tap reliably.
 */
export function columnsForWidth(width: number): number {
  const usable = Math.max(0, width - GRID_GUTTER * 2);
  const columns = Math.floor(usable / MIN_CELL_WIDTH);
  return Math.max(1, Math.min(MAX_COLUMNS, columns));
}
