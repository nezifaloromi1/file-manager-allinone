import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A typed, versioned AsyncStorage collection.
 *
 * plan.md §34 lists SQLite tables for `favorites`, `recent_files`, and
 * `trash_items`, but that choice was made for native Kotlin. This app runs on
 * AsyncStorage (see `progress.md`), which is a better fit for the actual data:
 * these are all small bounded lists — tens of favourites, a capped recent list,
 * a trash that the user is expected to empty — not the open-ended file index
 * that would justify a database.
 *
 * Everything here is defensive about corruption. AsyncStorage holds untyped JSON
 * that survives app upgrades, so a shape change between versions must degrade
 * to "empty" rather than crash the launch path.
 */

export const STORAGE_VERSION = 1;

type Envelope<T> = {
  version: number;
  data: T;
};

export class AsyncStorageCollection<T> {
  private readonly key: string;
  private readonly fallback: T;
  private readonly isValid: (value: unknown) => boolean;

  /** In-memory mirror, so reads avoid an async round-trip on every render. */
  private cache: T | null = null;
  private inflight: Promise<T> | null = null;

  constructor(key: string, fallback: T, isValid: (value: unknown) => boolean) {
    this.key = key;
    this.fallback = fallback;
    this.isValid = isValid;
  }

  async read(): Promise<T> {
    if (this.cache !== null) return this.cache;
    // Collapse concurrent first reads — several components mount at once on a
    // cold start and would otherwise each hit storage.
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        const raw = await AsyncStorage.getItem(this.key);
        if (raw === null) {
          this.cache = this.fallback;
          return this.fallback;
        }

        const parsed = JSON.parse(raw) as Envelope<T>;
        // A version mismatch means a future release wrote a shape this build
        // cannot read. Discarding is correct: the alternative is misinterpreting
        // a record and corrupting it further on the next write.
        if (parsed?.version !== STORAGE_VERSION || !this.isValid(parsed.data)) {
          this.cache = this.fallback;
          return this.fallback;
        }

        this.cache = parsed.data;
        return parsed.data;
      } catch {
        // Corrupt JSON, or storage unavailable. Either way the app must launch.
        this.cache = this.fallback;
        return this.fallback;
      } finally {
        this.inflight = null;
      }
    })();

    return this.inflight;
  }

  async write(data: T): Promise<void> {
    this.cache = data;
    const envelope: Envelope<T> = { version: STORAGE_VERSION, data };
    try {
      await AsyncStorage.setItem(this.key, JSON.stringify(envelope));
    } catch {
      // A failed write means the change is not persisted, but the in-memory
      // value stays consistent for this session. Surfacing a hard failure here
      // would break a settings toggle over a full disk.
    }
  }

  async update(mutate: (current: T) => T): Promise<T> {
    const current = await this.read();
    const next = mutate(current);
    await this.write(next);
    return next;
  }

  async clear(): Promise<void> {
    this.cache = this.fallback;
    try {
      await AsyncStorage.removeItem(this.key);
    } catch {
      // Nothing useful to do; the in-memory value is already reset.
    }
  }

  /** Drops the in-memory mirror without touching storage. Used by tests. */
  invalidateCache(): void {
    this.cache = null;
  }
}

/** Type guard for a plain array of objects, ignoring element shape. */
export function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === 'string');
}
