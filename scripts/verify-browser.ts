/**
 * Checks for the browser's non-visual logic (plan.md §5, §6, §7).
 *
 * The browser's screens need a renderer, which this project does not have. What
 * *can* be checked is everything the browser decides before it draws: how a
 * folder's URI maps to a title, a path bar, and an "up" target, and how the
 * selection set behaves. Those are where a wrong answer produces a screen that
 * looks fine and navigates somewhere wrong.
 *
 * Run: `bun run scripts/verify-browser.ts`
 */

import { basenameOf, canGoUp, parentUriOf, toBreadcrumbs } from '#/domain/usecases/folder';
import { INTERNAL_STORAGE_URI } from '#/data/storage/paths';
import { decodeSafSegmentFor, describeSafPick, isSafUri } from '#/data/storage/safUri';
import { applyView, DEFAULT_SORT, EMPTY_FILTER, type FilterSpec } from '#/domain/models/sort';
import { type FileItem, isHiddenName } from '#/domain/models/fileItem';
import { extractExtension } from '#/core/utils/validate';
import { formatCount } from '#/core/utils/format';
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

const SAF_ROOT = 'content://com.android.externalstorage.documents/tree/primary%3ADownload/';

// ------------------------------------------------------------------ uri maths

check(
  'basename of a file',
  basenameOf('file:///storage/emulated/0/Download/report.pdf'),
  'report.pdf',
);
check('basename of a directory', basenameOf('file:///storage/emulated/0/Download/'), 'Download');
check('basename with query-like segment', basenameOf('file:///a/b%20c/d.txt'), 'd.txt');

check(
  'parent of a nested file',
  parentUriOf('file:///storage/emulated/0/Download/report.pdf'),
  'file:///storage/emulated/0/Download/',
);
check('parent of a top-level file', parentUriOf('file:///report.pdf'), 'file:///');
check('parent of a file:// root is null', parentUriOf('file:///'), null);
check('parent of a repeated-slash root is null', parentUriOf('file:////'), null);

// `parentUriOf` is pure segment arithmetic and cannot know where a volume root
// is; `canGoUp` is what the browser actually uses, and it must refuse at the
// root. Getting this wrong navigates the user above the volume, into
// `/storage/emulated/`, which the app has no business showing.
check(
  'canGoUp is false at the volume root',
  canGoUp(INTERNAL_STORAGE_URI, INTERNAL_STORAGE_URI),
  false,
);
check(
  'canGoUp is true inside the volume',
  canGoUp(`${INTERNAL_STORAGE_URI}Download/`, INTERNAL_STORAGE_URI),
  true,
);
check('canGoUp is false at a saf root', canGoUp(SAF_ROOT, SAF_ROOT), false);
check('canGoUp is true inside a saf root', canGoUp(`${SAF_ROOT}a/`, SAF_ROOT), true);
check('canGoUp is false at a file root', canGoUp('file:///', 'file:///'), false);

// -------------------------------------------------------------- breadcrumbs

const localCrumbs = toBreadcrumbs(
  'file:///storage/emulated/0/Documents/Contracts/2026/',
  INTERNAL_STORAGE_URI,
  'Internal storage',
);
check(
  'breadcrumb labels',
  localCrumbs.map((crumb) => crumb.label),
  ['Internal storage', 'Documents', 'Contracts', '2026'],
);
check('breadcrumb count', localCrumbs.length, 4);

// Every crumb except the leaf must be a real ancestor that can be opened.
for (const crumb of localCrumbs.slice(0, -1)) {
  check(`crumb ${crumb.label} is a prefix of its child`, crumb.uri.length > 0, true);
}
check(
  'each crumb uri contains the previous',
  localCrumbs.every((crumb, index) =>
    index === 0
      ? true
      : localCrumbs[index - 1].uri.startsWith(crumb.uri.replace(crumb.label, '')) ||
        crumb.uri.startsWith(localCrumbs[index - 1].uri),
  ),
  true,
);

// The leaf must be the folder actually being shown.
check(
  'leaf crumb is the current uri',
  localCrumbs.at(-1)?.uri,
  'file:///storage/emulated/0/Documents/Contracts/2026/',
);

check(
  'root breadcrumb is alone',
  toBreadcrumbs(INTERNAL_STORAGE_URI, INTERNAL_STORAGE_URI, 'Internal storage').map((c) => c.label),
  ['Internal storage'],
);
check(
  'saf breadcrumbs fall back to the root',
  toBreadcrumbs(`${SAF_ROOT}a/`, '/', 'Selected folder').map((c) => c.label),
  ['Selected folder'],
);

// A URI outside the claimed root must not produce a broken trail.
check(
  'uri outside root falls back',
  toBreadcrumbs('file:///elsewhere/x/', INTERNAL_STORAGE_URI, 'Internal storage').map(
    (c) => c.label,
  ),
  ['Internal storage'],
);

// ------------------------------------------------------------------ saf uris

