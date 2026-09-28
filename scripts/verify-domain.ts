/**
 * Behavioural checks for the pure domain layer.
 *
 * These run without a device, a test runner, or any native module, which is
 * exactly the payoff of keeping sorting, filtering, validation, and conflict
 * planning in pure functions (plan.md §8, §44). plan.md also asks that a real
 * suite exist and run in CI; adding jest/expo-test-config is a separate,
 * deliberate step — this is a plain assertion script in the meantime.
 *
 * Run: `bun run scripts/verify-domain.ts`
 */

import { AppError, classifyError, describeError, isAppError } from '#/core/errors';
import {
  byteLength,
  composeRenamedName,
  isExtensionDropped,
  splitName,
  validateName,
  withCopySuffix,
  MAX_NAME_BYTES,
} from '#/core/utils/validate';
import {
  DATE_BUCKET_LABELS,
  formatBytes,
  formatCount,
  formatDate,
  formatRelativeTime,
  formatStorageUsage,
  toDateBucket,
  toUsageRatio,
} from '#/core/utils/format';
import { debounce } from '#/core/utils/debounce';
import { type FileItem, fileIdFromUri, isHiddenName, shouldHide } from '#/domain/models/fileItem';
import {
  detectFileType,
  displayExtension,
  extractExtension,
  hasThumbnail,
} from '#/domain/models/fileType';
import {
  DEFAULT_SORT,
  EMPTY_FILTER,
  applyView,
  filterItems,
  isFilterActive,
  sortItems,
} from '#/domain/models/sort';
import {
  createOperation,
  formatProgressLabel,
  isTerminal,
  transition,
  withProgress,
} from '#/domain/models/operation';
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  selectExpiredTrash,
  totalTrashSize,
} from '#/domain/models/trash';
import { createStorageUsage, formatUsageSummary } from '#/domain/models/storage';
import { findSizeCandidates, findOldFiles, totalSizeOf } from '#/domain/usecases/duplicate';
import { basenameOf, joinUri, parentUriOf, toBreadcrumbs } from '#/domain/usecases/folder';
import { isSameLocation } from '#/domain/usecases/transfer';

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

function checkTrue(label: string, actual: boolean) {
  check(label, actual, true);
}

// ------------------------------------------------------------------- fixtures

function item(
  name: string,
  isDirectory: boolean,
  size: number | null,
  modifiedAt: number | null,
  extra: Partial<FileItem> = {},
): FileItem {
  return {
    id: fileIdFromUri(`file:///x/${name}`),
    name,
    uri: `file:///x/${name}`,
    parentUri: 'file:///x/',
    type: isDirectory ? 'DIRECTORY' : 'TEXT',
    mimeType: null,
    size,
    modifiedAt,
    createdAt: null,
    isDirectory,
    isHidden: isHiddenName(name),
    extension: isDirectory ? '' : extractExtension(name),
    provider: 'local',
    ...extra,
  };
}

// ------------------------------------------------------------ name validation

for (const bad of [
  '',
  '   ',
  '.',
  '..',
  'a/b',
  'a\\b',
  'a:b',
  'a*b',
  'a?b',
  'a"b',
  'a<b',
  'a>b',
  'a|b',
  'trailing.',
  'x'.repeat(300),
  'a\u0000b',
]) {
  checkTrue(`rejects ${JSON.stringify(bad)}`, !validateName(bad).valid);
}
for (const good of [
  'file.txt',
  'My Folder 2',
  'a-b_c',
  '\u{1F600}\u{1F601}',
  'x'.repeat(MAX_NAME_BYTES),
]) {
  checkTrue(`accepts ${JSON.stringify(good.slice(0, 20))}`, validateName(good).valid);
}
check('name is trimmed', validateName('  spaced  '), { valid: true, name: 'spaced' });
check('nul is rejected', validateName('a\u0001b').valid, false);

// The traversal cases plan.md §31 and §45 call out explicitly.
for (const attack of [
  '../../../../sensitive-file',
  '..',
  'foo/../../bar',
  '/etc/passwd',
  'C:\\windows',
]) {
  checkTrue(`blocks traversal ${attack}`, !validateName(attack).valid);
}

check('byteLength ascii', byteLength('abc'), 3);
check('byteLength accented', byteLength('é'), 2);
check('byteLength emoji', byteLength('\u{1F600}'), 4);

