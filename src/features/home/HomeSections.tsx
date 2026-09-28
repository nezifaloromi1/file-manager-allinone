import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { atoms, useTheme } from '@/flux';
import { type FileItem } from '#/domain/models/fileItem';
import { providerForUri } from '#/data/storage';
import { favoritesRepository, recentRepository } from '#/data/repositories';
import { formatRelativeTime } from '#/core/utils/format';
import { useFocusRevision } from '@/features/navigation/useFocusRevision';
import { FileTypeGlyph } from '@/components/icons/FileTypeGlyph';
import { navigate } from '#/Navigation';

/**
 * The Home screen's Recent and Favorites strips (plan.md §4, §26, §27).
 *
 * ## Why both lists resolve their pointers
 *
 * Neither list is a cache of files — both are lists of URIs, and a URI stops
 * resolving the moment the file is deleted, moved, or the SD card is pulled. A
 * strip on Home is the first thing a user sees, so a row that opens an error
 * there is worse than a shorter list. Every record is re-read, dead ones are
 * dropped, and the storage entry is pruned so the next launch does not repeat
 * the work.
 *
 * ## Why the cap is small
 *
 * This is a preview, not the Recent screen. Six rows answers "what was I just
 * doing?" — the tenth row would push the category grid off the first screen,
 * which is the part of Home that earns its place.
 */

/** Rows in the Home strips. The full list lives on the Recent/Favorites tabs. */
const PREVIEW_COUNT = 6;

type SectionProps = {
  onOpenAll: () => void;
  onOpen: (uri: string, name: string) => void;
};

/** Shown in place of the strip when there is nothing to list. */
type EmptyProps = {
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
  onEmptyAction: () => void;
};

export function RecentSection({ onOpenAll, onOpen }: SectionProps) {
  // Recent files change because *other* screens open them, so this re-reads on
  // focus rather than only on mount — otherwise Home shows a stale list after
  // the user opens a file from the browser.
  const revision = useFocusRevision();
  const items = useStoredItems(
    useCallback(async () => (await recentRepository.list()).map((entry) => entry.uri), []),
    useCallback((uri) => recentRepository.remove(uri), []),
    revision,
  );

  return (
    <Strip
      title="Recent"
      items={items.value}
      loading={items.loading}
      emptyTitle="Nothing opened yet"
      emptyMessage="Files you open will show up here."
      emptyActionLabel="Browse files"
      onEmptyAction={() => void navigate('Browser', { uri: 'file:///storage/emulated/0/' })}
      onOpenAll={onOpenAll}
      allLabel="See all"
      onOpen={onOpen}
      testID="home.recent"
    />
  );
}

export function FavoritesSection({ onOpenAll, onOpen }: SectionProps) {
  // Favourites are toggled from the browser, so this re-reads on focus too.
  const revision = useFocusRevision();
  const items = useStoredItems(
    useCallback(async () => (await favoritesRepository.list()).map((entry) => entry.uri), []),
    useCallback((uri) => favoritesRepository.remove(uri), []),
    revision,
  );

  return (
    <Strip
      title="Favorites"
      items={items.value}
      loading={items.loading}
      emptyTitle="No favorites yet"
      emptyMessage="Long-press a folder in the browser and choose Add to favorites."
      emptyActionLabel="Browse files"
      onEmptyAction={() => void navigate('Browser', { uri: 'file:///storage/emulated/0/' })}
      onOpenAll={onOpenAll}
      allLabel="See all"
      onOpen={onOpen}
      testID="home.favorites"
    />
  );
}

