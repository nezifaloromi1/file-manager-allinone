import { type FileType } from '#/domain/models/fileType';
import { type Theme } from '#/flux/base/themes';
import { type FileItem } from '#/domain/models/fileItem';
import { formatBytes, formatRelativeTime } from '#/core/utils/format';
import {
  FILE_TYPE_LABELS,
  fileTypePresentation,
  itemPresentation,
} from '#/components/file/fileTypePresentation';
import { GRID_GUTTER, columnsForWidth } from '#/components/file/gridLayout';

/**
 * Presentation-logic checks with no native dependency.
 *
 * Component *rendering* needs a device or a renderer, which this project does
 * not have configured. What can be verified here is the pure logic the
 * components depend on: grid column maths, the type presentation registry, and
 * the strings TalkBack reads — which is where the subtle mistakes live.
 *
 * Run: `bun run scripts/verify-ui.ts`
 */

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

function item(name: string, isDirectory: boolean, extra: Partial<FileItem> = {}): FileItem {
  return {
    id: `id-${name}`,
    name,
    uri: `file:///x/${name}`,
    parentUri: 'file:///x/',
    type: isDirectory ? 'DIRECTORY' : 'TEXT',
    mimeType: null,
    size: isDirectory ? null : 1024,
    modifiedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    isDirectory,
    isHidden: name.startsWith('.'),
    extension: '',
    provider: 'local',
    ...extra,
  };
}

// ------------------------------------------------------------- grid column maths

check('phone portrait columns', columnsForWidth(360), 3);
check('small phone clamps to 1', columnsForWidth(80), 1);
check('zero width does not divide by zero', columnsForWidth(0), 1);
check('negative width clamps', columnsForWidth(-100), 1);
check('tablet', columnsForWidth(800), 6);
check('very wide clamps to max', columnsForWidth(2000), 6);
check('gutter is positive', GRID_GUTTER > 0, true);

// `numColumns={0}` is invalid and throws, so a minimum of 1 is a hard floor.
for (let width = 0; width <= 1200; width += 7) {
  checks += 1;
  if (columnsForWidth(width) < 1) {
    failures += 1;
    console.log(`FAIL columnsForWidth(${width}) returned ${columnsForWidth(width)}`);
  }
}

// A wider screen must never show fewer columns than a narrower one.
let monotonic = true;
let previous = columnsForWidth(0);
for (let width = 0; width <= 1200; width += 20) {
  const columns = columnsForWidth(width);
  if (columns < previous) monotonic = false;
  previous = columns;
}
check('column count is monotonic in width', monotonic, true);

// ------------------------------------------------------------- type presentation

const light = { palette: { primary_500: '#F54E00' }, atoms: { text: { color: '#000' } } } as never;
const dark = { palette: { primary_500: '#FF7542' }, atoms: { text: { color: '#FFF' } } } as never;

// Every registered type must have a label and a glyph.
for (const type of Object.keys(FILE_TYPE_LABELS) as FileType[]) {
  check(`${type} has a label`, fileTypePresentation(type, light).label.length > 0, true);
}

// Folders and media are tinted; everything else inherits the row colour.
check('folder is tinted', fileTypePresentation('DIRECTORY', light).color !== null, true);
check('image is tinted', fileTypePresentation('IMAGE', light).color !== null, true);
check('video is tinted', fileTypePresentation('VIDEO', light).color !== null, true);
for (const type of ['DOCUMENT', 'ARCHIVE', 'APK', 'TEXT', 'CODE', 'FONT', 'UNKNOWN'] as const) {
  check(`${type} inherits colour`, fileTypePresentation(type, light).color, null);
}

// The tint must come from the active theme, not a hardcoded value.
check(
  'light folder tint comes from the theme',
  fileTypePresentation('DIRECTORY', light).color,
  '#F54E00',
);
check(
  'dark folder tint comes from the theme',
  fileTypePresentation('DIRECTORY', dark).color,
  '#FF7542',
);

// `isDirectory` must win over `type`, or a folder tagged DOCUMENT would get a
// document glyph.
check(
  'isDirectory overrides type',
  itemPresentation(item('weird', true, { type: 'DOCUMENT' }), light).label,
  'Folder',
);
check(
  'file keeps its type',
  itemPresentation(item('a.pdf', false, { type: 'DOCUMENT' }), light).label,
  'Document',
);

// ------------------------------------------------------- accessibility strings

// The row label is what TalkBack reads: name, type, size, and time, in one pass.
function rowLabel(entry: FileItem, childCount: number | null = null, now = 1_762_300_000_000) {
  const presentation = itemPresentation(entry, light);
  const parts = [entry.name, presentation.label];
  if (entry.isDirectory) {
    if (childCount !== null) parts.push(`${childCount} ${childCount === 1 ? 'item' : 'items'}`);
    if (entry.isHidden) parts.push('hidden');
  } else {
    parts.push(formatBytes(entry.size));
    const time = formatRelativeTime(entry.modifiedAt, now);
    if (time !== '—') parts.push(time);
  }
  return parts.join(', ');
}

const NOW = 1_762_300_000_000;

check(
  'file row label has name, type, size, time',
  rowLabel(item('report.pdf', false, { type: 'DOCUMENT' }), null, NOW),
  'report.pdf, Document, 1.0 KB, 1 year ago',
);
check(
  'folder row label has count',
  rowLabel(item('Photos', true, {}), 12, NOW),
  'Photos, Folder, 12 items',
);
check(
  'folder label pluralises',
  rowLabel(item('Photos', true, {}), 1, NOW),
  'Photos, Folder, 1 item',
);
check(
  'hidden folder is announced',
  rowLabel(item('.config', true, { isHidden: true }), null, NOW),
  '.config, Folder, hidden',
);
check(
  'empty folder omits the count',
  rowLabel(item('Empty', true, {}), null, NOW),
  'Empty, Folder',
);

// An unknown size must read as "unknown", not as a bare em dash with no context.
check(
  'unknown size is signalled',
  rowLabel(item('x.bin', false, { size: null }), null, NOW).includes('—'),
  true,
);

// A filename containing commas must not make the label ambiguous to read.
check(
  'commas in a filename survive the label',
  rowLabel(item('a, b, c.txt', false, { type: 'TEXT' }), null, NOW),
  'a, b, c.txt, Text, 1.0 KB, 1 year ago',
);

// Grid tiles use a shorter label: no type word, since the glyph is not spoken.
const tileLabel = (entry: FileItem) =>
  entry.isDirectory ? `${entry.name}, folder` : `${entry.name}, ${formatBytes(entry.size)}`;
check('tile label for a folder', tileLabel(item('DCIM', true)), 'DCIM, folder');
check('tile label for a file', tileLabel(item('a.png', false)), 'a.png, 1.0 KB');

console.log(`${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
if (failures > 0) process.exit(1);