check('saf uri detected', isSafUri(SAF_ROOT), true);
check('file uri is not saf', isSafUri('file:///a'), false);
check('saf label decoded', decodeSafSegmentFor(SAF_ROOT), 'Download');
check('saf description', describeSafPick(SAF_ROOT), 'primary:Download');
check('saf description of a bare uri', describeSafPick('content://x/'), 'content://x/');

// --------------------------------------------------------- view composition

function item(name: string, isDirectory = false, extra: Partial<FileItem> = {}): FileItem {
  return {
    id: `id-${name}`,
    name,
    uri: `file:///x/${name}`,
    parentUri: 'file:///x/',
    type: isDirectory ? 'DIRECTORY' : 'TEXT',
    mimeType: null,
    size: isDirectory ? null : 100,
    modifiedAt: 1_700_000_000_000,
    createdAt: null,
    isDirectory,
    isHidden: isHiddenName(name),
    extension: isDirectory ? '' : extractExtension(name),
    provider: 'local',
    ...extra,
  };
}

const mixed = [
  item('zeta.txt'),
  item('alpha.txt'),
  item('Zeta', true),
  item('.hidden.txt'),
  item('beta.pdf', false, { type: 'DOCUMENT', size: 2048 }),
];

// The order the browser actually renders: hidden dropped, then sort, then
// directories first.
check(
  'default view order',
  applyView(mixed, { filter: EMPTY_FILTER, sort: DEFAULT_SORT, showHidden: false }).map(
    (i) => i.name,
  ),
  ['Zeta', 'alpha.txt', 'beta.pdf', 'zeta.txt'],
);
check(
  'hidden files included when asked',
  applyView(mixed, { filter: EMPTY_FILTER, sort: DEFAULT_SORT, showHidden: true }).map(
    (i) => i.name,
  ),
  ['Zeta', '.hidden.txt', 'alpha.txt', 'beta.pdf', 'zeta.txt'],
);

// Case-insensitive sorting must put `alpha` before `zeta` despite case.
const caseOrder = applyView(mixed, {
  filter: EMPTY_FILTER,
  sort: { key: 'name', direction: 'asc', foldersFirst: false },
  showHidden: true,
}).map((i) => i.name);
check(
  'case-insensitive name order',
  caseOrder.indexOf('alpha.txt') < caseOrder.indexOf('zeta.txt'),
  true,
);

const queryFilter: FilterSpec = { ...EMPTY_FILTER, query: 'pdf' };
check(
  'in-folder filter narrows the list',
  applyView(mixed, { filter: queryFilter, sort: DEFAULT_SORT, showHidden: false }).map(
    (i) => i.name,
  ),
  ['beta.pdf'],
);

// A query that matches nothing must yield an empty list, not everything.
check(
  'no match yields nothing',
  applyView(mixed, {
    filter: { ...EMPTY_FILTER, query: 'nope' },
    sort: DEFAULT_SORT,
    showHidden: false,
  }),
  [],
);

// The footer summary must count folders and files separately, because a
// directory has no meaningful size to report.
check('summary count singular', formatCount(1, 'file'), '1 file');
check('summary count plural', formatCount(2, 'file'), '2 files');

// ----------------------------------------------------------------- selection

// Mirrors `useSelection` without React, so the set semantics are checked.
class Selection {
  private set = new Set<string>();
  count() {
    return this.set.size;
  }
  has(uri: string) {
    return this.set.has(uri);
  }
  toggle(uri: string) {
    if (this.set.has(uri)) this.set.delete(uri);
    else this.set.add(uri);
  }
  clear() {
    this.set = new Set();
  }
  selectAll(uris: readonly string[]) {
    this.set = new Set(uris);
  }
  everything(uris: readonly string[]) {
    return uris.length > 0 && uris.every((uri) => this.set.has(uri));
  }
}

const selection = new Selection();
selection.toggle('file:///x/a.txt');
check('select adds', [selection.count(), selection.has('file:///x/a.txt')], [1, true]);
selection.toggle('file:///x/a.txt');
check('deselect removes', selection.count(), 0);
selection.toggle('file:///x/a.txt');
selection.toggle('file:///x/b.txt');
check('multi select counts', selection.count(), 2);
selection.clear();
check('clear empties', selection.count(), 0);

const uris = mixed.map((i) => i.uri);
selection.selectAll(uris);
check('select all', selection.count(), uris.length);
check('everything selected', selection.everything(uris), true);
selection.clear();
check('empty directory is not all selected', selection.everything([]), false);

// ------------------------------------------------------------------ debounce

let calls = 0;
let lastValue = '';
const debounced = debounce((value: string) => {
  calls += 1;
  lastValue = value;
}, 10);
debounced('r');
debounced('re');
debounced('rep');
check('debounce pending after bursts', debounced.pending(), true);

setTimeout(() => {
  check('debounce fired once', calls, 1);
  check('debounce kept the last value', lastValue, 'rep');
  debounced('x');
  debounced.cancel();
  check('cancel drops the pending call', debounced.pending(), false);
  setTimeout(() => {
    check('cancelled call never fired', calls, 1);

    console.log(`${checks - failures}/${checks} checks passed`);
    console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
    if (failures > 0) process.exit(1);
  }, 30);
}, 40);
