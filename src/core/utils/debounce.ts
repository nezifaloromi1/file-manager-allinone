/**
 * Trailing-edge debounce, used to keep search from re-scanning the filesystem on
 * every keystroke (plan.md §16, §46).
 */

export type Debounced<A extends unknown[]> = ((...args: A) => void) & {
  /** Runs any pending call immediately. */
  flush: () => void;
  /** Drops any pending call. */
  cancel: () => void;
  /** Whether a call is currently scheduled. */
  pending: () => boolean;
};

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const invoke = () => {
    timer = undefined;
    const args = lastArgs;
    lastArgs = undefined;
    if (args) {
      fn(...args);
    }
  };

  const debounced = ((...args: A) => {
    lastArgs = args;
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(invoke, waitMs);
  }) as Debounced<A>;

  debounced.flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      invoke();
    }
  };

  debounced.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    lastArgs = undefined;
  };

  debounced.pending = () => timer !== undefined;

  return debounced;
}
