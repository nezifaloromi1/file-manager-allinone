import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '#/flux';
import { type FileItem } from '#/domain/models/fileItem';
import { providerForUri } from '#/data/storage';
import { favoritesRepository, type Favorite } from '#/data/repositories';
import { useDrawer } from '@/features/navigation/DrawerHost';
import { useFocusRevision } from '@/features/navigation/useFocusRevision';
import { Header } from '@/components/layout/Header';
import { FileRow } from '@/components/file/FileRow';
import { AsyncScreen } from '@/screens/PhasePlaceholder';
import { EmptyState } from '@/components/file/States';
import { navigate } from '#/Navigation';
import { formatRelativeTime } from '#/core/utils/format';

/**
 * Bookmarked folders (plan.md §26).
 *
 * Records are pointers, so they are re-resolved on load exactly as recent files
 * are: a folder deleted or renamed in another app must not leave a row that
 * opens nothing. Dead records are pruned rather than merely hidden, so the list
 * does not fill with ghosts over time.
 *
 * Ordering is alphabetical rather than by date added, because a favourites list
 * is a small set a user scans for a name — the opposite of a recency list.
 */
export function FavoritesScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { open: openDrawer } = useDrawer();

  // Favourites are toggled from the browser, so this re-reads on focus — a
  // mount-only load would show a list missing the folder just bookmarked.
  const revision = useFocusRevision();
  // Bumped after an explicit clear; the confirm alert does not refocus.
  const [cleared, setCleared] = useState(0);

  const load = useCallback(async () => {
    const records = await favoritesRepository.list();
    if (records.length === 0) return { items: [] as { item: FileItem; record: Favorite }[] };

    const resolved = await Promise.all(
      records.map(async (record) => {
        try {
          return await providerForUri(record.uri).getMetadata(record.uri);
        } catch {
          return null;
        }
      }),
    );

    const items = records
      .map((record, index) => ({ item: resolved[index], record }))
      .filter((entry): entry is { item: FileItem; record: Favorite } => entry.item !== null);

    const dead = records.filter((record) => !resolved.some((item) => item?.uri === record.uri));
    if (dead.length > 0) {
      void Promise.all(dead.map((record) => favoritesRepository.remove(record.uri)));
    }

    return { items };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleared, revision]);

  const confirmRemoveAll = useCallback(() => {
    Alert.alert('Remove all favorites?', 'This clears the bookmarked folders list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove all',
        style: 'destructive',
        onPress: () => {
          void favoritesRepository.clear().then(() => setCleared((current) => current + 1));
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header
        title="Favorites"
        onMenu={openDrawer}
        testID="favorites.header"
        actions={[
          {
            label: 'Remove all favorites',
            onPress: confirmRemoveAll,
            icon: <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text_link]}>Clear</Text>,
            testID: 'favorites.clear',
          },
        ]}
      />

      <AsyncScreen load={load} loadingLabel="Checking favorites…" testID="favorites.content">
        {({ items }) => {
          if (items.length === 0) {
            return (
              <EmptyState
                title="No favorites yet"
                message="Long-press a folder in the browser and choose Add to favorites."
                testID="favorites.empty"
              />
            );
          }

          return (
            <ScrollView
              contentContainerStyle={[
                atoms.p_lg,
                atoms.gap_sm,
                { paddingBottom: insets.bottom + 96 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {items.map(({ item }) => (
                <FileRow
                  key={item.uri}
                  item={item}
                  onPress={(selected) => {
                    void navigate('Browser', { uri: selected.uri, title: selected.name });
                  }}
                  trailing={
                    <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>
                      {formatRelativeTime(item.modifiedAt)}
                    </Text>
                  }
                  testID="favorites.row"
                />
              ))}
            </ScrollView>
          );
        }}
      </AsyncScreen>
    </SafeAreaView>
  );
}