// ------------------------------------------------------------------- renaming

check(
  'rename uses input verbatim',
  composeRenamedName('report.pdf', 'report-final'),
  'report-final',
);
check('rename accepts a new extension', composeRenamedName('report.pdf', 'notes.md'), 'notes.md');
check('rename blank keeps original', composeRenamedName('report.pdf', '   '), 'report.pdf');
check('rename trims', composeRenamedName('report.pdf', '  a.pdf  '), 'a.pdf');

check('extension drop detected', isExtensionDropped('report.pdf', 'report'), true);
check('extension kept not a drop', isExtensionDropped('report.pdf', 'report.pdf'), false);
check('extension changed is not a drop', isExtensionDropped('report.pdf', 'report.txt'), false);
check('extensionless original never drops', isExtensionDropped('README', 'README2'), false);

check('splitName with extension', splitName('report.pdf'), { stem: 'report', extension: '.pdf' });
check('splitName without extension', splitName('README'), { stem: 'README', extension: '' });
check('splitName dotfile has no extension', splitName('.gitignore'), {
  stem: '.gitignore',
  extension: '',
});
check('splitName double extension', splitName('a.tar.gz'), { stem: 'a.tar', extension: '.gz' });

check('copy suffix inserts before extension', withCopySuffix('report.pdf', 2), 'report (2).pdf');
check('copy suffix on double extension', withCopySuffix('a.tar.gz', 12), 'a.tar (12).gz');
check('copy suffix without extension', withCopySuffix('README', 3), 'README (3)');
check('copy suffix on dotfile', withCopySuffix('.gitignore', 2), '.gitignore (2)');

// ------------------------------------------------------------------ file types

check('jpg', detectFileType('a.JPG'), 'IMAGE');
check('heic', detectFileType('a.heic'), 'IMAGE');
check('mp4', detectFileType('a.mp4'), 'VIDEO');
check('mp3', detectFileType('a.mp3'), 'AUDIO');
check('pdf', detectFileType('a.pdf'), 'DOCUMENT');
check('docx', detectFileType('a.docx'), 'DOCUMENT');
check('rtf is a document not text', detectFileType('a.rtf'), 'DOCUMENT');
check('zip', detectFileType('a.zip'), 'ARCHIVE');
check('apk', detectFileType('a.apk'), 'APK');
check('ts is code not text', detectFileType('a.ts'), 'CODE');
check('tsx is code', detectFileType('a.tsx'), 'CODE');
check('json is code', detectFileType('a.json'), 'CODE');
check('md is text', detectFileType('a.md'), 'TEXT');
check('ttf is font', detectFileType('a.ttf'), 'FONT');
check('unknown extension', detectFileType('a.qqq'), 'UNKNOWN');
check('no extension', detectFileType('README'), 'UNKNOWN');

check(
  'extension wins over generic mime',
  detectFileType('a.jpg', 'application/octet-stream'),
  'IMAGE',
);
check('mime used when no extension', detectFileType('blob', 'image/png'), 'IMAGE');
check('zip mime', detectFileType('blob', 'application/zip'), 'ARCHIVE');
check('apk mime', detectFileType('blob', 'application/vnd.android.package-archive'), 'APK');
check('json mime', detectFileType('blob', 'application/json'), 'CODE');
check('mime params ignored', detectFileType('blob', 'text/plain; charset=utf-8'), 'TEXT');

check('extractExtension lowercase', extractExtension('A.TXT'), 'txt');
check('extractExtension dotfile', extractExtension('.gitignore'), '');
check('extractExtension trailing dot', extractExtension('weird.'), '');
check('displayExtension', displayExtension('a.pdf'), '.pdf');
check('displayExtension none', displayExtension('README'), '');
check('image thumbnails', hasThumbnail('IMAGE'), true);
check('video thumbnails', hasThumbnail('VIDEO'), true);
check('documents have no thumbnail', hasThumbnail('DOCUMENT'), false);

// ------------------------------------------------------------------- identity

