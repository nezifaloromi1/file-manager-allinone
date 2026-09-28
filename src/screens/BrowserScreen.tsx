import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import {
  Alert,
  FlatList,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '@/flux';
import { toAppError } from '#/core/errors';
import { formatBytes, formatCount } from '#/core/utils/format';
import { type FileItem } from '#/domain/models/fileItem';
import { DEFAULT_SORT, EMPTY_FILTER, type FilterSpec, type SortSpec } from '#/domain/models/sort';
import {
  basenameOf,
  canGoUp,
  createFolder,
  renameItem,
  toBreadcrumbs,
  type Breadcrumb,
} from '#/domain/usecases/folder';
import { providerForUri } from '#/data/storage';
import {
  favoritesRepository,
  recentRepository,
  settingsRepository,
  type AppSettings,
} from '#/data/repositories';
import { openFile as openWithSystemApp } from '#/data/share';
import { INTERNAL_STORAGE_URI, volumeRootFor } from '#/data/storage/paths';
import { debounce } from '#/core/utils/debounce';
import { useDirectory, useSelection } from '@/features/browser/useDirectory';
import { useOperations } from '@/features/operations/OperationsProvider';
import { setPendingTransfer } from '@/features/operations/pendingTransfer';
import { NameDialog } from '@/components/file/NameDialog';
import { Breadcrumbs } from '@/features/browser/Breadcrumbs';
import { BrowserMenuItems, BrowserToolbar } from '@/features/browser/BrowserToolbar';
import { reportDeleteOutcome } from '@/features/trash/reportDelete';
import { FileRow } from '@/components/file/FileRow';
import { FileGrid, columnsForWidth } from '@/components/file/FileGrid';
import { SearchBar } from '@/components/file/SearchBar';
import { SelectionBar, type SelectionAction } from '@/components/file/SelectionBar';
import { SortFilterSheet } from '@/components/file/SortFilterSheet';
import { EmptyFolderState, ErrorState, LoadingState } from '@/components/file/States';
import type { AllNavigatorParams, NavigationProp } from '#/lib/routes/types';

/**
 * The file browser (plan.md §5, §6, §7).
 *
 * The heart of the app. Lists one directory, supports list and grid views,
 * sorting, filtering, an in-folder filter field, hidden files, and multi-select.
 *
 * ## Two things worth knowing about the implementation
 *
 * **The provider is chosen by URI, not by screen.** A `content://` URI routes
 * to `SafStorageProvider`, a `file://` URI to `LocalStorageProvider`. The
 * browser has no branch on which backend it is talking to — that is plan §9
 * working — and it picks up a SAF folder or internal storage identically.
 *
 * **Nothing here performs a file operation.** Opening a file and every
 * destructive action arrive in Phases 7 and 8. Tapping a file therefore pushes
 * the details screen, and the selection bar's actions are not yet wired, rather
 * than this screen growing a half-built copy implementation.
 */

type BrowserRoute = RouteProp<AllNavigatorParams, 'Browser'>;

export function BrowserScreen() {
  const t = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<BrowserRoute>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const uri = route.params?.uri ?? INTERNAL_STORAGE_URI;
  const title = route.params?.title ?? (basenameOf(uri) || 'Files');

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [sort, setSort] = useState<SortSpec>(DEFAULT_SORT);
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  // The sheet's type/size/date axes were accepted and dropped. They work now
  // (plan.md §18); the search screen is where a full query lives.
  const [filter, setFilter] = useState<FilterSpec>(EMPTY_FILTER);
  const [isFavorite, setIsFavorite] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [namePrompt, setNamePrompt] = useState<
    { mode: 'create' } | { mode: 'rename'; item: FileItem } | null
  >(null);
  const [view, setView] = useState<'list' | 'grid'>('list');

  const provider = useMemo(() => providerForUri(uri), [uri]);
  const { deleteItems } = useOperations();

  // Settings decide the initial sort, hidden-file state, and view. Loaded once;
  // the repository caches, so this is a single read rather than a re-fetch per
  // render.
  const [loadingSettings, setLoadingSettings] = useState(true);
  useEffect(() => {
    let active = true;
    void settingsRepository.get().then((loaded) => {
      // Guarded because the screen can unmount while the read is in flight.
      if (!active) return;
      setSettings(loaded);
      setSort(loaded.defaultSort);
      setShowHidden(loaded.showHidden);
      setView(loaded.view);
      setLoadingSettings(false);
    });
    return () => {
      active = false;
    };
  }, []);

  /**
   * The live filter is the sheet's axes plus the in-folder query.
   *
   * Kept derived rather than merged into one piece of state, so clearing the
   * sheet does not wipe what the user typed into the search field.
   */
  const effectiveFilter = useMemo<FilterSpec>(
    () => ({ ...filter, query: debouncedQuery }),
    [debouncedQuery, filter],
  );

  // Debounced so typing does not re-filter the list on every keystroke. A
  // directory can hold 100,000 entries and filtering is O(n) (plan.md §16).
  const pushQuery = useMemo(() => debounce((value: string) => setDebouncedQuery(value), 180), []);

  const onChangeQuery = useCallback(
    (value: string) => {
      setQuery(value);
      pushQuery(value);
    },
    [pushQuery],
  );

  const directory = useDirectory({ uri, sort, showHidden, filter: effectiveFilter });

  // Destructured rather than used as `selection.x` so the render callbacks can
  // depend on the individual stable callbacks. The hook returns a fresh object
  // each render, so depending on the object itself would defeat every memo.
  const { selectedUris, isActive, isSelected, toggle, clear, selectAll } = useSelection();

  const selectedItems = useMemo(
    () => directory.items.filter((item) => selectedUris.has(item.uri)),
    [directory.items, selectedUris],
  );

  const crumbs = useMemo(() => {
    const { rootUri, label } = volumeRootFor(uri);
    return toBreadcrumbs(uri, rootUri, label);
  }, [uri]);

  const columns = useMemo(() => columnsForWidth(width), [width]);

  const openFolder = useCallback(
    (item: FileItem) => {
      navigation.dispatch(StackActions.push('Browser', { uri: item.uri, title: item.name }));
    },
    [navigation],
  );

  /**
   * Opens a file with whichever app can handle it (plan.md §14), or falls back
   * to the details screen when nothing can — the browser must not look broken
   * for an unsupported format.
   */
  const openFile = useCallback(
    async (item: FileItem) => {
      try {
        await openWithSystemApp(provider, item);
        // Recorded only after a successful open, so "recent" reflects files that
        // actually opened (plan.md §27).
        await recentRepository.record(item);
      } catch (caught) {
        const failure = toAppError(caught, { operation: 'open' });
        // "Nothing can open this" is a normal outcome, not an error to shout
        // about — the details screen explains it and offers Share instead.
        if (failure.code === 'UNSUPPORTED') {
          navigation.dispatch(StackActions.push('FileDetails', { uri: item.uri }));
          return;
        }
        Alert.alert(
          failure.title,
          failure.hint ? `${failure.message}\n\n${failure.hint}` : failure.message,
        );
      }
    },
    [navigation, provider],
  );

  const onPressItem = useCallback(
    (item: FileItem) => {
      if (isActive) {
        toggle(item.uri);
        return;
      }
      if (item.isDirectory) openFolder(item);
      else void openFile(item);
    },
    [isActive, openFile, openFolder, toggle],
  );

  const onLongPressItem = useCallback(
    (item: FileItem) => {
      toggle(item.uri);
    },
    [toggle],
  );

  /**
   * Handles a selection-bar action (plan.md §7).
   *
   * Copy and move stage the selection and open the destination picker; the
   * picker owns the rest of the gesture, so nothing is half-done here. Delete is
   * confirmed first — plan.md §51 makes "confirm before deleting" a setting, and
   * a destructive action on a 40-item selection must never be one tap.
   */
  const onSelectionAction = useCallback(
    (action: SelectionAction) => {
      const items = selectedItems;
      if (items.length === 0) return;

      if (action === 'copy' || action === 'move') {
        if (!(action === 'copy' ? provider.capabilities.canCopy : provider.capabilities.canMove)) {
          return;
        }
        setPendingTransfer(action, items);
        navigation.dispatch(
          StackActions.push('DestinationPicker', { operationId: 'pending', mode: action }),
        );
        return;
      }

      if (action === 'delete') {
        // Whether the trash applies is decided *here*, from the same two values
        // that decide the wording, so the dialog and the operation can never
        // disagree about what is about to happen.
        const useTrash =
          (settings?.trashEnabled ?? true) && provider.capabilities.canRelocateToTrash;

        const run = () => {
          void deleteItems(items, provider, { useTrash }).then((summary) => {
            if (summary.completed > 0) {
              clear();
              directory.refresh();
            }
            reportDeleteOutcome(summary);
          });
        };

        if (settings?.confirmDelete ?? true) {
          Alert.alert(
            items.length === 1 ? `Delete ${items[0].name}?` : `Delete ${items.length} items?`,
            useTrash
              ? `Moved to the trash, where ${settings?.trashRetentionDays ?? 30} days of items are kept. You can restore them from Trash.`
              : 'This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: useTrash ? 'Move to trash' : 'Delete', style: 'destructive', onPress: run },
            ],
          );
        } else {
          run();
        }
        return;
      }

      if (action === 'rename' && items.length === 1) {
        setNamePrompt({ mode: 'rename', item: items[0] });
        return;
      }

      if (action === 'more') {
        setMenuOpen(true);
      }
    },
    [clear, deleteItems, directory, navigation, provider, selectedItems, settings],
  );

  /**
   * Creates a folder or renames an item (plan.md §20, §21).
   *
   * Validation, the exists check, and error translation all live in the domain
   * use case — this only supplies the parent URI and refreshes afterwards, so
   * every entry point gets identical behaviour.
   */
  const onSubmitName = useCallback(
    async (name: string) => {
      if (!namePrompt) return;
      const prompt = namePrompt;
      setNamePrompt(null);

      try {
        if (prompt.mode === 'create') {
          await createFolder(provider, uri, name);
        } else {
          const renamed = await renameItem(provider, prompt.item, name, async () => 'KEEP_BOTH');
          if (renamed === null) {
            // The user cancelled the collision prompt; nothing changed, but the
            // dialog is already dismissed so a refresh is harmless.
          }
        }
        directory.refresh();
      } catch (caught) {
        const failure = toAppError(caught, { operation: prompt.mode });
        Alert.alert(failure.title, failure.detail);
      }
    },
    [directory, namePrompt, provider, uri],
  );

  const onSelectAll = useCallback(() => {
    selectAll(directory.items.map((item) => item.uri));
  }, [directory.items, selectAll]);

  const toggleHidden = useCallback(() => {
    const next = !showHidden;
    setShowHidden(next);
    // Persisted, because "show hidden files" is a stated user preference
    // (plan.md §51) and should survive a restart.
    void settingsRepository.set('showHidden', next);
  }, [showHidden]);

  const toggleView = useCallback(() => {
    setView((current) => {
      const next = current === 'list' ? 'grid' : 'list';
      void settingsRepository.set('view', next);
      return next;
    });
  }, []);

  /** Bookmarks the current folder, or un-bookmarks it (plan.md §26). */
  const toggleFavorite = useCallback(async () => {
    const [folder] = await provider.getMetadata(uri).then((found) => (found ? [found] : []));
    if (!folder) {
      Alert.alert("Couldn't bookmark this folder", 'It is no longer available.');
      return;
    }
    const nowFavorite = await favoritesRepository.toggle(folder);
    setIsFavorite(nowFavorite);
    setMenuOpen(false);
  }, [provider, uri]);

  // Re-read on focus: the bookmark may have been removed from the Favorites tab.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void favoritesRepository.isFavorite(uri).then((value) => {
        if (active) setIsFavorite(value);
      });
      return () => {
        active = false;
      };
    }, [uri]),
  );

  const goUp = useCallback(() => {
    // Guarded against the volume root. Without this, "up" at
    // `/storage/emulated/0/` pops into the parent the user came from, or at the
    // very bottom of the stack does nothing at all — both look broken.
    const { rootUri } = volumeRootFor(uri);
    if (!canGoUp(uri, rootUri)) return;
    // Pop rather than push: going up should shrink the stack, or the user
    // accumulates a history they then have to back through twice.
    navigation.dispatch(StackActions.pop(1));
  }, [navigation, uri]);

  const onPressCrumb = useCallback(
    (crumb: Breadcrumb) => {
      if (crumb.uri === uri) return;
      navigation.dispatch(StackActions.push('Browser', { uri: crumb.uri, title: crumb.label }));
    },
    [navigation, uri],
  );

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileItem>) => (
      <FileRow
        item={item}
        onPress={onPressItem}
        onLongPress={onLongPressItem}
        selectionMode={isActive}
        selected={isSelected(item.uri)}
        showExtension={settings?.showExtensions ?? true}
      />
    ),
    [isActive, isSelected, onLongPressItem, onPressItem, settings?.showExtensions],
  );

  if (directory.state === 'error' && directory.error) {
    return (
      <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
        <ToolbarOnly
          onBack={goUp}
          title={title}
          onSearch={() => setSearchVisible(true)}
          onOverflow={() => setMenuOpen(true)}
        />
        <ErrorState error={directory.error} onRetry={directory.retry} testID="browser.error" />
      </SafeAreaView>
    );
  }

  // Grid is disabled during selection: a selectable grid needs per-tile check
  // states that Phase 7 has not built, and a half-built one is worse than a
  // list that works.
  const showGrid = view === 'grid' && !isActive;

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <BrowserToolbar
        title={title}
        onBack={goUp}
        onSearch={() => setSearchVisible((current) => !current)}
        onOverflow={() => setMenuOpen((current) => !current)}
      />

      <Breadcrumbs crumbs={crumbs} onPressCrumb={onPressCrumb} />

      {searchVisible ? (
        <View style={atoms.px_md}>
          <SearchBar
            value={query}
            onChangeText={onChangeQuery}
            onClear={() => onChangeQuery('')}
            placeholder="Filter this folder"
            testID="browser.search"
          />
        </View>
      ) : null}

      {menuOpen ? (
        <View style={[atoms.rounded_lg, t.atoms.bg_card, styles.menu]} testID="browser.menu.sheet">
          <BrowserMenuItems
            onNewFolder={() => {
              setMenuOpen(false);
              setNamePrompt({ mode: 'create' });
            }}
            onSort={() => {
              setMenuOpen(false);
              setSortSheetOpen(true);
            }}
            sort={sort}
            onToggleHidden={() => {
              toggleHidden();
              setMenuOpen(false);
            }}
            hiddenShown={showHidden}
            onToggleView={() => {
              toggleView();
              setMenuOpen(false);
            }}
            view={view}
            onSelectAll={() => {
              onSelectAll();
              setMenuOpen(false);
            }}
            onToggleFavorite={() => void toggleFavorite()}
            isFavorite={isFavorite}
          />
        </View>
      ) : null}

      {directory.state === 'loading' && directory.items.length === 0 ? (
        loadingSettings ? (
          <LoadingState label="Opening folder…" />
        ) : (
          <LoadingState />
        )
      ) : showGrid ? (
        <FileGrid
          items={directory.items}
          columns={columns}
          onPress={onPressItem}
          onLongPress={onLongPressItem}
          showExtension={settings?.showExtensions ?? true}
          emptyState={
            <EmptyFolderState
              isFiltered={directory.isFiltered}
              onClearFilters={() => onChangeQuery('')}
            />
          }
        />
      ) : (
        <FlatList
          data={directory.items}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          refreshing={directory.state === 'refreshing'}
          onRefresh={directory.refresh}
          ListEmptyComponent={
            <EmptyFolderState
              isFiltered={directory.isFiltered}
              onClearFilters={() => onChangeQuery('')}
            />
          }
          ListFooterComponent={
            directory.items.length > 0 ? <FooterSummary view={directory} /> : null
          }
          // Rows are fixed height, so a small window recycles aggressively
          // without measuring each one (plan.md §46).
          initialNumToRender={14}
          maxToRenderPerBatch={12}
          windowSize={9}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 160 }]}
        />
      )}

      {isActive ? (
        <SelectionBar
          selectedItems={selectedItems}
          onClear={clear}
          onSelectAll={onSelectAll}
          onAction={onSelectionAction}
          disabledActions={{
            copy: provider.capabilities.canCopy
              ? undefined
              : 'Not available for folders granted through the system picker.',
            move: provider.capabilities.canMove
              ? undefined
              : 'Not available for folders granted through the system picker.',
          }}
          testID="browser.selectionBar"
        />
      ) : null}

      <NameDialog
        visible={namePrompt !== null}
        mode={namePrompt?.mode ?? 'create'}
        initialValue={namePrompt?.mode === 'rename' ? namePrompt.item.name : ''}
        onCancel={() => setNamePrompt(null)}
        onSubmit={(name) => void onSubmitName(name)}
        isTaken={(name) =>
          namePrompt?.mode === 'rename' && name === namePrompt.item.name
            ? false
            : directory.items.some((item) => item.name === name)
        }
        testID="browser.nameDialog"
      />

      <SortFilterSheet
        visible={sortSheetOpen}
        sort={sort}
        filter={filter}
        onSortChange={setSort}
        onFilterChange={setFilter}
        onClose={() => setSortSheetOpen(false)}
        matchCount={directory.items.length}
        totalCount={directory.fileCount + directory.folderCount}
      />
    </SafeAreaView>
  );
}

