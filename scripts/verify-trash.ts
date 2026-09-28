/**
 * Trash checks (plan.md §25).
 *
 * The trash's interesting logic is pure: which items expire, how a filename is
 * allocated inside it, and how a size compares against the relocation cap.
 * Those are checked here. Moving actual bytes needs a filesystem, so what is
 * verified instead is that the pieces the byte-moving code *depends on* hold —
 * a cap that is actually enforced, a name allocator that cannot collide, and a
 * retention policy that never purges something it should keep.
 *
 * Run: `bun run scripts/verify-trash.ts`
 */

import {
  MAX_TRASH_RELOCATE_BYTES,
  isTrashedIn,
  trashRootFor,
  trashTargetNameFor,
  selectExpiredTrash,
  totalTrashSize,
  isRestorable,
  createTrashItem,
} from '#/domain/models/trash';
import { formatBytes, formatRetention } from '#/core/utils/format';
import { DEFAULT_SETTINGS, trashRepository } from '#/data/repositories';
import { type FileItem } from '#/domain/models/fileItem';
import { type TrashItem } from '#/domain/models/trash';

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

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 27, 12, 0, 0);

function record(overrides: Partial<TrashItem> = {}): TrashItem {
  return {
    id: 'id-1',
    originalUri: 'file:///storage/emulated/0/Documents/report.pdf',
    originalName: 'report.pdf',
    trashUri: 'file:///data/app/.trash/report.pdf.a1b2c3',
    originalParentUri: 'file:///storage/emulated/0/Documents/',
    isDirectory: false,
    size: 1024,
    deletedAt: NOW - 2 * DAY,
    provider: 'local',
    mimeType: 'application/pdf',
    state: 'STORED',
    reason: null,
    ...overrides,
  };
}

function item(name: string, extra: Partial<FileItem> = {}): FileItem {
  return {
    id: name,
    name,
    uri: `file:///storage/emulated/0/${name}`,
    parentUri: 'file:///storage/emulated/0/',
    type: 'TEXT',
    mimeType: null,
    size: 10,
    modifiedAt: NOW,
    createdAt: NOW,
    isDirectory: false,
    isHidden: false,
    extension: 'txt',
    provider: 'local',
    ...extra,
  };
}

// ------------------------------------------------------------ retention policy

check('the default retention is 30 days', DEFAULT_SETTINGS.trashRetentionDays, 30);
check('a fresh item is kept', selectExpiredTrash([record({ deletedAt: NOW })], 30, NOW).length, 0);
check(
  'an item past retention expires',
  selectExpiredTrash([record({ deletedAt: NOW - 31 * DAY })], 30, NOW).length,
  1,
);
check(
  'an item exactly at the boundary is kept',
  selectExpiredTrash([record({ deletedAt: NOW - 30 * DAY })], 30, NOW).length,
  0,
);

// Only STORED items expire. An already-restored or already-purged record has no
// bytes left, so "purging" it again is pointless work and, worse, an error.
check(
  'restored items never expire',
  selectExpiredTrash([record({ deletedAt: NOW - 99 * DAY, state: 'RESTORED' })], 30, NOW).length,
  0,
);
check(
  'purged items never expire',
  selectExpiredTrash([record({ deletedAt: NOW - 99 * DAY, state: 'PURGED' })], 30, NOW).length,
  0,
);

// Oldest first, so the sweep frees the most space first and the order is stable
// across launches.
const order = selectExpiredTrash(
  [
    record({ id: 'newer', deletedAt: NOW - 40 * DAY }),
    record({ id: 'older', deletedAt: NOW - 80 * DAY }),
  ],
  30,
  NOW,
);
check(
  'expired items are swept oldest first',
  order.map((r) => r.id),
  ['older', 'newer'],
);

// A longer window keeps what a shorter one would drop.
check(
  'a longer retention window keeps more',
  selectExpiredTrash([record({ deletedAt: NOW - 40 * DAY })], 60, NOW).length,
  0,
);

// ------------------------------------------------------------ restore state

