import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * A counter that increments whenever the screen regains focus.
 *
 * ## Why this exists
 *
 * Several screens show data that changes *because of something they did not
 * do*: Home's recent and favourites strips update when a file is opened or
 * bookmarked from the browser, and the Recent/Favorites tabs change when an
 * entry is pruned. Refetching on focus is the fix; bumping a number is how the
 * refetch gets expressed as a `useEffect` dependency.
 *
 * Using a counter rather than a boolean matters: returning to a screen and
 * leaving it again must trigger a second refetch, and a boolean that only ever
 * flips one way would fire exactly once.
 *
 * The navigation import is deliberate — this is a navigation concern, not a
 * data concern, so it does not belong in the hooks that read storage.
 */
export function useFocusRevision(): number {
  const [revision, setRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRevision((current) => current + 1);
    }, []),
  );

  return revision;
}
