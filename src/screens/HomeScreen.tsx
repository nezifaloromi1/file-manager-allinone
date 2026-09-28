import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '@/flux';
import { type AppError, toAppError } from '#/core/errors';
import { type StorageUsage, createStorageUsage } from '#/domain/models/storage';
import { localProvider, localProvider as providerFor } from '#/data/storage';
import { settingsRepository } from '#/data/repositories';
import { ErrorState, LoadingState } from '@/components/file/States';
import { PermissionCard } from '@/components/file/PermissionCard';
import { StorageCard } from '@/components/file/StorageCard';
import {
  GridGlyph,
  NewFolderGlyph,
  OverflowGlyph,
  StarGlyph,
  TrashGlyph,
} from '@/components/icons/ChromeGlyphs';
import { FolderGlyph } from '@/components/icons/FileTypeGlyph';
import { MagnifyingGlass_Stroke2_Corner0_Rounded } from '@/components/icons/MagnifyingGlass';
import {
  CATEGORIES,
  type CategoryId,
  type Category,
  findCategory,
} from '#/domain/models/categories';
import { CategoryTile } from '@/features/home/CategoryTile';
import { FavoritesSection, RecentSection } from '@/features/home/HomeSections';
import { Header } from '@/components/layout/Header';
import { useDrawer } from '@/features/navigation/DrawerHost';
import { QuickAction } from '@/features/home/QuickAction';
import { navigate } from '#/Navigation';
import type { NavigationProp } from '#/lib/routes/types';

/**
 * Home (plan.md §4).
 *
 * Built in two passes. This is the first: the header, live storage card, quick
 * actions, and — when access has not been granted — the permission prompt.
 * Recent files, favourites, and the category grid land in Phase 9, once the
 * repositories behind them are wired up.
 *
 * The storage figures are read on mount and after `onFocus`, because free space
 * moves while the user is looking at it. Re-reading on every focus is cheap
 * (one platform call) and prevents a stale "42 GB free" from being trusted.
 */

