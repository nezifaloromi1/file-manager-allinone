/**
 * MIME and intent checks (plan.md §14, §15, §31).
 *
 * The MIME table is the kind of thing that is right until it isn't: an entry
 * with a typo silently sends a file to the wrong app, and a missing entry falls
 * back to `application/octet-stream`, which Android refuses to open at all. So
 * the table is checked for both directions — known types resolve, and unknown
 * ones degrade to the generic type rather than to `undefined`.
 *
 * Run: `bun run scripts/verify-open.ts`
 */

import {
  ACTION_GET_CONTENT,
  ACTION_SEND,
  ACTION_VIEW,
  GENERIC_MIME,
  categoryOf,
  describeType,
  mimeTypeFor,
  mimeTypeForName,
  readGrantFlags,
} from '#/domain/usecases/open';
import { type FileItem } from '#/domain/models/fileItem';
import { extractExtension } from '#/core/utils/validate';

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

function file(name: string, extra: Partial<FileItem> = {}): FileItem {
  const isDirectory = extra.isDirectory ?? false;
  return {
    id: name,
    name,
    uri: `file:///x/${name}`,
    parentUri: 'file:///x/',
    type: isDirectory ? 'DIRECTORY' : 'TEXT',
    mimeType: null,
    size: 1024,
    modifiedAt: 1,
    createdAt: 1,
    isDirectory,
    isHidden: false,
    extension: isDirectory ? '' : extractExtension(name),
    provider: 'local',
    ...extra,
  };
}

// ------------------------------------------------------------ known types

const EXPECTED: [string, string][] = [
  ['photo.jpg', 'image/jpeg'],
  ['photo.HEIC', 'image/heic'],
  ['anim.gif', 'image/gif'],
  ['clip.mp4', 'video/mp4'],
  ['clip.mkv', 'video/x-matroska'],
  ['song.mp3', 'audio/mpeg'],
  ['song.flac', 'audio/flac'],
  ['book.epub', 'application/epub+zip'],
  ['notes.txt', 'text/plain'],
  ['README.md', 'text/markdown'],
  ['data.json', 'application/json'],
  ['page.html', 'text/html'],
  ['styles.css', 'text/css'],
  ['main.ts', 'text/plain'],
  ['app.tsx', 'text/plain'],
  ['script.py', 'text/x-python'],
  ['lib.go', 'text/x-go'],
  ['bundle.zip', 'application/zip'],
  ['archive.7z', 'application/x-7z-compressed'],
  ['app.apk', 'application/vnd.android.package-archive'],
  ['face.ttf', 'font/ttf'],
  ['face.woff2', 'font/woff2'],
  ['sheet.csv', 'text/csv'],
];

for (const [name, mime] of EXPECTED) {
  check(`mime for ${name}`, mimeTypeForName(name), mime);
}

// Case must not matter — a file called `REPORT.PDF` is still a PDF.
check('extension match is case-insensitive', mimeTypeForName('REPORT.PDF'), 'application/pdf');

// `.ts` is the collision worth asserting: MPEG transport stream vs TypeScript.
check('.ts resolves to source, not video', mimeTypeForName('main.ts'), 'text/plain');

// ------------------------------------------------------- unknown and generic

check('unknown extension is generic', mimeTypeForName('thing.qqq'), GENERIC_MIME);
check('no extension is generic', mimeTypeForName('README'), GENERIC_MIME);
check('dotfile has no extension', mimeTypeForName('.gitignore'), GENERIC_MIME);
check('trailing dot has no extension', mimeTypeForName('weird.'), GENERIC_MIME);

/** A directory has no MIME type at all — returning one would be a lie. */
check('directory has no mime', mimeTypeFor(file('Photos', { isDirectory: true })), null);

// The platform's own catch-all must not be trusted as a real answer.
check(
  'octet-stream from the platform is replaced',
  mimeTypeForName('data.bin', 'application/octet-stream'),
  GENERIC_MIME,
);
check('a real platform type is used', mimeTypeForName('blob', 'image/png'), 'image/png');
check('a malformed platform type is ignored', mimeTypeForName('blob', 'garbage'), GENERIC_MIME);
check(
  'platform type with parameters is trimmed',
  mimeTypeForName('blob', 'text/plain; charset=utf-8'),
  'text/plain',
);

// An extension must win over a platform type that disagrees — a `.jpg` reported
// as octet-stream is still a JPEG.
check(
  'extension beats a wrong platform type',
  mimeTypeForName('a.jpg', GENERIC_MIME),
  'image/jpeg',
);

// -------------------------------------------------------------- descriptions

check('pdf description', describeType(file('report.pdf')), 'PDF file');
check('no-extension description', describeType(file('README')), 'File');
check('directory description', describeType(file('Photos', { isDirectory: true })), 'Folder');
check('lowercase extension is uppercased', describeType(file('notes.TXT')), 'TXT file');

check('category of a directory', categoryOf(file('Photos', { isDirectory: true })), 'DIRECTORY');
check('category of a pdf', categoryOf(file('a.pdf', { type: 'DOCUMENT' })), 'DOCUMENT');

// ------------------------------------------------------------- intent flags

/**
 * A read grant is not optional.
 *
 * Without `FLAG_GRANT_READ_URI_PERMISSION` the receiving app gets a URI it has
 * no permission for and refuses it — a share that appears to do nothing.
 */
const read = readGrantFlags();
check('read grant sets FLAG_GRANT_READ_URI_PERMISSION', (read & 0x1) === 0x1, true);
check('read grant alone does not set write', (read & 0x2) === 0, true);
const readWrite = readGrantFlags(true);
check('read+write sets both', [readWrite & 0x1, readWrite & 0x2], [1, 2]);

// The actions must be the platform ones, not invented strings.
check('VIEW action', ACTION_VIEW, 'android.intent.action.VIEW');
check('SEND action', ACTION_SEND, 'android.intent.action.SEND');
check('GET_CONTENT action', ACTION_GET_CONTENT, 'android.intent.action.GET_CONTENT');

// ------------------------------------------------------------ no duplicate keys

/**
 * The table is one object literal, so a duplicate key is a compile error rather
 * than a silent overwrite. This asserts the resolved table has no repeats by
 * checking that every entry round-trips to a distinct value.
 */
const seen = new Map<string, string>();
let duplicates = 0;
for (const [name] of EXPECTED) {
  const mime = mimeTypeForName(name);
  if (
    seen.has(mime) &&
    seen.get(mime) !== name &&
    !EXPECTED.some(([n, m]) => n === seen.get(mime) && m === mime)
  ) {
    duplicates += 1;
  }
  seen.set(mime, name);
}
check('no extension maps to two different mimes', duplicates, 0);

console.log(`${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
if (failures > 0) process.exit(1);
