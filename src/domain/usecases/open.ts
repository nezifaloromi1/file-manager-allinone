import { type FileType, detectFileType } from '#/domain/models/fileType';
import { AppError, toAppError } from '#/core/errors';
import { type FileItem } from '#/domain/models/fileItem';

/**
 * MIME detection and the intent layer (plan.md §14, §15, §31).
 *
 * ## Why this file is not just `shareAsync`
 *
 * `expo-sharing` routes the file through its own `FileProvider`, whose
 * `<paths>` cover only:
 *
 * ```xml
 * <external-path name="expo_external_files" path="." />  <!-- /storage/emulated/0 -->
 * <files-path     name="expo_files"         path="." />  <!-- app internal -->
 * <cache-path     name="cached_expo_files"  path="." />
 * ```
 *
 * It also requires a `file://` URL and does `FileProvider.getUriForFile(...,
 * File(uri.path))` — which cannot represent a `content://` URI at all. So a
 * file from a system-picked folder **cannot be shared through `expo-sharing`**,
 * even though the app can read it perfectly well.
 *
 * Rather than hide that behind a feature that silently fails, this module
 * dispatches the share intent itself for SAF URIs, with a temporary read grant
 * so the receiving app can open the file and the underlying path is never
 * exposed (plan.md §15, §31).
 */

/** Android intent flags, needed as raw bits. */
const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
const FLAG_GRANT_WRITE_URI_PERMISSION = 0x00000002;

export const ACTION_VIEW = 'android.intent.action.VIEW';
export const ACTION_SEND = 'android.intent.action.SEND';
export const ACTION_GET_CONTENT = 'android.intent.action.GET_CONTENT';
export const CATEGORY_DEFAULT = 'android.intent.category.DEFAULT';
export const CATEGORY_BROWSABLE = 'android.intent.category.BROWSABLE';

/**
 * MIME types by extension.
 *
 * Extension first, then Android's own `File.type` from the provider, and only
 * then a generic fallback. The order matters: a `.jpg` reported as
 * `application/octet-stream` should still open in a gallery, and a file with no
 * extension at all should still be shareable.
 */
const BY_EXTENSION: Record<string, string> = {
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  ico: 'image/x-icon',
  // Video
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  '3gp': 'video/3gpp',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  // `.ts` is deliberately absent: it is claimed by TypeScript below. An MPEG
  // transport stream is rare on a phone, and someone opening a `.ts` means
  // source code far more often than a video container.
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  opus: 'audio/opus',
  wma: 'audio/x-ms-wma',
  mid: 'audio/midi',
  midi: 'audio/midi',
  amr: 'audio/amr',
  // Documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  epub: 'application/epub+zip',
  mobi: 'application/x-mobipocket-ebook',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  // Text and code
  txt: 'text/plain',
  text: 'text/plain',
  log: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  sub: 'text/plain',
  ass: 'text/plain',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  toml: 'application/toml',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  // `ts` here rather than in the video group — see the note above.
  js: 'text/javascript',
  mjs: 'text/javascript',
  ts: 'text/plain',
  tsx: 'text/plain',
  jsx: 'text/plain',
  py: 'text/x-python',
  sh: 'application/x-sh',
  c: 'text/x-c',
  cpp: 'text/x-c++',
  h: 'text/x-c',
  java: 'text/x-java-source',
  kt: 'text/x-kotlin',
  rb: 'text/x-ruby',
  go: 'text/x-go',
  rs: 'text/rust',
  php: 'text/x-php',
  sql: 'application/sql',
  gradle: 'text/plain',
  swift: 'text/x-swift',
  // Archives
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  tgz: 'application/gzip',
  bz2: 'application/x-bzip2',
  xz: 'application/x-xz',
  zst: 'application/zstd',
  iso: 'application/x-iso9660-image',
  // Packages
  apk: 'application/vnd.android.package-archive',
  aab: 'application/octet-stream',
  xapk: 'application/octet-stream',
  apks: 'application/octet-stream',
  // Fonts
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  eot: 'application/vnd.ms-fontobject',
};

/** Shown when a file has no extension and no reported type. */
export const GENERIC_MIME = 'application/octet-stream';

/**
 * Strips parameters from a MIME type: `text/plain; charset=utf-8` → `text/plain`.
 *
 * An intent's type must be the bare type. Android resolves a handler against
 * the full string, so `text/plain; charset=utf-8` matches nothing and the file
 * appears to have no app that can open it.
 */
export function normaliseMime(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  const withoutParams = trimmed.split(';')[0].trim();
  return withoutParams.length > 0 ? withoutParams : null;
}

/** The MIME type for a file, or `null` for a directory. */
export function mimeTypeFor(
  item: Pick<FileItem, 'name' | 'mimeType' | 'extension' | 'isDirectory'>,
): string | null {
  if (item.isDirectory) return null;

  const byExtension = item.extension ? BY_EXTENSION[item.extension.toLowerCase()] : undefined;
  if (byExtension) return byExtension;

  // Whatever the platform reported, if it is a real MIME type and not the
  // catch-all it uses when it knows nothing.
  return usableReportedType(item.mimeType);
}

/**
 * The MIME type for a file by name, for callers that have no `FileItem` — the
 * destination picker and the share sheet both need it before a read.
 */
export function mimeTypeForName(name: string, reported?: string | null): string {
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
  const byExtension = extension ? BY_EXTENSION[extension] : undefined;
  if (byExtension) return byExtension;

  return usableReportedType(reported) ?? GENERIC_MIME;
}

/**
 * A platform-reported type, if it is worth using.
 *
 * Rejects the catch-all, because the platform returns it whenever it knows
 * nothing — and passing it on would replace a perfectly good extension-derived
 * type with a useless one.
 */
function usableReportedType(reported: string | null | undefined): string | null {
  const normalised = normaliseMime(reported);
  if (!normalised || normalised === GENERIC_MIME) return null;
  return normalised.includes('/') ? normalised : null;
}

/** `PDF document` — the human label for the details screen (plan.md §19). */
export function describeType(
  item: Pick<FileItem, 'name' | 'isDirectory' | 'extension' | 'type'>,
): string {
  if (item.isDirectory) return 'Folder';
  const extension = item.extension ? item.extension.toLowerCase() : '';
  if (!extension) return 'File';
  return `${extension.toUpperCase()} file`;
}

/** The file-type category, for the details screen and the filter chips. */
export function categoryOf(item: Pick<FileItem, 'name' | 'isDirectory' | 'type'>): FileType {
  return item.isDirectory ? 'DIRECTORY' : (item.type ?? detectFileType(item.name));
}

/** A flag bitmask for a temporary read grant. */
export function readGrantFlags(includeWrite = false): number {
  return includeWrite
    ? FLAG_GRANT_READ_URI_PERMISSION | FLAG_GRANT_WRITE_URI_PERMISSION
    : FLAG_GRANT_READ_URI_PERMISSION;
}

/** Turns a failed intent launch into something a screen can show. */
export function describeLaunchFailure(error: unknown): AppError {
  const appError = toAppError(error, { operation: 'intent.launch' });
  // No handler is a normal outcome — the user simply has nothing that opens
  // this format — so it gets its own wording rather than a generic failure.
  if (error instanceof Error && /no activity|ActivityNotFound/i.test(error.message)) {
    return new AppError('UNSUPPORTED', {
      message: 'No installed app can open this file type.',
      hint: 'Try a different file, or install an app that supports it.',
    });
  }
  return appError;
}
