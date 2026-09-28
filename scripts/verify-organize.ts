/**
 * Search, recent, and favourites checks (plan.md §16, §26, §27).
 *
 * These screens are all built on the same idea — a stored list of *pointers* to
 * files that may no longer exist — so the checks concentrate on the parts that
 * are pure: the debounce contract, the recency grouping, and the staleness
 * rules. What the screens do with the results needs a filesystem.
 *
 * Run: `bun run scripts/verify-organize.ts`
 */

import { MIN_QUERY_LENGTH, SEARCH_DEBOUNCE_MS, groupRecent } from '@/features/search/useSearch';
import { MAX_RECENT_ITEMS, type AppSettings, DEFAULT_SETTINGS } from '#/data/repositories';
import { searchFiles } from '#/domain/usecases/search';
import { CATEGORIES, categoryFileTypes, findCategory } from '#/domain/models/categories';
import { type FileItem } from '#/domain/models/fileItem';
import { DATE_BUCKET_LABELS, formatCount, toDateBucket } from '#/core/utils/format';
import { debounce } from '#/core/utils/debounce';

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.log(
      `FAIL ${label}\n  got:      ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`,
    );
  }
}

function item(name: string, extra: Partial<FileItem> = {}): FileItem {
  return {
    id: name,
    name,
    uri: `file:///x/${name}`,
    parentUri: 'file:///x/',
    type: 'TEXT',
    mimeType: null,
    size: 10,
    modifiedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    isDirectory: false,
    isHidden: false,
    extension: 'txt',
    provider: 'local',
    ...extra,
  };
}

// -------------------------------------------------------------- recency groups

const now = Date.UTC(2026, 8, 27, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const grouped = groupRecent(
  [
    item('today', { modifiedAt: now - 3600_000 }),
    item('alsoToday', { modifiedAt: now - 5 * 3600_000 }),
    item('yesterday', { modifiedAt: now - DAY }),
    item('week', { modifiedAt: now - 4 * DAY }),
    item('month', { modifiedAt: now - 20 * DAY }),
    item('old', { modifiedAt: now - 200 * DAY }),
    item('undated', { modifiedAt: null }),
  ],
  now,
);

check(
  'group order is newest first',
  grouped.map((g) => g.bucket),
  ['today', 'yesterday', 'thisWeek', 'thisMonth', 'older'],
);
check('two items share the today bucket', grouped[0].items.length, 2);
check(
  'the undated item falls into older',
  grouped.at(-1)?.items.map((i) => i.name),
  ['old', 'undated'],
);

// An empty list must produce no empty groups, or the screen renders five
// headings with nothing under them.
check('empty list produces no groups', groupRecent([], now), []);
check(
  'every emitted bucket has a label',
  grouped.every((g) => DATE_BUCKET_LABELS[g.bucket].length > 0),
  true,
);

// A future timestamp is "today", not a separate bucket.
check(
  'a future date is today',
  groupRecent([item('future', { modifiedAt: now + DAY })], now)[0].bucket,
  'today',
);

// ------------------------------------------------------------- search contract

check('a minimum query length is enforced', MIN_QUERY_LENGTH >= 2, true);
check('the debounce is long enough to matter', SEARCH_DEBOUNCE_MS >= 150, true);
check('the debounce is short enough to feel live', SEARCH_DEBOUNCE_MS <= 400, true);

/** The recent list is capped, so storage cannot grow without bound. */
check('recent list is capped', MAX_RECENT_ITEMS <= 200, true);
check('recent cap is a real bound', MAX_RECENT_ITEMS > 0, true);

// ------------------------------------------------------------------ categories

check('categories are declared', CATEGORIES.length, 7);
check(
  'every category has an id and label',
  CATEGORIES.every((c) => c.id.length > 0 && c.label.length > 0),
  true,
);
check('category ids are unique', new Set(CATEGORIES.map((c) => c.id)).size, CATEGORIES.length);
check('a category is findable by id', findCategory('VIDEOS')?.label, 'Videos');
check('an unknown id is undefined', findCategory('NOPE' as never), undefined);

// Documents deliberately covers several types, so the union must be larger than
// the category count.
const allTypes = categoryFileTypes();
check('the union of category types is non-trivial', allTypes.length > 5, true);
check(
  'images and videos are both covered',
  allTypes.includes('IMAGE') && allTypes.includes('VIDEO'),
  true,
);
// Downloads has no types — it is a directory shortcut, not a format filter.
check('Downloads filters by path, not type', findCategory('DOWNLOADS')?.types, []);
check('Downloads has a path', (findCategory('DOWNLOADS')?.paths.length ?? 0) > 0, true);

// ------------------------------------------------------------------ settings

check('trash is on by default', DEFAULT_SETTINGS.trashEnabled, true);
check('hidden files are off by default', DEFAULT_SETTINGS.showHidden, false);
check('deletes are confirmed by default', DEFAULT_SETTINGS.confirmDelete, true);
check('folders sort first by default', DEFAULT_SETTINGS.foldersFirst, true);
check('the default access mode is SAF', DEFAULT_SETTINGS.accessMode, 'saf');
check('trash retention is 30 days', DEFAULT_SETTINGS.trashRetentionDays, 30);
const settingKeys = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];
check(
  'settings are all scalar',
  settingKeys.every((k) => typeof DEFAULT_SETTINGS[k] !== 'function'),
  true,
);