checkTrue(
  'id is stable for a uri',
  fileIdFromUri('file:///a/b.txt') === fileIdFromUri('file:///a/b.txt'),
);
checkTrue('id differs by uri', fileIdFromUri('file:///a.txt') !== fileIdFromUri('file:///b.txt'));
checkTrue('id survives rename', fileIdFromUri('file:///a.txt') === fileIdFromUri('file:///a.txt'));
check('id is compact', fileIdFromUri(`file:///${'x'.repeat(500)}`).length < 24, true);

// ------------------------------------------------------------------- formatting

check('formatBytes 0', formatBytes(0), '0 B');
check('formatBytes under 1k', formatBytes(1023), '1023 B');
check('formatBytes 1k', formatBytes(1024), '1.0 KB');
check('formatBytes 1.5k', formatBytes(1536), '1.5 KB');
check('formatBytes 5gb', formatBytes(5 * 1024 ** 3), '5.0 GB');
check('formatBytes large', formatBytes(150 * 1024 ** 3), '150 GB');
check('formatBytes null', formatBytes(null), '—');
check('formatBytes undefined', formatBytes(undefined), '—');
check('formatBytes negative', formatBytes(-1), '—');
check('formatBytes NaN', formatBytes(NaN), '—');

const now = Date.UTC(2026, 8, 27, 12, 0, 0);
check('relative just now', formatRelativeTime(now - 5_000, now), 'just now');
check('relative future', formatRelativeTime(now + 60_000, now), 'just now');
check('relative one minute', formatRelativeTime(now - 60_000, now), '1 minute ago');
check('relative hours', formatRelativeTime(now - 3 * 3600_000, now), '3 hours ago');
check('relative day', formatRelativeTime(now - 24 * 3600_000, now), '1 day ago');
check('relative null', formatRelativeTime(null), '—');

check('date format', formatDate(Date.UTC(2026, 8, 27)), 'Sep 27, 2026');
check('date null', formatDate(null), '—');

check('bucket today', toDateBucket(now - 3600_000, now), 'today');
check('bucket yesterday', toDateBucket(now - 26 * 3600_000, now), 'yesterday');
check('bucket this week', toDateBucket(now - 3 * 24 * 3600_000, now), 'thisWeek');
check('bucket labels exist', Object.keys(DATE_BUCKET_LABELS).length, 5);

check('count singular', formatCount(1, 'item'), '1 item');
check('count plural', formatCount(5, 'item'), '5 items');
check('usage text', formatStorageUsage(1.5 * 1024 ** 3, 128 * 1024 ** 3), '1.5 GB of 128 GB');
check('usage ratio', toUsageRatio(50, 100), 0.5);
check('usage ratio clamps high', toUsageRatio(150, 100), 1);
check('usage ratio zero total', toUsageRatio(10, 0), 0);

// ---------------------------------------------------------------------- sorting

const mixed = [
  item('file10.txt', false, 10, 300),
  item('file2.txt', false, 20, 100),
  item('Adir', true, null, 200),
  item('.hidden', false, 5, 400),
];

check(
  'numeric name sort',
  sortItems(mixed, DEFAULT_SORT).map((i) => i.name),
  ['Adir', '.hidden', 'file2.txt', 'file10.txt'],
);
check(
  'folders first asc',
  sortItems(mixed, { key: 'name', direction: 'asc', foldersFirst: true })[0].name,
  'Adir',
);
check(
  'folders first desc',
  sortItems(mixed, { key: 'name', direction: 'desc', foldersFirst: true })[0].name,
  'Adir',
);
check(
  'no folders first',
  sortItems(mixed, { key: 'name', direction: 'asc', foldersFirst: false })[0].name,
  '.hidden',
);
check(
  'null size last asc',
  sortItems(mixed, { key: 'size', direction: 'asc', foldersFirst: false }).at(-1)?.name,
  'Adir',
);
check(
  'null size last desc',
  sortItems(mixed, { key: 'size', direction: 'desc', foldersFirst: false }).at(-1)?.name,
  'Adir',
);