/** A header shown when there is nothing to list, so the user can still go back. */
function ToolbarOnly({
  onBack,
  title,
  onSearch,
  onOverflow,
}: {
  onBack: () => void;
  title: string;
  onSearch: () => void;
  onOverflow: () => void;
}) {
  return (
    <BrowserToolbar title={title} onBack={onBack} onSearch={onSearch} onOverflow={onOverflow} />
  );
}

/** `12 items · 4 folders · 1.2 GB` under the list. */
function FooterSummary({ view }: { view: ReturnType<typeof useDirectory> }) {
  const t = useTheme();

  const parts = [
    formatCount(view.fileCount, 'file'),
    `${view.folderCount} ${view.folderCount === 1 ? 'folder' : 'folders'}`,
  ];
  if (view.totalBytes > 0) parts.push(formatBytes(view.totalBytes));

  return (
    <View style={[atoms.p_lg, atoms.py_md]}>
      <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]} testID="browser.summary">
        {parts.join(' · ')}
      </Text>
    </View>
  );
}

/**
 * Keyed by URI, never by name.
 *
 * Two files can share a name in different folders; keying by name makes
 * `FlatList` recycle the wrong row, which shows the wrong size and opens the
 * wrong file (plan.md §12).
 */
function keyExtractor(item: FileItem): string {
  return item.uri;
}

const styles = {
  listContent: {
    flexGrow: 1,
  },
  menu: {
    marginHorizontal: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
} as const;
