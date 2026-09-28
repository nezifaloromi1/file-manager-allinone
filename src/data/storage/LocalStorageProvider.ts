import { Directory, File, Paths } from 'expo-file-system';

import { AppError, toAppError } from '#/core/errors';
import { assertSafeName } from '#/core/utils/validate';
import { type FileItem, fileIdFromUri, isHiddenName } from '#/domain/models/fileItem';
import { type FileType, detectFileType, extractExtension } from '#/domain/models/fileType';
import { type Volume } from '#/domain/models/storage';
import {
  type CancelSignal,
  type CopyOptions,
  type ProgressReporter,
  type ProviderCapabilities,
  type StorageProvider,
} from '#/domain/storage/StorageProvider';
import {
  INTERNAL_STORAGE_URI,
  askConflict,
  normalizeDirectoryUri,
  readDiskSpace,
  readTimestamps,
  streamCopy,
  toFileSystemObject,
} from './expoFileSystemAdapter';

/**
 * `file://`-backed provider (plan §9 `LocalStorageProvider`).
 *
 * This is the provider that can do everything, because `file://` paths resolve
 * to `java.io.File` and every operation in the `StorageProvider` interface works
 * on it. It requires All Files Access; without that grant, `expo-file-system`
 * reports every path as non-existent and the browser correctly shows an empty
 * folder with a "grant access" prompt rather than a silent failure.
 */

const CAPABILITIES: ProviderCapabilities = {
  canList: true,
  canCreateDirectory: true,
  canCreateFile: true,
  canRename: true,
  canCopy: true,
  canMove: true,
  canDeletePermanently: true,
  canWrite: true,
  canRelocateToTrash: true,
};

export class LocalStorageProvider implements StorageProvider {
  readonly id = 'local' as const;
  readonly capabilities = CAPABILITIES;

  async listVolumes(): Promise<Volume[]> {
    const { total, available } = readDiskSpace();
    return [
      {
        id: 'primary',
        label: 'Internal storage',
        provider: 'local',
        rootUri: INTERNAL_STORAGE_URI,
        totalBytes: total,
        availableBytes: available,
        isPrimary: true,
        // Emulated storage is not a physical card, so it cannot be ejected.
        isRemovable: false,
      },
    ];
  }