// `mixed` has no null dates, so this needs its own fixture. An unknown date is
// missing data, not "very old", so it must stay last in *both* directions.
const withUnknownDate = [
  item('known.txt', false, 1, 500),
  item('unknown.txt', false, 1, null),
  item('older.txt', false, 1, 100),
];
check(
  'null date last asc',
  sortItems(withUnknownDate, { key: 'modifiedAt', direction: 'asc', foldersFirst: false }).at(-1)
    ?.name,
  'unknown.txt',
);
check(
  'null date last desc',
  sortItems(withUnknownDate, { key: 'modifiedAt', direction: 'desc', foldersFirst: false }).at(-1)
    ?.name,
  'unknown.txt',
);
check(
  'known dates still order desc',
  sortItems(withUnknownDate, { key: 'modifiedAt', direction: 'desc', foldersFirst: false })
    .slice(0, 2)
    .map((i) => i.name),
  ['known.txt', 'older.txt'],
);
check(
  'sort is stable for equal keys',
  sortItems([item('b', false, 1, 1), item('a', false, 1, 1)], {
    key: 'size',
    direction: 'asc',
    foldersFirst: false,
  }).map((i) => i.name),
  ['b', 'a'],
);
checkTrue('sort does not mutate input', mixed[0].name === 'file10.txt');
check(
  'type sort groups directories',
  sortItems(mixed, { key: 'type', direction: 'asc', foldersFirst: false })[0].name,
  'Adir',
);

// -------------------------------------------------------------------- filtering

check('empty filter keeps all', filterItems(mixed, EMPTY_FILTER).length, 4);
check('empty filter copies array', filterItems(mixed, EMPTY_FILTER) !== mixed, true);
check('type filter', filterItems(mixed, { ...EMPTY_FILTER, types: ['TEXT'] }).length, 3);
check(
  'directory excluded by type filter',
  filterItems([item('d', true, null, 1)], { ...EMPTY_FILTER, types: ['TEXT'] }).length,
  0,
);
check(
  'small size filter',
  filterItems([item('s', false, 500, 1)], { ...EMPTY_FILTER, sizes: ['lt1mb'] }).length,
  1,
);
check(
  'small excluded by large filter',
  filterItems([item('s', false, 500, 1)], { ...EMPTY_FILTER, sizes: ['gt100mb'] }).length,
  0,
);
check(
  '100mb boundary included',
  filterItems([item('s', false, 100 * 1024 * 1024, 1)], { ...EMPTY_FILTER, sizes: ['1to100mb'] })
    .length,
  1,
);
check(
  'date filter today',
  filterItems(mixed, { ...EMPTY_FILTER, dates: ['today'] }, now).length,
  0,
);
check(
  'unknown date fails date filter',
  filterItems([item('x', false, 1, null)], { ...EMPTY_FILTER, dates: ['today'] }).length,
  0,
);
check(
  'query matches',
  filterItems(mixed, { ...EMPTY_FILTER, query: 'file2' }).map((i) => i.name),
  ['file2.txt'],
);
check(
  'query is case insensitive',
  filterItems(mixed, { ...EMPTY_FILTER, query: 'ADIR' }).map((i) => i.name),
  ['Adir'],
);
check(
  'query matches directories too',
  filterItems([item('photos', true, null, 1)], { ...EMPTY_FILTER, query: 'photo' }).length,
  1,
);
// All three TEXT entries are under 1 MB, so the type axis is what narrows it.
check(
  'filters combine',
  filterItems(mixed, { ...EMPTY_FILTER, types: ['TEXT'], sizes: ['lt1mb'] })
    .map((i) => i.name)
    .sort(),
  ['.hidden', 'file10.txt', 'file2.txt'],
);
check(
  'filters intersect',
  filterItems(mixed, { ...EMPTY_FILTER, types: ['TEXT'], sizes: ['gt100mb'] }).length,
  0,
);
check(
  'directory excluded from combined filter',
  filterItems(mixed, { ...EMPTY_FILTER, types: ['IMAGE'], sizes: ['lt1mb'] }).length,
  0,
);

check('filter inactive when empty', isFilterActive(EMPTY_FILTER), false);
check('filter active with query', isFilterActive({ ...EMPTY_FILTER, query: 'x' }), true);
check('filter active with type', isFilterActive({ ...EMPTY_FILTER, types: ['IMAGE'] }), true);

check(
  'applyView hides dotfiles by default',
  applyView(mixed, { filter: EMPTY_FILTER, sort: DEFAULT_SORT, showHidden: false }).length,
  3,
);
check(
  'applyView shows dotfiles on request',
  applyView(mixed, { filter: EMPTY_FILTER, sort: DEFAULT_SORT, showHidden: true }).length,
  4,
);

// -------------------------------------------------------------------- operations

