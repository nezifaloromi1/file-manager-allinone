import { AppError } from '#/core/errors';
import { type StorageProvider } from '#/domain/storage/StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { SafStorageProvider } from './SafStorageProvider';

/**
 * Provider registry and routing.
 *
 * Screens never construct a provider; they ask for one by volume and get back
 * whichever implementation owns that location. That indirection is what keeps
 * the SAF-vs-All-Files-Access decision out of the UI (plan §9).
 */

const local = new LocalStorageProvider();
const saf = new SafStorageProvider();

export function localProvider(): LocalStorageProvider {
  return local;
}

export function safProvider(): SafStorageProvider {
  return saf;
}

/**
 * Picks the provider that can read `uri`.
 *
 * Scheme is the discriminator, which is reliable because only the SAF provider
 * ever produces `content://` URIs.
 */
export function providerForUri(uri: string): StorageProvider {
  return uri.startsWith('content://') ? saf : local;
}

/**
 * The provider to use for a given operation.
 *
 * When All Files Access is granted, local paths are preferred because every
 * operation works there; otherwise SAF is the only option. This is the "Hybrid"
 * strategy: SAF by default, with a Settings toggle that unlocks the full
 * feature set.
 */
export type AccessMode = 'saf' | 'allFiles';

export function providerForAccessMode(mode: AccessMode): StorageProvider {
  return mode === 'allFiles' ? local : saf;
}

export type { StorageProvider };

/**
 * Whether an operation can run, given the current access mode.
 *
 * Returns the `AppError` to throw rather than a bare boolean so the UI can
 * explain *why* an action is unavailable and where to fix it (plan §42).
 */
export function checkCapability(
  provider: StorageProvider,
  capability: 'canRename' | 'canCopy' | 'canMove',
  allFilesAccessGranted: boolean,
): AppError | null {
  if (provider.capabilities[capability]) return null;

  return new AppError('UNSUPPORTED', {
    message: allFilesAccessGranted
      ? 'This location does not support that action.'
      : 'This action needs full file access. Folders granted through the system picker can be browsed, created, and deleted, but not renamed or moved.',
    hint: allFilesAccessGranted ? undefined : 'Turn on full file access in Settings.',
  });
}

export { LocalStorageProvider, SafStorageProvider };
export type { SafRoot } from './SafStorageProvider';
export * from './expoFileSystemAdapter';
export * from './safUri';
