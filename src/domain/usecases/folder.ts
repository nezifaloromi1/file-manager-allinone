import { AppError, toAppError } from '#/core/errors';
import { composeRenamedName, validateName } from '#/core/utils/validate';
import { type FileItem } from '#/domain/models/fileItem';
import { type StorageProvider } from '#/domain/storage/StorageProvider';

/**
 * Create-folder and rename (plan.md §20, §21).
 *
 * Both are "validate, then delegate, then translate failures". The validation
 * lives here rather than in the dialog so that every entry point — the FAB, a
 * context menu, a keyboard shortcut — gets identical rules.
 */

/** `CreateFolderUseCase` (plan.md §8). */
export async function createFolder(
  provider: StorageProvider,
  parentUri: string,
  rawName: string,
): Promise<FileItem> {
  const validation = validateName(rawName);
  if (!validation.valid) {
    throw new AppError('INVALID_NAME', { message: validation.reason });
  }
  const name = validation.name;

  // Check first so the common mistake — a folder that already exists — gets a
  // clear message instead of whatever the platform says about EEXIST.
  if (await provider.exists(joinUri(parentUri, name))) {
    throw new AppError('ALREADY_EXISTS');
  }

  try {
    return await provider.createDirectory(parentUri, name);
  } catch (error) {
    throw toAppError(error, { operation: 'createDirectory', parentUri });
  }
}

/** `RenameFileUseCase` (plan.md §8). Extends to directories unchanged. */
export async function renameItem(
  provider: StorageProvider,
  item: FileItem,
  rawName: string,
  onConflict: (name: string) => Promise<'REPLACE' | 'KEEP_BOTH' | 'SKIP' | 'CANCEL'>,
): Promise<FileItem | null> {
  if (!provider.capabilities.canRename) {
    throw new AppError('UNSUPPORTED');
  }

  const currentName = item.name;
  // plan.md §20: preserve the extension unless the user deliberately drops it.
  const proposed = composeRenamedName(currentName, rawName);
  const validation = validateName(proposed);
  if (!validation.valid) {
    throw new AppError('INVALID_NAME', { message: validation.reason });
  }
  const newName = validation.name;

  if (newName === currentName) {
    return item;
  }

  const targetUri = joinUri(item.parentUri, newName);
  if (await provider.exists(targetUri)) {
    const policy = await onConflict(newName);
    if (policy === 'CANCEL') return null;
    if (policy === 'SKIP') return item;
  }

  try {
    return await provider.rename(item.uri, newName, { onConflict });
  } catch (error) {
    throw toAppError(error, { operation: 'rename' });
  }
}

/**
 * Joins a directory URI and a child name.
 *
 * `name` is expected to have passed `validateName`, which rejects `/` and `\`.
 * This is the second of two guards against a name escaping its parent — the
 * provider re-validates natively as well.
 */
export function joinUri(parentUri: string, name: string): string {
  const base = parentUri.endsWith('/') ? parentUri : `${parentUri}/`;
  return `${base}${name}`;
}

/**
 * The parent of a URI, or `null` when there is none.
 *
 * Pure URI arithmetic: strip one path segment. It cannot know where a *volume*
 * root is — `file:///storage/emulated/0/` and
 * `file:///storage/emulated/0/Download/` are structurally identical — so
 * deciding whether going up is allowed needs the root too. Use `canGoUp`:
 * treating a volume root's "parent" as a real folder lands the user above the
 * volume, in a directory the app has no business showing.
 */
export function parentUriOf(uri: string): string | null {
  const trimmed = uri.replace(/\/+$/, '');
  const lastSlash = trimmed.lastIndexOf('/');
  // `file://` and `file:///` both denote a root. Stripping one trailing slash is
  // not enough: `file:///` becomes `file://`, whose last slash is at index 6
  // and would wrongly yield `file://` as a parent.
  if (lastSlash <= trimmed.indexOf(':') + 1) return null;
  return trimmed.slice(0, lastSlash + 1);
}

/**
 * Whether `uri` may navigate to its parent within `rootUri`.
 *
 * The root is the authority, not the URI shape: a SAF grant's root is an opaque
 * `content://` tree path, and a `file://` volume root is one directory inside a
 * longer path.
 */
export function canGoUp(uri: string, rootUri: string): boolean {
  if (uri === rootUri) return false;
  return parentUriOf(uri) !== null;
}

/** The last path segment of a URI. */
export function basenameOf(uri: string): string {
  const trimmed = uri.replace(/\/$/, '');
  const lastSlash = trimmed.lastIndexOf('/');
  return lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1);
}

/**
 * Breadcrumb segments for the path bar (plan.md §5), root first.
 *
 * Each segment carries the URI needed to navigate to it, so the UI never has to
 * reconstruct paths.
 */
export function toBreadcrumbs(
  uri: string,
  rootUri: string,
  rootLabel: string,
): { label: string; uri: string }[] {
  if (!uri.startsWith(rootUri)) {
    return [{ label: rootLabel, uri: rootUri }];
  }

  const crumbs: { label: string; uri: string }[] = [{ label: rootLabel, uri: rootUri }];
  const remainder = uri.slice(rootUri.length).replace(/^\//, '');
  if (remainder.length === 0) return crumbs;

  let accumulated = rootUri.endsWith('/') ? rootUri : `${rootUri}/`;
  for (const segment of remainder.split('/')) {
    if (segment.length === 0) continue;
    // `accumulated` is kept slash-terminated throughout, so appending a segment
    // and then the next one cannot run them together into `.../ab/`.
    accumulated = `${accumulated}${segment}/`;
    crumbs.push({ label: segment, uri: accumulated });
  }
  return crumbs;
}

/** A single ancestor in the path bar, with the URI needed to navigate to it. */
export type Breadcrumb = {
  label: string;
  uri: string;
};