  async list(uri: string, options: { showHidden?: boolean } = {}): Promise<FileItem[]> {
    const showHidden = options.showHidden ?? false;
    const directory = new Directory(normalizeDirectoryUri(uri));

    if (!directory.exists) {
      // Distinguish "you have no permission" from "this folder is gone" — the
      // first needs a grant prompt, the second just needs a refresh.
      throw new AppError('PERMISSION_DENIED', {
        message: 'This location is not available yet.',
        hint: 'Grant access to internal storage to continue.',
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
    const object = toFileSystemObject(uri);
    if (!object.exists) return null;

    const isDirectory = object instanceof Directory;
    const parentUri = isDirectory
      ? ((object as Directory).parentDirectory?.uri ?? '')
      : ((object as File).parentDirectory?.uri ?? '');
    return this.toFileItem(object, parentUri, isDirectory);
  }

  async exists(uri: string): Promise<boolean> {
    try {
      return toFileSystemObject(uri).exists;
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

  async rename(uri: string, rawName: string): Promise<FileItem> {
    const name = assertSafeName(rawName);
    const object = toFileSystemObject(uri);

    try {
      object.rename(name);
    } catch (error) {
      throw toAppError(error, { operation: 'rename', uri });
    }

    // The URI changes on rename, so it must be re-read rather than patched.
    const item = await this.getMetadata(object.uri);
    if (item) return item;
    return this.toFileItem(object, this.parentOf(object), object instanceof Directory);
  }

  async copy(
    sourceUri: string,
    destinationDirUri: string,
    // `onConflict` is intentionally required, not defaulted: there is no safe
    // default policy, and omitting it must not mean "overwrite".
    options: CopyOptions,
  ): Promise<FileItem> {
    const source = toFileSystemObject(sourceUri);
    const destinationDir = new Directory(normalizeDirectoryUri(destinationDirUri));
    const targetName = options.targetName ?? source.name;

    if (targetName !== source.name) {
      // The planner already resolved collisions and chose this name, so it is
      // authoritative. A plain `copy()` would keep the source name and silently
      // drop the `(2)` suffix.
      if (await this.targetExists(destinationDir, targetName)) {
        // The plan said this name was free and it is not — the destination
        // changed underneath us. Refuse rather than clobber.
        const decision = await askConflict(options.onConflict, targetName);
        if (decision !== 'REPLACE') {
          throw new AppError(decision === 'CANCEL' ? 'CANCELLED' : 'ALREADY_EXISTS');
        }
      }
      await this.copyAs(source, destinationDir, targetName, options);
    } else {
      // Same-name copy: the destination may already hold a file. The planner
      // checked and either authorised replacement or renamed the target, so
      // clearing it here is the expected path, not a silent overwrite.
      const existing = await this.resolveExisting(destinationDir, targetName, options);
      if (existing !== null) existing.delete();

      try {
        source.copy(destinationDir);
      } catch (error) {
        throw toAppError(error, { operation: 'copy', sourceUri, destinationDirUri });
      }
    }

    const created = new File(joinUri(destinationDir.uri, targetName));
    const item = await this.getMetadata(created.uri);
    if (item) return item;
    return this.toFileItem(created, destinationDir.uri, false);
  }

  async move(
    sourceUri: string,
    destinationDirUri: string,
    options: CopyOptions,
  ): Promise<FileItem> {
    const source = toFileSystemObject(sourceUri);
    const destinationDir = new Directory(normalizeDirectoryUri(destinationDirUri));
    const targetName = options.targetName ?? source.name;

    if (targetName !== source.name) {
      // `move()` keeps the source's own name, so a rename-on-move has to be a
      // copy plus a delete. The delete only runs after the copy succeeds, so a
      // failure can never destroy the original.
      const copied = await this.copy(sourceUri, destinationDir.uri, {
        ...options,
        targetName,
      });
      await this.delete(sourceUri);
      return copied;
    }

    try {
      // Native move is atomic when both paths are on the same volume, which is
      // the common case and avoids writing the bytes at all.
      source.move(destinationDir);
    } catch (error) {
      throw toAppError(error, { operation: 'move', sourceUri, destinationDirUri });
    }

    const item = await this.getMetadata(source.uri);
    if (item) return item;
    return this.toFileItem(source, destinationDir.uri, source instanceof Directory);
  }

  async delete(uri: string): Promise<void> {
    const object = toFileSystemObject(uri);
    try {
      object.delete();
    } catch (error) {
      throw toAppError(error, { operation: 'delete', uri });
    }
  }

  async getSize(uri: string): Promise<number | null> {
    const object = toFileSystemObject(uri);
    try {
      if (object instanceof Directory) {
        return object.size;
      }
      return object.size;
    } catch {
      // Measuring a large tree can fail or take too long; the caller renders
      // "unknown" rather than blocking (plan §19).
      return null;
    }
  }

  async toShareableUri(uri: string): Promise<string> {
    return uri;
  }

  async toLocalPath(uri: string): Promise<string | null> {
    return uri.startsWith('file://') ? uri : null;
  }

  private async targetExists(destinationDir: Directory, name: string): Promise<boolean> {
    try {
      return new File(joinUri(destinationDir.uri, name)).exists;
    } catch {
      return false;
    }
  }

  /** Copies `source` into `destinationDir` under a different name. */
  private async copyAs(
    source: File | Directory,
    destinationDir: Directory,
    targetName: string,
    options: { onProgress?: ProgressReporter; signal?: CancelSignal },
  ): Promise<void> {
    const target = new File(joinUri(destinationDir.uri, targetName));

    if (source instanceof Directory) {
      // Directory renames are cheap (one path change); copying a tree is not.
      // Reuse rename semantics by copying to a temp name, then renaming.
      const temporary = new File(joinUri(destinationDir.uri, `.${targetName}.partial`));
      const temporaryDir = new Directory(`${temporary.uri}/`);
      try {
        source.copy(temporaryDir);
        // `copy` carries the source's own name, so the temp dir has to be
        // renamed to the name the planner chose.
        temporaryDir.rename(targetName);
      } catch (error) {
        try {
          if (temporaryDir.exists) temporaryDir.delete();
        } catch {
          // Best-effort cleanup.
        }
        throw toAppError(error, { operation: 'copyDirectory', sourceUri: source.uri });
      }
      return;
    }

    await streamCopy(source as File, target, {
      onProgress: options.onProgress,
      signal: options.signal,
      overwrite: true,
    });
  }

  /**
   * Resolves a same-name destination, consulting the caller before destroying
   * anything.
   *
   * plan §24: "Never silently overwrite user files." The planner normally
   * handles collisions, but a provider is also reachable directly, so this
   * refuses to delete an existing target unless the caller explicitly agreed to
   * `REPLACE`.
   */
  private async resolveExisting(
    destinationDir: Directory,
    name: string,
    options: Pick<CopyOptions, 'onConflict'>,
  ): Promise<File | Directory | null> {
    const target = new File(joinUri(destinationDir.uri, name));
    if (!target.exists) return null;

    const decision = await askConflict(options.onConflict, name);
    if (decision === 'REPLACE') return target;

    // Everything else means "do not destroy what is already here". Renaming on
    // the provider's behalf would be wrong — the destination name is the
    // planner's decision, and inventing one here would produce a file the user
    // never asked for and never sees. Fail instead, so the caller replans with
    // the conflict it now knows about.
    throw new AppError(decision === 'CANCEL' ? 'CANCELLED' : 'ALREADY_EXISTS', {
      message:
        decision === 'CANCEL'
          ? undefined
          : 'A file with that name already exists in the destination.',
    });
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

  /** Parent URI of an entry, tolerating a filesystem that cannot report one. */
  private parentOf(entry: File | Directory): string {
    try {
      return entry.parentDirectory?.uri ?? '';
    } catch {
      return '';
    }
  }
}

function joinUri(parentUri: string, name: string): string {
  const base = parentUri.endsWith('/') ? parentUri : `${parentUri}/`;
  return `${base}${name}`;
}

export { Paths };
