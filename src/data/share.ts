import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';

import { type FileItem } from '#/domain/models/fileItem';
import { AppError, toAppError } from '#/core/errors';
import { type StorageProvider } from '#/domain/storage/StorageProvider';
import { isSafUri } from '#/data/storage/safUri';
import {
  ACTION_GET_CONTENT,
  ACTION_SEND,
  ACTION_VIEW,
  CATEGORY_BROWSABLE,
  CATEGORY_DEFAULT,
  GENERIC_MIME,
  describeLaunchFailure,
  mimeTypeFor,
  readGrantFlags,
} from '#/domain/usecases/open';

/**
 * Opening and sharing files (plan.md §14, §15).
 *
 * The provider is asked for a shareable URI, and the *scheme* of the answer
 * decides which mechanism runs. That is the whole branching, and it exists
 * because the two mechanisms have genuinely different requirements:
 *
 * | | `expo-sharing` | hand-built intent |
 * |---|---|---|
 * | Needs | `file://` under external/files/cache | any URI |
 * | Grant | its own FileProvider | `FLAG_GRANT_READ_URI_PERMISSION` |
 * | Works for SAF (`content://`) | **no** | yes |
 *
 * So a file from a system-picked folder shares through an intent with a
 * temporary grant, and a local file shares through the platform sheet. Both give
 * the receiving app a scoped grant and neither exposes a raw path.
 */

export type ShareResult = {
  /** How the share was dispatched, for the log and for the tests. */
  via: 'sheet' | 'intent';
};

/** Whether the platform share sheet is usable at all. */
export async function canShare(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await Sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Shares a file through the system share sheet (plan.md §15).
 *
 * Rejects with a `UNSUPPORTED` error when the file cannot be shared by either
 * route, rather than opening an empty sheet.
 */
export async function shareFile(provider: StorageProvider, item: FileItem): Promise<ShareResult> {
  if (item.isDirectory) {
    throw new AppError('UNSUPPORTED', {
      message: 'Folders cannot be shared. Share the files inside instead.',
    });
  }

  const mimeType = mimeTypeFor(item) ?? GENERIC_MIME;

  // A SAF URI cannot go through `expo-sharing`: its FileProvider resolves a
  // `File` from the path, which a `content://` URI has no meaningful answer
  // for. The intent route is the only one that works.
  if (isSafUri(item.uri)) {
    return shareViaIntent(provider, item, mimeType);
  }

  const localPath = await provider.toLocalPath(item.uri);
  if (localPath === null) {
    // A provider with no filesystem path behind the URI. Not an error yet —
    // the intent route may still work with a content URI.
    return shareViaIntent(provider, item, mimeType);
  }

  if (await canShare()) {
    try {
      await Sharing.shareAsync(localPath, { mimeType, dialogTitle: item.name });
      return { via: 'sheet' };
    } catch (error) {
      // `expo-sharing` throws when the file lies outside its provider paths,
      // which happens for storage this app can read but the provider does not
      // cover. Falling through to the intent keeps sharing working.
      const appError = toAppError(error, { operation: 'share:sheet' });
      if (appError.code === 'UNKNOWN') {
        return shareViaIntent(provider, item, mimeType);
      }
      throw appError;
    }
  }

  return shareViaIntent(provider, item, mimeType);
}

/** Shares by dispatching `ACTION_SEND` with a temporary read grant. */
async function shareViaIntent(
  provider: StorageProvider,
  item: FileItem,
  mimeType: string,
): Promise<ShareResult> {
  const uri = await shareableUriFor(provider, item.uri);
  if (uri === null) {
    throw new AppError('UNSUPPORTED', {
      message: 'This file cannot be shared from its current location.',
    });
  }

  try {
    await IntentLauncher.startActivityAsync(ACTION_SEND, {
      // `EXTRA_STREAM` is a single-URI extra, which is what every share target
      // expects. Sharing several files would need a ClipData, which this
      // module's params do not expose.
      extra: { 'android.intent.extra.STREAM': uri },
      type: mimeType,
      flags: readGrantFlags(),
    });
    return { via: 'intent' };
  } catch (error) {
    throw describeLaunchFailure(error);
  }
}

/**
 * Opens a file with whichever app can handle it (plan.md §14).
 *
 * `ACTION_VIEW` with a MIME type, so Android picks a handler by format rather
 * than by guessing from the extension.
 */
export async function openFile(
  provider: StorageProvider,
  item: FileItem,
  mimeTypeOverride?: string,
): Promise<void> {
  if (item.isDirectory) {
    throw new AppError('UNSUPPORTED', {
      message: 'Folders are opened in the browser, not by another app.',
    });
  }

  const mimeType = mimeTypeOverride ?? mimeTypeFor(item) ?? GENERIC_MIME;
  const uri = await shareableUriFor(provider, item.uri);
  if (uri === null) {
    throw new AppError('UNSUPPORTED', {
      message: 'This file cannot be opened from its current location.',
    });
  }

  try {
    await IntentLauncher.startActivityAsync(ACTION_VIEW, {
      data: uri,
      type: mimeType,
      category: `${CATEGORY_DEFAULT} ${CATEGORY_BROWSABLE}`,
      // A read grant is required: without it the receiving app sees a URI it
      // has no permission for and refuses it.
      flags: readGrantFlags(),
    });
  } catch (error) {
    throw describeLaunchFailure(error);
  }
}

/**
 * Opens the "choose an app" picker.
 *
 * `ACTION_GET_CONTENT` is what makes Android show the resolver list rather than
 * jumping straight to the default app, which is the difference between "open
 * with" and "open".
 */
export async function openWith(
  provider: StorageProvider,
  item: FileItem,
  mimeTypeOverride?: string,
): Promise<void> {
  if (item.isDirectory) {
    throw new AppError('UNSUPPORTED', { message: 'Folders have no apps to open them with.' });
  }

  const mimeType = mimeTypeOverride ?? mimeTypeFor(item) ?? GENERIC_MIME;
  const uri = await shareableUriFor(provider, item.uri);
  if (uri === null) {
    throw new AppError('UNSUPPORTED', { message: 'This file cannot be opened from here.' });
  }

  try {
    await IntentLauncher.startActivityAsync(ACTION_GET_CONTENT, {
      data: uri,
      type: mimeType,
      category: `${CATEGORY_DEFAULT} ${CATEGORY_BROWSABLE}`,
      flags: readGrantFlags(),
    });
  } catch (error) {
    throw describeLaunchFailure(error);
  }
}

/**
 * The URI to hand to another app.
 *
 * Prefers a `content://` URI where the provider has one, because that is what
 * grants can be issued against. Falls back to the `file://` path, which only
 * works for receivers that already have broad storage access.
 */
async function shareableUriFor(provider: StorageProvider, uri: string): Promise<string | null> {
  if (isSafUri(uri)) return uri;

  try {
    const shareable = await provider.toShareableUri(uri);
    // A provider may return the `file://` URI unchanged; that is still usable
    // as intent data, so it is accepted rather than rejected here.
    return shareable ?? (await provider.toLocalPath(uri));
  } catch {
    return provider.toLocalPath(uri).catch(() => null);
  }
}
