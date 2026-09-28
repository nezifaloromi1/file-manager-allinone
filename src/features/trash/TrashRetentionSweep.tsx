import { useEffect } from 'react';

import { sweepExpired } from '#/data/trash';

/**
 * Enforces the trash's retention window once per launch (plan.md §25).
 *
 * ## Why a launch effect and not a timer
 *
 * "Deleted after 30 days" is a promise, and a promise needs something that
 * checks. On Android a timer is not that something: Doze defers it, process
 * death cancels it, and a force-stopped app never runs it. A timer would
 * therefore make retention true only on devices that happen to stay in the
 * foreground, which is exactly the set of devices where the user is not worried
 * about it.
 *
 * Running on mount means the trash is guaranteed to shrink on the next launch,
 * and nothing background is claimed that the OS will not honour.
 *
 * ## Why it is not awaited before the first screen
 *
 * Purging a few hundred files can take seconds. Blocking the splash screen on it
 * would make every cold start feel slow to fix a problem the user is not
 * currently looking at. The sweep runs in the background, and a failure is
 * swallowed — the next launch tries again.
 */
export function TrashRetentionSweep() {
  useEffect(() => {
    void sweepExpired().catch(() => 0);
  }, []);

  return null;
}
