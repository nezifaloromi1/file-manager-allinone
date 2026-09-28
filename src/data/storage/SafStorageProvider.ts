import { Directory, File } from 'expo-file-system';

import { AppError, toAppError } from '#/core/errors';
import { assertSafeName } from '#/core/utils/validate';
import { type FileItem, fileIdFromUri, isHiddenName } from '#/domain/models/fileItem';
import { type FileType, detectFileType, extractExtension } from '#/domain/models/fileType';
import { type Volume } from '#/domain/models/storage';
import {
  type CancelSignal,
  type ProviderCapabilities,
  type ProgressReporter,
  type StorageProvider,
} from '#/domain/storage/StorageProvider';
import { normalizeDirectoryUri, readTimestamps } from './expoFileSystemAdapter';
import { decodeSafSegmentFor } from './safUri';

/**
 * `content://`-backed provider — the Storage Access Framework (plan §9
 * `SafStorageProvider`, §10).
 *
 * This is the privacy-respecting default: the user grants access to specific
 * folders, and the app never sees anything else. It is also the reason the
 * `StorageProvider` interface has a `capabilities` field.
 *
 * ## The hard limitation
 *
 * In `expo-file-system@19.0.24`, `copy()`, `move()`, and `rename()` are
 * implemented on `FileSystemPath` via its `javaFile` accessor, which throws for
 * content URIs:
 *
 * ```kotlin
 * val javaFile: File get() =
 *   if (uri.isContentUri) {
 *     throw Exception("This method cannot be used with content URIs: $uri")
 *   } else { file as File }
 * ```
 *
 * `Directory.create()` throws too — `createDirectory()` and `createFile()` are
 * the supported calls. So the capabilities below are `false` for rename, copy,
 * and move, and the browser disables those actions with an explanation rather
 * than letting the user hit an error.
 *
 * Granting All Files Access switches the app to `LocalStorageProvider`, where
 * all of them work. That trade-off is the "Hybrid" decision in `progress.md`.
 */

const CAPABILITIES: ProviderCapabilities = {
  canList: true,
  // `createDirectory` / `createFile` work on SAF even though `create()` does not.
  canCreateDirectory: true,
  canCreateFile: true,
  // Throws "This method cannot be used with content URIs" — see class comment.
  canRename: false,
  canCopy: false,
  canMove: false,
  canDeletePermanently: true,
  canWrite: true,
  // Bytes are relocated into app-private storage before being recorded, so a
  // trashed item survives even if the original SAF grant is revoked.
  canRelocateToTrash: true,
};

/** A directory the user granted the app access to. */
export type SafRoot = {
  uri: string;
  label: string;
};

export class SafStorageProvider implements StorageProvider {
  readonly id = 'saf' as const;
  readonly capabilities = CAPABILITIES;

  /** Roots granted by the user. Set by the storage-access screen (plan §11). */
  private roots: SafRoot[] = [];

  setRoots(roots: SafRoot[]): void {
    this.roots = roots;
  }

  getRoots(): SafRoot[] {
    return [...this.roots];
  }

  async listVolumes(): Promise<Volume[]> {
    return this.roots.map((root, index) => ({
      id: `saf-${index}-${fileIdFromUri(root.uri)}`,
      label: root.label,
      provider: 'saf' as const,
      rootUri: root.uri,
      // SAF grants do not report volume capacity; only the platform does, and
      // that is a whole-device figure, so it is left unknown rather than faked.
      totalBytes: null,
      availableBytes: null,
      isPrimary: index === 0,
      isRemovable: false,
    }));
  }

  /**
   * Opens the system directory picker and returns the chosen root.
   *
   * `takePersistableUriPermission` is taken by the native module
   * (`FilePickerContract.kt`), so the grant survives an app restart — without
   * that, every grant would need re-approving on launch (plan §10).
   */
  static async pickRoot(initialUri?: string): Promise<SafRoot | null> {
    try {
      const directory = initialUri
        ? await Directory.pickDirectoryAsync(initialUri)
        : await Directory.pickDirectoryAsync();

      const uri = normalizeDirectoryUri(directory.uri);
      const name = decodeSafSegmentFor(uri) || 'Selected folder';
      return { uri, label: name };
    } catch (error) {
      // Backing out of the picker is a normal outcome, not a failure.
      if (isUserCancellation(error)) return null;
      throw toAppError(error, { operation: 'pickDirectory' });
    }
  }