// ---------------------------------------------------------------------- search

/** A tree with a deep branch, for the walk's limits. */
function buildTree(breadth: number, depth: number): Record<string, FileItem[]> {
  const tree: Record<string, FileItem[]> = {};
  const walk = (prefix: string, level: number) => {
    const children: FileItem[] = [
      item(`${prefix}/needle.txt`.replace(/\//g, '_'), { uri: `${prefix}needle.txt` }),
    ];
    if (level < depth) {
      for (let i = 0; i < breadth; i += 1) {
        children.push({
          ...item(`d${i}`),
          uri: `${prefix}d${i}/`,
          name: `d${i}`,
          isDirectory: true,
        });
      }
    }
    tree[prefix] = children;
    if (level < depth) {
      for (let i = 0; i < breadth; i += 1) walk(`${prefix}d${i}/`, level + 1);
    }
  };
  walk('file:///r/', 0);
  return tree;
}

(async () => {
  // An empty query matches nothing, so a search screen never opens showing
  // the whole volume.
  const tree = buildTree(3, 2);
  const provider = { list: async (uri: string) => tree[uri] ?? [] };

  check(
    'an empty query returns nothing',
    (await searchFiles(provider, 'file:///r/', { query: '   ' })).results,
    [],
  );
  check(
    'a query with no matches returns nothing',
    (await searchFiles(provider, 'file:///r/', { query: 'zzzzz' })).results,
    [],
  );

  const found = await searchFiles(provider, 'file:///r/', { query: 'needle' });
  check('a matching query finds every match', found.results.length, 13);
  check('a complete walk is not truncated', found.truncated, false);

  // The caps are what stop a huge volume from running for minutes.
  const capped = await searchFiles(provider, 'file:///r/', { query: 'needle', maxResults: 5 });
  check('the result cap is respected', capped.results.length, 5);
  check('a capped search reports truncation', capped.truncated, true);

  const dirCapped = await searchFiles(provider, 'file:///r/', {
    query: 'needle',
    maxDirectories: 2,
  });
  check('the directory cap stops the walk', dirCapped.scannedDirectories <= 2, true);
  check('a directory-capped search reports truncation', dirCapped.truncated, true);

  // Depth is bounded, so a deep tree cannot be walked forever.
  const deepTree = buildTree(1, 12);
  const deepProvider = { list: async (uri: string) => deepTree[uri] ?? [] };
  const deep = await searchFiles(deepProvider, 'file:///r/', { query: 'needle', maxDepth: 3 });
  check('depth is bounded', deep.scannedDirectories <= 4, true);

  // Cancellation must stop the walk promptly.
  let visited = 0;
  const counting = {
    list: async (uri: string) => {
      visited += 1;
      return visited > 2 ? [] : (tree[uri] ?? []);
    },
  };
  const cancelled = await searchFiles(counting, 'file:///r/', {
    query: 'needle',
    signal: {
      get isCancelled() {
        return visited > 1;
      },
    },
  });
  check('cancellation stops the walk', visited <= 3, true);
  check('a cancelled search reports truncation', cancelled.truncated, true);

  // A type filter narrows the results.
  const typed = await searchFiles(provider, 'file:///r/', { query: 'needle', types: ['IMAGE'] });
  check('a type filter excludes non-matching files', typed.results.length, 0);

  // The debounce collapses a burst into one call, and flush/cancel behave.
  let calls = 0;
  let last = '';
  const debounced = debounce((value: string) => {
    calls += 1;
    last = value;
  }, 20);
  debounced('r');
  debounced('re');
  debounced('rep');
  check('a burst schedules one call', debounced.pending(), true);

  setTimeout(() => {
    check('the burst fired once', calls, 1);
    check('the burst kept the last value', last, 'rep');

    debounced('x');
    debounced.cancel();
    check('cancel drops the pending call', debounced.pending(), false);

    setTimeout(() => {
      check('a cancelled call never ran', calls, 1);
      check('formatCount singular', formatCount(1, 'result'), '1 result');
      check('toDateBucket today', toDateBucket(now, now), 'today');

      console.log(`${checks - failures}/${checks} checks passed`);
      console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
      if (failures > 0) process.exit(1);
    }, 40);
  }, 50);
})();