function Strip({
  title,
  items,
  loading,
  emptyTitle,
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
  onOpenAll,
  allLabel,
  onOpen,
  testID,
}: SectionProps &
  EmptyProps & {
    title: string;
    items: FileItem[];
    loading: boolean;
    allLabel: string;
    testID: string;
  }) {
  const t = useTheme();

  return (
    <View style={atoms.gap_sm} testID={testID}>
      <View style={[atoms.flex_row, atoms.align_center, styles.heading]}>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.headingText]}>
          {title.toUpperCase()}
        </Text>
        {/* The link only appears when there is somewhere to go. An always-present
            "See all" on an empty section is a dead control. */}
        {items.length > 0 ? (
          <Pressable
            onPress={onOpenAll}
            hitSlop={8}
            testID={`${testID}.seeAll`}
            accessibilityRole="link"
          >
            <Text style={[atoms.text_2xs, atoms.font_medium, t.atoms.text_link]}>{allLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <Text style={[atoms.text_sm, t.atoms.text_contrast_low]}>Checking…</Text>
      ) : items.length === 0 ? (
        <View style={[atoms.p_md, t.atoms.bg_contrast_50, atoms.rounded_sm, atoms.gap_xs]}>
          <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text]}>{emptyTitle}</Text>
          <Text style={[atoms.text_2xs, t.atoms.text_contrast_medium, styles.emptyMessage]}>
            {emptyMessage}
          </Text>
          <Pressable onPress={onEmptyAction} hitSlop={8} testID={`${testID}.browse`}>
            <Text
              style={[atoms.text_2xs, atoms.font_medium, t.atoms.text_link, styles.emptyAction]}
            >
              {emptyActionLabel}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={atoms.gap_sm}
        >
          {items.map((item) => (
            <Pressable
              key={item.uri}
              onPress={() => onOpen(item.uri, item.name)}
              onLongPress={() =>
                item.isDirectory
                  ? void navigate('Browser', { uri: item.uri, title: item.name })
                  : void navigate('FileDetails', { uri: item.uri })
              }
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, opened ${formatRelativeTime(item.modifiedAt)}`}
              testID={`${testID}.cell`}
              style={({ pressed }) => [
                atoms.p_sm,
                atoms.gap_2xs,
                t.atoms.bg_contrast_50,
                atoms.rounded_sm,
                styles.cell,
                pressed && styles.pressed,
              ]}
            >
              <FileTypeGlyph type={item.type} size={28} color={t.palette.primary_500} />
              <Text
                numberOfLines={1}
                style={[atoms.text_2xs, atoms.font_medium, t.atoms.text, styles.cellName]}
              >
                {item.name}
              </Text>
              <Text numberOfLines={1} style={[atoms.text_2xs, t.atoms.text_contrast_low]}>
                {formatRelativeTime(item.modifiedAt)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Reads a stored list of URIs and returns the ones that still resolve.
 *
 * The records come from two different repositories with different `remove`
 * signatures, so the prune callback is passed in rather than assumed — and the
 * hook stays free of repository knowledge. `revision` is the invalidation
 * signal: the parent bumps it on focus, which re-runs the read without this
 * hook importing navigation.
 */
function useStoredItems(
  readUris: () => Promise<string[]>,
  prune: (uri: string) => Promise<unknown>,
  revision: number,
): { value: FileItem[]; loading: boolean } {
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const uris = await readUris();
        // Only the first page is resolved, so only it can be judged dead —
        // pruning a URI that was never checked would delete a good record.
        const checked = uris.slice(0, PREVIEW_COUNT);
        const resolved = await Promise.all(
          checked.map(async (uri) => {
            try {
              // Records can point at different providers, so the provider
              // follows the URI rather than being assumed.
              return await providerForUri(uri).getMetadata(uri);
            } catch {
              return null;
            }
          }),
        );
        if (!active) return;

        setItems(resolved.filter((item): item is FileItem => item !== null));
        checked.forEach((uri, index) => {
          if (resolved[index] === null) void prune(uri);
        });
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [prune, readUris, revision]);

  return { value: items, loading };
}

const styles = {
  heading: {
    justifyContent: 'space-between',
  },
  headingText: {
    letterSpacing: 0.6,
  },
  cell: {
    width: 132,
  },
  cellName: {
    width: '100%',
  },
  emptyMessage: {
    lineHeight: 16,
  },
  emptyAction: {
    paddingTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
} as const;