  async list(uri: string, options: { showHidden?: boolean } = {}): Promise<FileItem[]> {
    const showHidden = options.showHidden ?? false;
    const directory = new Directory(normalizeDirectoryUri(uri));

    if (!directory.exists) {
      throw new AppError('PERMISSION_DENIED', {
        message: 'Access to this folder was not granted or has expired.',
        hint: 'Grant access to this folder to continue.',
      });
    }

    let entries: (File | Directory)[];
    try {
      entries = directory.list();
    } catch (error) {
      throw toAppError(error, { operation: 'list', uri });
    }

    const items: FileItem[] = [];
    for (const entry of entries) {
      const isDirectory = entry instanceof Directory;
      const item = this.toFileItem(entry, uri, isDirectory);
      if (!showHidden && item.isHidden) continue;
      items.push(item);
    }
    return items;
  }

  async getMetadata(uri: string): Promise<FileItem | null> {
    const object = toSafObject(uri);
    if (!object.exists) return null;
    const isDirectory = object instanceof Directory;
    const parentUri = isDirectory
      ? ((object as Directory).parentDirectory?.uri ?? '')
      : ((object as File).parentDirectory?.uri ?? '');
    return this.toFileItem(object, parentUri, isDirectory);
  }

  async exists(uri: string): Promise<boolean> {
    try {
      return toSafObject(uri).exists;
    } catch {
      return false;
    }
  }

  async createDirectory(parentUri: string, rawName: string): Promise<FileItem> {
    const name = assertSafeName(rawName);
    const parent = new Directory(normalizeDirectoryUri(parentUri));
    try {
      const created = parent.createDirectory(name);
      return this.toFileItem(created, parent.uri, true);
    } catch (error) {
      throw toAppError(error, { operation: 'createDirectory', parentUri, name });
    }
  }

  async createFile(parentUri: string, rawName: string, mimeType?: string): Promise<FileItem> {
    const name = assertSafeName(rawName);
    const parent = new Directory(normalizeDirectoryUri(parentUri));
    try {
      const created = parent.createFile(name, mimeType ?? null);
      return this.toFileItem(created, parent.uri, false);
    } catch (error) {
      throw toAppError(error, { operation: 'createFile', parentUri, name });
    }
  }

  async rename(): Promise<FileItem> {
    throw new AppError('UNSUPPORTED', {
      message: 'Renaming is not available for folders granted through the system picker.',
    });
  }

  async copy(): Promise<FileItem> {
    throw new AppError('UNSUPPORTED', {
      message: 'Copying is not available for folders granted through the system picker.',
    });
  }

  async move(): Promise<FileItem> {
    throw new AppError('UNSUPPORTED', {
      message: 'Moving is not available for folders granted through the system picker.',
    });
  }

  async delete(uri: string): Promise<void> {
    const object = toSafObject(uri);
    try {
      object.delete();
    } catch (error) {
      throw toAppError(error, { operation: 'delete', uri });
    }
  }

  async getSize(uri: string): Promise<number | null> {
    try {
      return toSafObject(uri).size;
    } catch {
      return null;
    }
  }

  /**
   * A `content://` URI is already what other apps expect for a share.
   *
   * The receiving app gets a temporary read grant from the chooser, so the
   * underlying path is never exposed (plan §15).
   */
  async toShareableUri(uri: string): Promise<string> {
    const object = toSafObject(uri);
    if (!(object instanceof File)) return uri;
    try {
      // `contentUri` was added in expo-file-system 19.0.19 and is Android-only.
      return object.contentUri;
    } catch {
      return uri;
    }
  }

  async toLocalPath(): Promise<string | null> {
    // There is no filesystem path behind a SAF URI. Callers must handle `null`
    // rather than assume one exists — the StorageProvider contract says so.
    return null;
  }

  private toFileItem(entry: File | Directory, parentUri: string, isDirectory: boolean): FileItem {
    const name = entry.name;
    const extension = isDirectory ? '' : extractExtension(name);
    const type: FileType = isDirectory
      ? 'DIRECTORY'
      : detectFileType(name, entry instanceof File ? entry.type : null);
    const timestamps = readTimestamps(entry, isDirectory);

    return {
      id: fileIdFromUri(entry.uri),
      name,
      uri: entry.uri,
      parentUri,
      type,
      mimeType: isDirectory ? null : (entry as File).type || null,
      size: isDirectory ? null : (entry as File).size,
      modifiedAt: timestamps.modifiedAt,
      createdAt: timestamps.createdAt,
      isDirectory,
      isHidden: isHiddenName(name),
      extension,
      provider: this.id,
    };
  }
}

function toSafObject(uri: string): File | Directory {
  return uri.endsWith('/') ? new Directory(uri) : new File(uri);
}

/** The picker throws when the user backs out; that is not an error. */
function isUserCancellation(error: unknown): boolean {
  if (error instanceof AppError) return error.code === 'CANCELLED';
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('cancel') || message.includes('resultcode.canceled');
}

export type { CancelSignal, ProgressReporter };