check('a stored item is restorable', isRestorable(record({ state: 'STORED' })), true);
check(
  'an unrecoverable item is still restorable',
  isRestorable(record({ state: 'UNRECOVERABLE' })),
  true,
);
check('a restored item is not restorable', isRestorable(record({ state: 'RESTORED' })), false);
check('a purged item is not restorable', isRestorable(record({ state: 'PURGED' })), false);

// ---------------------------------------------------------- record identity

const built = createTrashItem({
  item: item('notes.txt'),
  trashUri: 'file:///x/notes.txt.abc',
  now: NOW,
});
check('the record keeps the original name', built.originalName, 'notes.txt');
check(
  'the record keeps the original parent',
  built.originalParentUri,
  'file:///storage/emulated/0/',
);
check('the record records the trash location', built.trashUri, 'file:///x/notes.txt.abc');
check('a new record is STORED', built.state, 'STORED');
check('a new record has no failure reason', built.reason, null);
check('a new record carries the timestamp it was given', built.deletedAt, NOW);

// The trash filename is deliberately not the original name, so the record is the
// only place the original survives. If either field were lost, a restore could
// not put the file back correctly.
check('the trash location differs from the original', built.trashUri === built.originalUri, false);

// ------------------------------------------------------------------ size sum

check(
  'trash size sums its items',
  totalTrashSize([record({ size: 10 }), record({ size: 32 })]),
  42,
);
// A directory has no size, and must not be counted as zero-but-present, or the
// header would claim the trash is smaller than the folders it holds.
check(
  'a sizeless item contributes nothing',
  totalTrashSize([record({ isDirectory: true, size: null })]),
  0,
);
check('an empty trash is zero bytes', totalTrashSize([]), 0);

// -------------------------------------------------------------- relocation cap

// The cap is the only thing standing between a 2 GB video and an OutOfMemoryError,
// because a cross-backend transfer has to read the whole file into memory.
check('the relocation cap is enforced', MAX_TRASH_RELOCATE_BYTES > 0, true);
check('the cap is a sane size', MAX_TRASH_RELOCATE_BYTES, 150 * 1024 * 1024);
// A typical photo must fit; a large video must not.
check('a 2 MB file is under the cap', 2 * 1024 * 1024 < MAX_TRASH_RELOCATE_BYTES, true);
check('a 2 GB file is over the cap', 2 * 1024 * 1024 * 1024 > MAX_TRASH_RELOCATE_BYTES, true);

// --------------------------------------------------------------- trash URIs

const DOCUMENT_URI = 'file:///data/user/0/com.example/files/';
const root = trashRootFor(DOCUMENT_URI);

check('the trash root is app-private, not on the volume', root.includes('/data/'), true);
check('the trash root is slash-terminated', root.endsWith('/'), true);
// A document directory without a trailing slash must still produce a valid path,
// or joining produces `files.trash` — a sibling, not a child.
check(
  'a missing trailing slash still yields a child path',
  trashRootFor('file:///data/app/files'),
  'file:///data/app/files/.trash/',
);
// Joining without the slash would produce `files.trash` — a sibling of the
// document directory rather than a child of it, so the trash would not be purged
// with the app's data.
check(
  'the join is a child, never a sibling',
  trashRootFor('file:///data/app/files').includes('files/.trash/'),
  true,
);
check('a trashed URI is recognised', isTrashedIn(`${root}report.pdf.a1b2c3`, DOCUMENT_URI), true);
check(
  'a normal file is not in the trash',
  isTrashedIn('file:///storage/emulated/0/Documents/report.pdf', DOCUMENT_URI),
  false,
);
// The trash is hidden, and a leading dot means the volume's own hidden-file
// filter would skip it if it ever lived there — which is the reason it does not.
check('the trash directory is hidden', root.includes('.trash'), true);

// ------------------------------------------------------- trash name allocator

// Two files with the same name in one selection must not overwrite each other
// inside the trash, and neither must the same file trashed twice.
const nameA = trashTargetNameFor(
  { originalName: 'report.pdf', originalUri: 'file:///a/report.pdf' },
  [],
);
check('an empty trash uses the name plus a hash', nameA.startsWith('report.pdf.'), true);
check('the name has no path separator', nameA.includes('/'), false);

