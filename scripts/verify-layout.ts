/**
 * App-bar and drawer checks.
 *
 * The headers were hand-rolled per screen and had already drifted to three
 * different heights (61px, 49px, 52px) before they were consolidated. These
 * assertions are why they cannot drift again: one token, and every screen
 * routed through one component.
 *
 * Run: `bun run scripts/verify-layout.ts`
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  headerGutter,
  headerHeight,
  headerTitleSize,
  layer,
  space,
  fontSize,
  touchTarget,
} from '#/flux/base/tokens';

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

// ------------------------------------------------------------- token shape

/** The 44px AA floor: a header shorter than this forces the buttons to rely entirely on hitSlop. */
check('header meets the touch-target floor', headerHeight >= touchTarget.comfortable, true);
check('header is denser than a list row', headerHeight < touchTarget.row, true);
check(
  'header title comes from the type scale',
  Object.values(fontSize).includes(headerTitleSize),
  true,
);
check('header gutter is a spacing step', Object.values(space).includes(headerGutter), true);
/** The gutter must match the list rows beneath it, or the bar looks misaligned. */
check('header gutter matches the list row inset', headerGutter, space.md);

// The drawer must cover the tab bar, or it opens and is clipped.
check('drawer sits above the tab bar', layer.sheet > layer.tabBar, true);

// ------------------------------------------------- every screen uses the one header

function screenFiles(): string[] {
  return readdirSync('src/screens')
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => join('src/screens', name));
}

const screens = screenFiles();
const relevant = screens.filter((name) => !name.includes('showcase') && name !== 'App.tsx');

const handRolled: string[] = [];
const usingShared: string[] = [];

for (const file of relevant) {
  const source = readFileSync(file, 'utf8');
  if (!/<Header\b|<BrowserToolbar\b|<DrawerHost\b|<PhasePlaceholder\b/.test(source)) continue;
  usingShared.push(file);

  // Any title rendered outside the shared header means a second header exists.
  const strayTitle =
    /<Text[^>]*>\s*(File Manager|Storage|Settings|Recent|Favorites|Operations|Choose a folder)\s*<\/Text>/.test(
      source,
    );
  if (strayTitle) handRolled.push(file);
}

check('at least one screen uses the shared header', usingShared.length > 0, true);
check('no screen hand-rolls a title', handRolled, []);

// The old pattern: a title in a padded View rather than through `Header`.
const legacyPattern = /atoms\.text_2xl,\s*atoms\.font_medium,\s*t\.atoms\.text\]\}\}>/;
const legacy: string[] = [];
for (const file of relevant) {
  if (legacyPattern.test(readFileSync(file, 'utf8'))) legacy.push(file);
}
check('no screen uses the old 20.6px title', legacy, []);

// ------------------------------------------------------- no fixed header heights

// A `minHeight` on a header is exactly what made the three heights diverge.
const fixedHeights: string[] = [];
for (const file of relevant) {
  const source = readFileSync(file, 'utf8');
  if (/minHeight:\s*(4[0-9]|5[0-9]|6[0-9])\b/.test(source) && !/touchTarget/.test(source)) {
    fixedHeights.push(file);
  }
}
check('no screen hardcodes a header height', fixedHeights, []);

// -------------------------------------------------------------- drawer wiring

const navigator = readFileSync('src/RootNavigator.tsx', 'utf8');
check(
  'every tab is wrapped in a drawer host',
  /<DrawerHost activeTab=\{root\}>/.test(navigator),
  true,
);

const drawer = readFileSync('src/features/navigation/DrawerHost.tsx', 'utf8');
// The drawer maps tabs by *icon* name, since that is what it renders; the tab
// list itself is the shared `TABS`, so it cannot go stale.
for (const icon of ['home', 'storage', 'recent', 'favorites', 'settings']) {
  check(`drawer renders the ${icon} icon`, new RegExp(`^  ${icon}:`, 'm').test(drawer), true);
}
check('drawer builds its tabs from the shared list', /TABS\.map\(\(tab\)/.test(drawer), true);
for (const shortcut of ['Search', 'Trash', 'StorageAnalyzer', 'About']) {
  check(`drawer includes ${shortcut}`, drawer.includes(`id: '${shortcut}'`), true);
}

// The system back button must close the drawer while it is open, or a back
// press navigates the tab stack out from under the panel.
const sideDrawer = readFileSync('src/components/layout/SideDrawer.tsx', 'utf8');
check(
  'back button closes the drawer',
  /BackHandler\.addEventListener\('hardwareBackPress'/.test(sideDrawer),
  true,
);
check('the handler returns true to consume the event', /return true;/.test(sideDrawer), true);
// Closed drawers must be hidden from assistive tech, or every screen has a
// phantom list of destinations behind it.
check(
  'closed drawer is hidden from screen readers',
  /accessibilityElementsHidden=\{!visible\}/.test(sideDrawer),
  true,
);
// A transform, not `left`: animating layout is a frame-by-frame relayout.
check('drawer animates a transform', /translateX: progress\.interpolate/.test(sideDrawer), true);
check('drawer does not animate left', /Animated\.timing\([^)]*left/.test(sideDrawer), false);

const header = readFileSync('src/components/layout/Header.tsx', 'utf8');
// Menu and back must be mutually exclusive, and the component says so.
check('header rejects menu and back together', /not both/.test(header), true);
check('header takes its height from the token', /height: tokens\.headerHeight/.test(header), true);
// The icon buttons rely on hitSlop to reach 44, so it must be present.
check('header buttons use hitSlop', /hitSlop=\{10\}/.test(header), true);

console.log(`${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
if (failures > 0) process.exit(1);
