import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '#/flux';
import { type FileItem } from '#/domain/models/fileItem';
import { providerForUri } from '#/data/storage';
import { recentRepository } from '#/data/repositories';
import { DATE_BUCKET_LABELS } from '#/core/utils/format';
import { groupRecent } from '@/features/search/useSearch';
import { useDrawer } from '@/features/navigation/DrawerHost';
import { useFocusRevision } from '@/features/navigation/useFocusRevision';
import { Header } from '@/components/layout/Header';
import { FileRow } from '@/components/file/FileRow';
import { AsyncScreen } from '@/screens/PhasePlaceholder';
import { EmptyState } from '@/components/file/States';
import { navigate } from '#/Navigation';

/**
 * Recently opened files (plan.md §27).
 *
 * ## Why every record is re-resolved on load
 *
 * A record is a *pointer*, and pointers rot: the user deletes the file, renames
 * the folder, or restores a backup and the URI no longer resolves. Rendering the
 * stored list directly would show rows that open nothing.
 *
 * So each record is re-read from the filesystem, dead ones are pruned from
 * storage, and only the survivors are shown. The cost is one read per record on
 * a capped list of at most 100, which is cheap and buys a list that is never
 * lying.
 */

type RecentLoad = {
  items: FileItem[];
  /** Records whose file no longer exists; pruned from storage. */
  pruned: number;
};

export function RecentScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { open: openDrawer } = useDrawer();

  // Bumped on focus so the list re-reads; the store is the source of truth, not
  // a copy held in component state. Opening a file from this screen adds a
  // record, so a mount-only load would never show what the user just did.
  const revision = useFocusRevision();
  // Bumped after an explicit clear. The confirm alert does not refocus the
  // screen, so the clear cannot rely on the focus bump to trigger a re-read.
  const [cleared, setCleared] = useState(0);

  const load = useCallback(async (): Promise<RecentLoad> => {
    const records = await recentRepository.list();
    if (records.length === 0) return { items: [], pruned: 0 };

    const resolved = await Promise.all(
      records.map(async (record) => {
        try {
          // Each record can point at a different provider, so the provider is
          // chosen from its URI rather than assumed.
          return await providerForUri(record.uri).getMetadata(record.uri);
        } catch {
          return null;
        }
      }),
    );

    const items = resolved.filter((item): item is FileItem => item !== null);

    // Prune in the background so a slow write never delays the first paint.
    const dead = records.filter((record, index) => resolved[index] === null);
    if (dead.length > 0) {
      void Promise.all(dead.map((record) => recentRepository.remove(record.id)));
    }

    return { items, pruned: dead.length };
    // `revision` and `cleared` are invalidation signals, not data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleared, revision]);

  const confirmClear = useCallback(() => {
    Alert.alert('Clear recent files?', 'This removes the list of files you have opened.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          // The reload comes from the focus bump: the user leaves the alert,
          // which does not refocus the screen, so clear then re-read directly.
          void recentRepository.clear().then(() => setCleared((current) => current + 1));
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header
        title="Recent"
        onMenu={openDrawer}
        testID="recent.header"
        actions={[
          {
            label: 'Clear recent files',
            onPress: confirmClear,
            icon: <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text_link]}>Clear</Text>,
            testID: 'recent.clear',
          },
        ]}
      />

      <AsyncScreen load={load} loadingLabel="Checking recent files…" testID="recent.content">
        {({ items }) => {
          if (items.length === 0) {
            return (
              <EmptyState
                title="Nothing opened yet"
                message="Files you open will be listed here, most recent first."
                testID="recent.empty"
              />
            );
          }

          return (
            <ScrollView
              contentContainerStyle={[
                atoms.p_lg,
                atoms.gap_md,
                { paddingBottom: insets.bottom + 96 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {groupRecent(items).map((group) => (
                <View key={group.bucket} style={atoms.gap_sm}>
                  <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.section]}>
                    {DATE_BUCKET_LABELS[group.bucket].toUpperCase()}
                  </Text>
                  {group.items.map((item) => (
                    <FileRow
                      key={item.uri}
                      item={item}
                      onPress={(selected) => {
                        if (selected.isDirectory) {
                          void navigate('Browser', { uri: selected.uri, title: selected.name });
                          return;
                        }
                        void navigate('FileDetails', { uri: selected.uri });
                      }}
                      testID="recent.row"
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          );
        }}
      </AsyncScreen>
    </SafeAreaView>
  );
}

const styles = {
  section: {
    letterSpacing: 0.6,
  },
} as const;
