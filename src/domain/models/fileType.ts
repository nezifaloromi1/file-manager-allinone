/**
 * The single file-type registry (plan.md §13).
 *
 * "Don't scatter extension checks throughout the application." Every icon,
 * category screen, filter, and preview decision resolves through this file, so
 * adding a format means editing one table rather than hunting for `endsWith`.
 */

import { extractExtension } from '#/core/utils/validate';

export { extractExtension };

export const FILE_TYPES = [
  'DIRECTORY',
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'DOCUMENT',
  'ARCHIVE',
  'APK',
  'TEXT',
  'CODE',
  'FONT',
  'UNKNOWN',
] as const;

export type FileType = (typeof FILE_TYPES)[number];

/** Types the browser can show a thumbnail or inline preview for. */
const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'heic',
  'heif',
  'avif',
  'svg',
  'tiff',
  'ico',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mkv',
  'avi',
  'mov',
  'wmv',
  'flv',
  'webm',
  'm4v',
  '3gp',
  'mpeg',
  'mpg',
  'ts',
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'aac',
  'ogg',
  'flac',
  'm4a',
  'wma',
  'opus',
  'aiff',
  'amr',
  'mid',
  'midi',
]);

const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'rtf',
  'epub',
  'mobi',
  'pages',
  'numbers',
  'key',
  'csv',
  'tsv',
]);

const ARCHIVE_EXTENSIONS = new Set([
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'bz2',
  'xz',
  'tgz',
  'iso',
  'cab',
  'zst',
]);

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'log', 'text', 'nfo', 'srt', 'vtt', 'sub', 'ass']);

const CODE_EXTENSIONS = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  'json',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'php',
  'sh',
  'bash',
  'zsh',
  'sql',
  'yml',
  'yaml',
  'toml',
  'xml',
  'gradle',
  'dart',
  'lua',
  'r',
  'pl',
  'vue',
  'svelte',
  'ex',
  'exs',
  'scala',
  'clj',
  'hs',
]);

const FONT_EXTENSIONS = new Set(['ttf', 'otf', 'woff', 'woff2', 'eot', 'ttc', 'fon']);

/**
 * Extension → type. Keys are lowercase and stored without the dot.
 *
 * Later spreads win, so the order encodes precedence. `rtf` is the reason this
 * is not just alphabetical: it is in both DOCUMENT and TEXT, and a rich-text
 * document belongs with the documents a user would open in a viewer, not with
 * `notes.txt`. CODE also has to beat TEXT, since a source file is technically
 * plain text.
 */
const EXTENSION_MAP: Record<string, FileType> = {
  // Images
  ...toMap(IMAGE_EXTENSIONS, 'IMAGE'),
  // Video
  ...toMap(VIDEO_EXTENSIONS, 'VIDEO'),
  // Audio
  ...toMap(AUDIO_EXTENSIONS, 'AUDIO'),
  // Archives
  ...toMap(ARCHIVE_EXTENSIONS, 'ARCHIVE'),
  // Code — before TEXT, since source files are text too but want code treatment.
  ...toMap(CODE_EXTENSIONS, 'CODE'),
  // Fonts
  ...toMap(FONT_EXTENSIONS, 'FONT'),
  // Documents — after CODE so an extension listed in both is treated as code.
  ...toMap(DOCUMENT_EXTENSIONS, 'DOCUMENT'),
  // Plain text — last of the overlapping sets.
  ...toMap(TEXT_EXTENSIONS, 'TEXT'),
  // Packages
  apk: 'APK',
  apks: 'APK',
  aab: 'APK',
  xapk: 'APK',
};

/** MIME prefix → type, used when no extension is available. */
const MIME_PREFIX_MAP: Record<string, FileType> = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
  text: 'TEXT',
  font: 'FONT',
};

/**
 * Resolves a filename (and optionally a MIME type) to a `FileType`.
 *
 * Extension wins over MIME type: Android frequently reports a generic
 * `application/octet-stream` for files whose extension is perfectly
 * informative, and trusting the MIME type there would mislabel most of a
 * typical Downloads folder.
 */
export function detectFileType(name: string, mimeType?: string | null): FileType {
  const extension = extractExtension(name);
  if (extension.length > 0) {
    const byExtension = EXTENSION_MAP[extension];
    if (byExtension) return byExtension;
  }

  if (mimeType) {
    const normalized = mimeType.toLowerCase().split(';')[0].trim();
    if (normalized === 'application/zip') return 'ARCHIVE';
    if (normalized === 'application/vnd.android.package-archive') return 'APK';
    if (normalized === 'application/pdf') return 'DOCUMENT';
    if (normalized === 'application/json' || normalized === 'application/xml') return 'CODE';

    const [topLevel] = normalized.split('/');
    const byPrefix = MIME_PREFIX_MAP[topLevel];
    if (byPrefix) return byPrefix;
  }

  return 'UNKNOWN';
}

/** The dot-prefixed extension for display, e.g. `.pdf`. Empty when none. */
export function displayExtension(name: string): string {
  const extension = extractExtension(name);
  return extension.length > 0 ? `.${extension}` : '';
}

/** True when a grid cell should render a thumbnail rather than a type glyph. */
export function hasThumbnail(type: FileType): boolean {
  return type === 'IMAGE' || type === 'VIDEO';
}

/** The category shortcuts offered on Home (plan.md §4, §52). */
export const CATEGORY_FILE_TYPES: readonly FileType[] = [
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'DOCUMENT',
  'ARCHIVE',
  'APK',
];

function toMap(values: Set<string>, type: FileType): Record<string, FileType> {
  const result: Record<string, FileType> = {};
  for (const value of values) {
    result[value] = type;
  }
  return result;
}
