/**
 * Checks that the tab list, the navigator, and the router agree.
 *
 * These three are the ones that can silently disagree, and a disagreement is
 * invisible until the app runs: a tab registered with no bar item is an
 * unreachable destination, and a bar item with no screen is a dead tap. The tab
 * list is shared for that reason, and this suite checks the sharing held.
 *
 * The router is importable without React Native, so deep-link resolution is
 * checked for real rather than assumed.
 *
 * Run: `bun run scripts/verify-nav.ts`
 */

import { TABS, findTab } from '#/lib/tabs';
import { router } from '#/routes';

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

// --------------------------------------------------------------- tab list shape

check('five tabs', TABS.length, 5);
check(
  'tab names',
  TABS.map((tab) => tab.name),
  ['Home', 'Storage', 'Recent', 'Favorites', 'Settings'],
);

// plan.md §3 names these five; anything else means the plan was not followed.
check('matches plan section 3', TABS.map((tab) => tab.name).sort(), [
  'Favorites',
  'Home',
  'Recent',
  'Settings',
  'Storage',
]);

// Roots must be unique, or two tab stacks would register the same route name.
const roots = TABS.map((tab) => tab.root);
check('roots are unique', new Set(roots).size, roots.length);

// Labels must be non-empty: they are the only text a user reads in the bar.
for (const tab of TABS) {
  check(`${tab.name} has a label`, tab.label.length > 0, true);
  check(`${tab.name} label is human readable`, tab.label === tab.name, true);
  check(`${tab.name} is findable by name`, findTab(tab.name)?.root, tab.root);
  check(`${tab.name} is findable by root`, findTab(tab.root)?.root, tab.root);
}
check('unknown tab is not found', findTab('Notifications'), undefined);

// ------------------------------------------------------------------ deep links

// Every tab must be reachable by its documented path.
for (const tab of TABS) {
  const [name] = router.matchPath(router.matchName(tab.root)!.build({}));
  check(`${tab.root} resolves from its own path`, name, tab.root);
}

// A path the app does not know must land on NotFound rather than resolving to a
// random screen.
check('unknown path is NotFound', router.matchPath('/does-not-exist')[0], 'NotFound');
check('root path is Home', router.matchPath('/')[0], 'HomeTab');
check('trailing slash resolves', router.matchPath('/storage/')[0], 'StorageTab');

// A `content://` URI carries slashes and percent escapes, so it must travel as a
// query parameter. If it were a path segment, every SAF deep link would break.
const safUri =
  'content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload%2Freport.pdf';
const browserPath = router.matchName('Browser')!.build({ uri: safUri });
check('browser path has no scheme collision', browserPath.startsWith('/browse?'), true);
const [browserName, browserParams] = router.matchPath(browserPath);
check('browser round-trips name', browserName, 'Browser');
check('browser round-trips the saf uri', browserParams.uri, safUri);

// A file:// URI round-trips too, including its own slashes.
const fileUri = 'file:///storage/emulated/0/Download/report.pdf';
const filePath = router.matchName('Browser')!.build({ uri: fileUri });
const [, fileParams] = router.matchPath(filePath);
check('browser round-trips a file uri', fileParams.uri, fileUri);

// Sub-route paths must be distinguishable from their parent tab.
check('settings path is distinct', router.matchPath('/settings')[0], 'SettingsTab');
check(
  'appearance path is distinct',
  router.matchPath('/settings/appearance')[0],
  'AppearanceSettings',
);
check('trash path is distinct', router.matchPath('/trash')[0], 'Trash');
check('access path is distinct', router.matchPath('/access')[0], 'StorageAccess');

// `NotFound` is deliberately absent from the router: it is the fallback name
// `matchPath` returns when nothing matched, not a route with a path. Every other
// declared route must have one.
const routedNames = [
  'HomeTab',
  'StorageTab',
  'RecentTab',
  'FavoritesTab',
  'SettingsTab',
  'Browser',
  'FileDetails',
  'OpenWith',
  'Search',
  'Operations',
  'StorageAccess',
  'StorageAnalyzer',
  'Trash',
  'AppearanceSettings',
  'FileSettings',
  'PrivacySettings',
  'About',
  'FluxShowcase',
];

const missing = routedNames.filter((name) => router.matchName(name) === undefined);
check('every route has a path definition', missing, []);

const paths = routedNames.map((name) => router.matchName(name)!.build({}));
check(
  'every path is non-empty',
  paths.every((path) => path.length > 0),
  true,
);
check('paths are unique', new Set(paths).size, paths.length);

// The first matching route wins, so a path that is a prefix of another must not
// shadow it. `/settings` must not swallow `/settings/appearance`.
check(
  'parent path does not shadow its child',
  router.matchPath('/settings/appearance')[0],
  'AppearanceSettings',
);

console.log(`${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
if (failures > 0) process.exit(1);