export function HomeScreen() {
  const t = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { open: openDrawer } = useDrawer();

  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);

  const load = useCallback(async () => {
    try {
      const [volumes, settings] = await Promise.all([
        localProvider().listVolumes(),
        settingsRepository.get(),
      ]);
      setUsage(createStorageUsage(volumes[0]));
      setAccessGranted(settings.accessMode === 'allFiles');
      setError(null);
    } catch (caught) {
      setError(toAppError(caught, { operation: 'home:load' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Free space moves without the user doing anything, so re-read on focus.
  // One platform call is cheap; a stale "42 GB free" is not.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openBrowser = useCallback(
    (uri: string, title: string) => navigation.navigate('Browser', { uri, title }),
    [navigation],
  );

  /**
   * Opens a path-based category ("Downloads") at the folder that backs it.
   *
   * Tries each well-known name in turn and falls back to the volume root, rather
   * than assuming `Download/` exists — a phone where the user has never used the
   * browser app often has no such folder, and navigating into a missing one
   * lands on an error screen.
   */
  const openCategoryDirectory = useCallback(
    async (category: Category) => {
      const root = usage?.volume.rootUri ?? 'file:///storage/emulated/0/';
      for (const path of category.paths) {
        const uri = `${root}${path.replace(/^\/+|\/+$/g, '')}/`;
        try {
          const found = await providerFor().getMetadata(uri);
          if (found?.isDirectory) {
            navigation.navigate('Browser', { uri, title: category.label });
            return;
          }
        } catch {
          // Absent or unreadable: try the next well-known name.
        }
      }
      navigation.navigate('Browser', { uri: root, title: category.label });
    },
    [navigation, usage],
  );

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header
        title="File Manager"
        onMenu={openDrawer}
        testID="home.header"
        actions={[
          {
            label: 'Search files',
            onPress: () => navigation.navigate('Search', {}),
            icon: <MagnifyingGlass_Stroke2_Corner0_Rounded size={20} color={t.atoms.text.color} />,
            testID: 'home.search',
          },
          {
            label: 'Open settings',
            onPress: () => void navigate('SettingsTab'),
            icon: <OverflowGlyph size={20} color={t.atoms.text.color} />,
            testID: 'home.more',
          },
        ]}
      />

      <ScrollView
        contentContainerStyle={[
          atoms.p_lg,
          atoms.gap_lg,
          styles.content,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <ErrorState error={error} onRetry={() => void load()} />
        ) : loading ? (
          <LoadingState label="Reading storage…" />
        ) : usage ? (
          <StorageCard
            usage={usage}
            onPress={() => openBrowser(usage.volume.rootUri, usage.volume.label)}
            testID="home.storageCard"
          />
        ) : null}

        {accessGranted ? (
          <View style={atoms.gap_sm}>
            <SectionTitle>Quick actions</SectionTitle>
            <View style={[atoms.flex_row, atoms.gap_sm]}>
              <QuickAction
                label="New folder"
                icon={<NewFolderGlyph size={20} color={t.atoms.text.color} />}
                onPress={() =>
                  navigation.navigate('NamePrompt', { mode: 'create', initialValue: '' })
                }
                testID="home.newFolder"
              />
              <QuickAction
                label="Search"
                icon={
                  <MagnifyingGlass_Stroke2_Corner0_Rounded size={20} color={t.atoms.text.color} />
                }
                onPress={() => navigation.navigate('Search', {})}
                testID="home.searchAction"
              />
              <QuickAction
                label="Files"
                icon={<FolderGlyph size={20} color={t.atoms.text.color} />}
                onPress={() => usage && openBrowser(usage.volume.rootUri, 'Internal storage')}
                testID="home.files"
              />
            </View>
          </View>
        ) : (
          <PermissionCard
            state={{ kind: 'allFiles', granted: false }}
            onGrant={() => navigation.navigate('StorageAccess')}
            testID="home.permission"
          />
        )}

        <View style={atoms.gap_sm}>
          <SectionTitle>Browse by type</SectionTitle>
          <CategoryGrid
            columns={width >= 600 ? 4 : 3}
            onSelect={(id: CategoryId) => {
              const category = findCategory(id);
              if (!category) return;
              // A type category opens a search already narrowed to those types,
              // which is what the tile promises. `Downloads` has no types — it is
              // a directory shortcut, so it opens the browser at the well-known
              // path instead of running a search that could never match.
              if (category.types.length > 0) {
                navigation.navigate('Search', {
                  rootUri: usage?.volume.rootUri,
                  types: [...category.types],
                  category: category.id,
                });
                return;
              }
              openCategoryDirectory(category);
            }}
          />
        </View>

        <RecentSection
          onOpenAll={() => void navigate('RecentTab')}
          onOpen={(uri, name) => openBrowser(uri, name)}
        />

        <FavoritesSection
          onOpenAll={() => void navigate('FavoritesTab')}
          onOpen={(uri, name) => openBrowser(uri, name)}
        />

        <View style={atoms.gap_sm}>
          <SectionTitle>Other</SectionTitle>
          <View style={[atoms.flex_row, atoms.gap_sm]}>
            <QuickAction
              label="Trash"
              icon={<TrashGlyph size={20} color={t.atoms.text.color} />}
              onPress={() => navigation.navigate('Trash')}
              testID="home.trash"
            />
            <QuickAction
              label="Favorites"
              icon={<StarGlyph size={20} color={t.atoms.text.color} />}
              onPress={() => void navigate('FavoritesTab')}
              testID="home.favorites"
            />
            <QuickAction
              label="Storage"
              icon={<GridGlyph size={20} color={t.atoms.text.color} />}
              onPress={() => void navigate('StorageTab')}
              testID="home.storage"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.sectionTitle]}>
      {children.toUpperCase()}
    </Text>
  );
}

function CategoryGrid({
  columns,
  onSelect,
}: {
  columns: number;
  onSelect: (id: CategoryId) => void;
}) {
  const t = useTheme();
  return (
    <View style={[atoms.flex_row, atoms.flex_wrap, styles.grid]}>
      {CATEGORIES.map((category) => (
        <View key={category.id} style={[styles.gridCell, { width: `${100 / columns}%` }]}>
          <CategoryTile
            category={category}
            onPress={() => onSelect(category.id)}
            color={t.palette.primary_500}
          />
        </View>
      ))}
    </View>
  );
}

const styles = {
  content: {
    // Centres on a tablet instead of stretching a phone layout to full width.
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  sectionTitle: {
    letterSpacing: 0.6,
  },
  grid: {
    marginHorizontal: -4,
  },
  gridCell: {
    padding: 4,
  },
  footnote: {
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.6,
  },
} as const;
