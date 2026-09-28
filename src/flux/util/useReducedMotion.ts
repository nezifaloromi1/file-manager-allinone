import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the OS asks for reduced motion.
 *
 * Read from the platform setting rather than an in-app toggle, and honoured
 * because it is an accessibility requirement (plan.md §40). Starting from
 * `false` means a user who has the setting on briefly sees a transition while
 * the read resolves — the reverse, animating regardless once the user has
 * asked to stop, is the failure that actually matters.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduced(enabled);
    });

    // The setting can change while the app is open, so this subscribes rather
    // than reading once.
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (active) setReduced(enabled);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