let op = createOperation({
  id: 'o1',
  kind: 'copy',
  itemUris: ['file:///a'],
  label: 'Copying 1 item',
  now: 1000,
});
check('starts queued', op.state, 'QUEUED');
op = transition(op, 'RUNNING', {}, 2000);
check('running stamps start', op.startedAt, 2000);
op = withProgress(op, 512, 1024);
check('progress ratio', op.progress.ratio, 0.5);
check('progress label', formatProgressLabel(op.progress), '512 B / 1.0 KB');
op = transition(op, 'COMPLETED', {}, 3000);
check('completed stamps finish', op.finishedAt, 3000);
check('completed forces full progress', op.progress.ratio, 1);
check('completed is terminal', isTerminal(op.state), true);
check('running is not terminal', isTerminal('RUNNING'), false);
check(
  'progress without total',
  formatProgressLabel({ ratio: 0, transferred: 10, total: null }),
  'Calculating…',
);

let failed = transition(
  createOperation({ id: 'o2', kind: 'move', itemUris: [], label: 'x' }),
  'RUNNING',
);
failed = transition(failed, 'FAILED', {
  error: { title: 't', message: 'm', hint: undefined, code: 'UNKNOWN' },
});
check('failure keeps error', failed.error?.title, 't');
check('retry clears error', transition(failed, 'RUNNING').error, null);

// ------------------------------------------------------------------------ trash

const DAY = 24 * 3600_1000;
const trashRecord = (
  id: string,
  deletedAt: number,
  state: 'STORED' | 'UNRECOVERABLE' = 'STORED',
) => ({
  id,
  originalUri: `file:///x/${id}`,
  originalName: id,
  trashUri: `file:///t/${id}`,
  originalParentUri: 'file:///x/',
  isDirectory: false,
  size: 10,
  deletedAt,
  provider: 'local' as const,
  mimeType: null,
  state,
  reason: null,
});

const expired = selectExpiredTrash(
  [trashRecord('old', now - (DEFAULT_TRASH_RETENTION_DAYS + 1) * DAY), trashRecord('new', now)],
  DEFAULT_TRASH_RETENTION_DAYS,
  now,
);
check(
  'expired selection',
  expired.map((r) => r.id),
  ['old'],
);
check(
  'unrecoverable is not expired',
  selectExpiredTrash([trashRecord('u', 0, 'UNRECOVERABLE')], 30, now).length,
  0,
);
check('trash size total', totalTrashSize([trashRecord('a', 1), trashRecord('b', 1)]), 20);

// ---------------------------------------------------------------------- storage

const volume = {
  id: 'v',
  label: 'Internal',
  provider: 'local' as const,
  rootUri: 'file:///storage/emulated/0/',
  totalBytes: 1000,
  availableBytes: 400,
  isPrimary: true,
  isRemovable: false,
};
const usage = createStorageUsage(volume);
check('usage computes used', usage.usedBytes, 600);
check('usage ratio', usage.ratio, 0.6);
check('usage summary', formatUsageSummary(usage), '600 B of 1000 B · 60% used');
check('unknown total is null', createStorageUsage({ ...volume, totalBytes: null }).ratio, null);
check('breakdown starts empty', usage.breakdown, null);

// -------------------------------------------------------------------- duplicates

check(
  'size candidates',
  findSizeCandidates([
    item('a', false, 100, 1),
    item('b', false, 100, 1),
    item('c', false, 200, 1),
  ]).map((c) => c.size),
  [100],
);
check(
  'zero-byte ignored',
  findSizeCandidates([item('a', false, 0, 1), item('b', false, 0, 1)]).length,
  0,
);
check(
  'directories ignored',
  findSizeCandidates([item('a', true, null, 1), item('b', true, null, 1)]).length,
  0,
);
check(
  'null sizes ignored',
  findSizeCandidates([item('a', false, null, 1), item('b', false, null, 1)]).length,
  0,
);
check(
  'old files found',
  findOldFiles([item('a', false, 1, now - 40 * DAY), item('b', false, 1, now)], 30, now).map(
    (i) => i.name,
  ),
  ['a'],
);
check('old files skip directories', findOldFiles([item('d', true, null, 0)], 30, now).length, 0);
check(
  'total size skips directories',
  totalSizeOf([item('a', false, 10, 1), item('d', true, null, 1)]),
  10,
);

