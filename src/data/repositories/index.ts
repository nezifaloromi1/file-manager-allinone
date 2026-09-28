import { type FileItem } from '#/domain/models/fileItem';
import { type TrashItem } from '#/domain/models/trash';
import { DEFAULT_SORT, type FilterSpec, EMPTY_FILTER, type SortSpec } from '#/domain/models/sort';
import { AsyncStorageCollection, isRecordArray, isStringRecord } from './AsyncStorageJson';

/**
 * Repositories for the app's own metadata (plan.md §26, §27, §25, §51).
 *
 * The storage provider is the source of truth for actual files — these records
 * are only ever *pointers* to files, plus the small amount of state the
 * filesystem cannot hold (which folders are starred, when a file was opened).
 * Nothing here can resurrect a file; a record pointing at a deleted file is
 * simply dropped on read.
 */

const FAVORITES_KEY = 'file-manager:favorites';
const RECENT_KEY = 'file-manager:recent';
const TRASH_KEY = 'file-manager:trash';
const SETTINGS_KEY = 'file-manager:settings';

/** plan.md §27: a bounded recent list, not an unbounded activity log. */
export const MAX_RECENT_ITEMS = 100;

export type Favorite = {
  id: string;
  uri: string;
  name: string;
  provider: string;
  createdAt: number;
};

export type RecentEntry = {
  id: string;
  uri: string;
  name: string;
  parentUri: string;
  type: string;
  mimeType: string | null;
  size: number | null;
  modifiedAt: number | null;
  openedAt: number;
};

export type AppSettings = {
  theme: 'system' | 'light' | 'dark';
  view: 'list' | 'grid';
  showHidden: boolean;
  confirmDelete: boolean;
  foldersFirst: boolean;
  showExtensions: boolean;
  accessMode: 'saf' | 'allFiles';
  trashEnabled: boolean;
  trashRetentionDays: number;
  defaultSort: SortSpec;
  defaultFilter: FilterSpec;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  view: 'list',
  showHidden: false,
  confirmDelete: true,
  foldersFirst: true,
  showExtensions: true,
  accessMode: 'saf',
  trashEnabled: true,
  trashRetentionDays: 30,
  defaultSort: DEFAULT_SORT,
  defaultFilter: EMPTY_FILTER,
};

/** Rejects settings that are structurally wrong, so a bad write cannot stick. */
function isValidSettings(value: unknown): value is AppSettings {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AppSettings>;
  return (
    (candidate.theme === 'system' || candidate.theme === 'light' || candidate.theme === 'dark') &&
    (candidate.view === 'list' || candidate.view === 'grid') &&
    typeof candidate.showHidden === 'boolean' &&
    typeof candidate.confirmDelete === 'boolean' &&
    typeof candidate.foldersFirst === 'boolean' &&
    typeof candidate.accessMode === 'string' &&
    typeof candidate.trashRetentionDays === 'number'
  );
}

const favorites = new AsyncStorageCollection<Favorite[]>(FAVORITES_KEY, [], isRecordArray);
const recent = new AsyncStorageCollection<RecentEntry[]>(RECENT_KEY, [], isRecordArray);
const trash = new AsyncStorageCollection<TrashItem[]>(TRASH_KEY, [], isRecordArray);
const settings = new AsyncStorageCollection<AppSettings>(
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  isValidSettings,
);

export const favoritesRepository = {
  async list(): Promise<Favorite[]> {
    const items = await favorites.read();
    return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  },

  async isFavorite(uri: string): Promise<boolean> {
    const items = await favorites.read();
    return items.some((item) => item.uri === uri);
  },

  async add(item: FileItem): Promise<void> {
    await favorites.update((items) => {
      // Re-adding an existing favourite refreshes its label rather than
      // duplicating it — the folder may have been renamed since.
      const without = items.filter((entry) => entry.uri !== item.uri);
      return [
        ...without,
        {
          id: item.id,
          uri: item.uri,
          name: item.name,
          provider: item.provider,
          createdAt: Date.now(),
        },
      ];
    });
  },

  async remove(uri: string): Promise<void> {
    await favorites.update((items) => items.filter((entry) => entry.uri !== uri));
  },

  /** Flips membership and reports the new state, for a single tap target. */
  async toggle(item: FileItem): Promise<boolean> {
    const items = await favorites.read();
    const exists = items.some((entry) => entry.uri === item.uri);
    if (exists) {
      await favoritesRepository.remove(item.uri);
      return false;
    }
    await favoritesRepository.add(item);
    return true;
  },

  async clear(): Promise<void> {
    await favorites.clear();
  },
};

export const recentRepository = {
  async list(): Promise<RecentEntry[]> {
    const items = await recent.read();
    return [...items].sort((a, b) => b.openedAt - a.openedAt);
  },

  /** Records an open (plan.md §27). Re-opening moves an entry to the top. */
  async record(item: FileItem): Promise<void> {
    await recent.update((items) => {
      const without = items.filter((entry) => entry.uri !== item.uri);
      const entry: RecentEntry = {
        id: item.id,
        uri: item.uri,
        name: item.name,
        parentUri: item.parentUri,
        type: item.type,
        mimeType: item.mimeType,
        size: item.size,
        modifiedAt: item.modifiedAt,
        openedAt: Date.now(),
      };
      return [entry, ...without].slice(0, MAX_RECENT_ITEMS);
    });
  },

  /**
   * Drops a single record.
   *
   * Used by the recent screen to prune pointers whose file no longer exists.
   * Without it a dead record would be re-resolved on every load forever.
   */
  async remove(id: string): Promise<void> {
    await recent.update((items) => items.filter((entry) => entry.id !== id));
  },

  async clear(): Promise<void> {
    await recent.clear();
  },
};

export const trashRepository = {
  async list(): Promise<TrashItem[]> {
    const items = await trash.read();
    return [...items].sort((a, b) => b.deletedAt - a.deletedAt);
  },

  async add(item: TrashItem): Promise<void> {
    await trash.update((items) => {
      // A re-trashed path replaces its old record rather than stacking.
      const without = items.filter((entry) => entry.id !== item.id);
      return [item, ...without];
    });
  },

  async update(id: string, patch: Partial<TrashItem>): Promise<void> {
    await trash.update((items) =>
      items.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  },

  async remove(id: string): Promise<void> {
    await trash.update((items) => items.filter((entry) => entry.id !== id));
  },

  async clear(): Promise<void> {
    await trash.clear();
  },
};

export const settingsRepository = {
  async get(): Promise<AppSettings> {
    return settings.read();
  },

  async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    await settings.update((current) => ({ ...current, [key]: value }));
  },

  async patch(values: Partial<AppSettings>): Promise<void> {
    await settings.update((current) => ({ ...current, ...values }));
  },

  async reset(): Promise<void> {
    await settings.clear();
  },
};

/** Clears every collection. Used by "reset app data" in Settings. */
export async function clearAllRepositories(): Promise<void> {
  await Promise.all([
    favoritesRepository.clear(),
    recentRepository.clear(),
    trashRepository.clear(),
    settingsRepository.reset(),
  ]);
}

export { isStringRecord };