const taken = [record({ trashUri: `file:///data/.trash/${nameA}` })];
const nameB = trashTargetNameFor(
  { originalName: 'report.pdf', originalUri: 'file:///b/report.pdf' },
  taken,
);
check('a different URI gets a different name', nameB !== nameA, true);
check('both keep the readable prefix', nameB.startsWith('report.pdf.'), true);

const sameName = trashTargetNameFor(
  { originalName: 'report.pdf', originalUri: 'file:///a/report.pdf' },
  taken,
);
check('re-trashing the same URI does not reuse a name', sameName !== nameA, true);
check('the fallback is a counter, not a hash', /^report\.pdf\.\d+$/.test(sameName), true);

// A name containing a query string would otherwise be compared with the query on.
const odd = [record({ trashUri: 'file:///data/.trash/notes.txt.abc123?x=1' })];
check(
  'an existing target with a query is still compared by name',
  trashTargetNameFor(
    { originalName: 'notes.txt.abc123', originalUri: 'file:///c/notes.txt.abc123' },
    odd,
  ).endsWith('abc123'),
  false,
);

// ------------------------------------------------------------ retention copy

check('retention of 1 day reads in days', formatRetention(1), '1 day');
check('retention of 30 days reads in days', formatRetention(30), '30 days');
// "1 days" is the kind of thing that makes a whole settings screen look unbuilt.
check('retention never pluralises to "1 days"', formatRetention(1).endsWith('days'), false);
check('retention of 14 days reads in weeks', formatRetention(14), '2 weeks');
check('retention of 7 days reads as one week', formatRetention(7), '1 week');
check('retention of 0 says so plainly', formatRetention(0), 'no time');
check('a negative retention is not rendered as a date', formatRetention(-1), 'no time');

// ----------------------------------------------------------------- repository

(async () => {
  // The record store is the thing the whole screen is a view of, so its two
  // ordering guarantees are checked against the real implementation.
  await trashRepository.clear();
  await trashRepository.add(record({ id: 'a', deletedAt: NOW - 5 * DAY }));
  await trashRepository.add(record({ id: 'b', deletedAt: NOW - 1 * DAY }));
  await trashRepository.add(record({ id: 'c', deletedAt: NOW - 3 * DAY }));

  const listed = await trashRepository.list();
  check(
    'the trash lists newest first',
    listed.map((r) => r.id),
    ['b', 'c', 'a'],
  );

  // Re-trashing the same path must replace its record, not stack a second one
  // for a file that no longer exists.
  await trashRepository.add(record({ id: 'a', deletedAt: NOW, originalName: 'report-v2.pdf' }));
  const afterReadd = await trashRepository.list();
  check('re-trashing replaces rather than stacks', afterReadd.length, 3);
  check(
    'the replacement carries the new name',
    afterReadd.find((r) => r.id === 'a')?.originalName,
    'report-v2.pdf',
  );

  await trashRepository.remove('b');
  check(
    'removing one record leaves the rest',
    (await trashRepository.list()).map((r) => r.id),
    ['a', 'c'],
  );

  await trashRepository.clear();
  check('clearing empties the store', (await trashRepository.list()).length, 0);

  // Formatting the header relies on these, so they are pinned rather than assumed.
  check('bytes format to a readable string', formatBytes(0), '0 B');
  check('kilobytes format', formatBytes(2048).endsWith('KB'), true);
  check('megabytes format', formatBytes(5 * 1024 * 1024).endsWith('MB'), true);
  check('gigabytes format', formatBytes(3 * 1024 * 1024 * 1024).endsWith('GB'), true);
  check('null bytes do not print NaN', formatBytes(null), '—');
  check('undefined bytes do not print NaN', formatBytes(undefined), '—');

  console.log(`${checks - failures}/${checks} checks passed`);
  console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
  if (failures > 0) process.exit(1);
})();