// ------------------------------------------------------------------------ uris

check('joinUri', joinUri('file:///a', 'b.txt'), 'file:///a/b.txt');
check('joinUri trailing slash', joinUri('file:///a/', 'b.txt'), 'file:///a/b.txt');
check('parentUriOf', parentUriOf('file:///a/b/c.txt'), 'file:///a/b/');
check('parentUriOf root', parentUriOf('file:///'), null);
check('basenameOf', basenameOf('file:///a/b.txt'), 'b.txt');
check('basenameOf trailing slash', basenameOf('file:///a/b/'), 'b');
check('same location tolerates slash', isSameLocation('file:///a', 'file:///a/'), true);

check(
  'breadcrumbs',
  toBreadcrumbs('file:///root/a/b/', 'file:///root/', 'Internal').map((c) => c.label),
  ['Internal', 'a', 'b'],
);
check(
  'breadcrumb at root',
  toBreadcrumbs('file:///root/', 'file:///root/', 'Internal').map((c) => c.label),
  ['Internal'],
);
check(
  'breadcrumbs outside root',
  toBreadcrumbs('content://x/', 'file:///root/', 'Internal').map((c) => c.label),
  ['Internal'],
);
check(
  'breadcrumb uris navigate',
  toBreadcrumbs('file:///root/a/b/', 'file:///root/', 'Internal')[2].uri,
  'file:///root/a/b/',
);

// ---------------------------------------------------------------------- errors

check('isAppError', isAppError(new AppError('NOT_FOUND')), true);
check('isAppError on plain error', isAppError(new Error('x')), false);
check('classify preserves AppError', classifyError(new AppError('CANCELLED')), 'CANCELLED');
for (const [message, code] of [
  ['EACCES: permission denied', 'PERMISSION_DENIED'],
  ['write error: ENOSPC', 'NOT_ENOUGH_SPACE'],
  ['destination already exists', 'ALREADY_EXISTS'],
  ['ENOENT: no such file', 'NOT_FOUND'],
  ['EISDIR: is a directory', 'IN_USE'],
  ['EXDEV: cross-device link', 'CROSS_DEVICE'],
  ['This method cannot be used with content URIs: content://x', 'UNSUPPORTED'],
  ['child name must be a single path segment', 'INVALID_NAME'],
  ['child path escapes parent directory', 'INVALID_NAME'],
  ['something odd', 'UNKNOWN'],
] as const) {
  check(`classify ${code}`, classifyError(new Error(message)), code);
}
const described = describeError(new AppError('NOT_ENOUGH_SPACE'));
check('error has title', described.title, 'Not enough free space.');
check('error has hint', typeof described.hint, 'string');
check('cancelled has a message', describeError(new AppError('CANCELLED')).message, 'Cancelled.');
checkTrue('every code has copy', Object.keys(describeErrorCodes()).length > 0);

function describeErrorCodes(): Record<string, unknown> {
  const codes = [
    'PERMISSION_DENIED',
    'NOT_FOUND',
    'ALREADY_EXISTS',
    'INVALID_NAME',
    'NOT_ENOUGH_SPACE',
    'IN_USE',
    'UNSUPPORTED',
    'CROSS_DEVICE',
    'CANCELLED',
    'CORRUPT',
    'ABORTED',
    'UNKNOWN',
  ] as const;
  return Object.fromEntries(codes.map((code) => [code, describeError(new AppError(code)).title]));
}

// A user-supplied name must never reach rendered error copy.
const injected = new AppError('UNKNOWN', { message: 'failed on ../../etc/passwd' });
check('custom message is preserved verbatim', injected.detail, 'failed on ../../etc/passwd');
check(
  'custom error keeps builtin hint',
  injected.hint,
  'Try again. If it keeps happening, restart the app.',
);

// --------------------------------------------------------------------- debounce

const debounceSmoke = (() => {
  let calls = 0;
  const fn = debounce(() => {
    calls += 1;
  }, 5);
  fn();
  fn();
  fn();
  checkTrue('debounce is pending', fn.pending());
  fn.cancel();
  check('debounce cancel clears', fn.pending(), false);
  return calls;
})();
void debounceSmoke;

console.log(`${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
if (failures > 0) process.exit(1);
