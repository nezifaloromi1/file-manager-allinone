/**
 * Throwaway verification for the data/domain logic that has no native imports.
 *
 * `expo-file-system` and `AsyncStorage` are native modules, so anything touching
 * them needs a device. The use cases take a `StorageProvider` by injection, so
 * they can be exercised here against a fake — which is exactly why plan.md §8
 * insists operations never live inside UI screens.
 *
 * Run: `bun run scripts/verify-data.ts`
 */

import { AppError } from '#/core/errors';
import { type FileItem } from '#/domain/models/fileItem';
import { type ProviderCapabilities, type StorageProvider } from '#/domain/storage/StorageProvider';
import { type TrashItem } from '#/domain/models/trash';
import {
  type TrashDeps,
  createTrashRecord,
  purgeFromTrash,
  restoreItem,
  sweepExpired,
  trashOrDelete,
} from '#/domain/usecases/trash';
import { trashTargetNameFor, MAX_TRASH_RELOCATE_BYTES } from '#/domain/models/trash';
import { planTransfer, createConflictResolver, executeTransfer } from '#/domain/usecases/transfer';
import { resolveStoredItems, resolveStoredItem } from '#/domain/usecases/recent';
import { decodeSafSegmentFor } from '#/data/storage/safUri';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.log(
      `FAIL ${label}\n  got:      ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`,
    );
  } else {
    console.log(`ok   ${label} = ${JSON.stringify(actual)}`);
  }
}

// ---------------------------------------------------------------- fake provider

type Tree = Record<string, FileItem[]>;

function item(
  uri: string,
  name: string,
  isDirectory = false,
  extra: Partial<FileItem> = {},
): FileItem {
  return {
    id: uri,
    name,
    uri,
    parentUri: uri.slice(0, uri.lastIndexOf('/') + 1),
    type: isDirectory ? 'DIRECTORY' : 'TEXT',
    mimeType: null,
    size: isDirectory ? null : 100,
    modifiedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    isDirectory,
    isHidden: name.startsWith('.'),
    extension: isDirectory ? '' : 'txt',
    provider: 'local',
    ...extra,
  };
}

const FULL: ProviderCapabilities = {
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

function fakeProvider(
  tree: Tree,
  capabilities: Partial<ProviderCapabilities> = {},
): {
  provider: StorageProvider;
  moved: string[];
  copied: string[];
  deleted: string[];
  created: string[];
} {
  const moved: string[] = [];
  const copied: string[] = [];
  const deleted: string[] = [];
  const created: string[] = [];

  const provider: StorageProvider = {
    id: 'local',
    capabilities: { ...FULL, ...capabilities },
    async listVolumes() {
      return [];
    },
    async list(uri) {
      return tree[uri] ?? [];
    },
    async getMetadata(uri) {
      for (const children of Object.values(tree)) {
        const found = children.find((child) => child.uri === uri);
        if (found) return found;
      }
      return null;
    },
    async exists(uri) {
      for (const children of Object.values(tree)) {
        if (children.some((child) => child.uri === uri)) return true;
      }
      return Object.keys(tree).includes(uri);
    },
    async createDirectory(parentUri, name) {
      created.push(`${parentUri}${name}`);
      return item(`${parentUri}${name}/`, name, true);
    },
    async createFile() {
      throw new Error('unused');
    },
    async rename() {
      throw new Error('unused');
    },
    async copy(uri, destinationDirUri, options) {
      copied.push(`${uri} -> ${destinationDirUri} as ${options?.targetName ?? '(source name)'}`);
      return item(`${destinationDirUri}${options?.targetName ?? 'copied'}`, 'copied');
    },
    async move(uri, destinationDirUri, options) {
      moved.push(`${uri} -> ${destinationDirUri} as ${options?.targetName ?? '(source name)'}`);
      return item(`${destinationDirUri}${options?.targetName ?? 'moved'}`, 'moved');
    },
    async delete(uri) {
      deleted.push(uri);
    },
    async getSize() {
      return null;
    },
    async toShareableUri(uri) {
      return uri;
    },
    async toLocalPath(uri) {
      return uri.startsWith('file://') ? uri : null;
    },
  };

  return { provider, moved, copied, deleted, created };
}

// ------------------------------------------------------------------- SAF naming

check(
  'saf segment decodes',
  decodeSafSegmentFor('content://x/tree/primary%3ADownload/'),
  'Download',
);
check('saf segment plain', decodeSafSegmentFor('content://x/tree/primary:Pictures/'), 'Pictures');
check('saf segment none', decodeSafSegmentFor('content://x/tree/'), '');

// ------------------------------------------------------- stale-pointer handling

(async () => {
  const tree: Tree = {
    'file:///docs/': [item('file:///docs/a.txt', 'a.txt')],
  };
  const { provider } = fakeProvider(tree);

  check(
    'resolve live pointer',
    (await resolveStoredItem(provider, 'file:///docs/a.txt'))?.name,
    'a.txt',
  );
  check('resolve dead pointer', await resolveStoredItem(provider, 'file:///docs/gone.txt'), null);

  // An unreadable provider must not reject the whole batch.
  const throwing: StorageProvider = {
    ...provider,
    async getMetadata() {
      throw new Error('permission revoked');
    },
  };
  check('batch survives throw', await resolveStoredItems(throwing, ['file:///a', 'file:///b']), [
    null,
    null,
  ]);
  check('empty batch', await resolveStoredItems(provider, []), []);

  // -------------------------------------------------- trash name collision
  // The allocator lives in the model, and is exercised through the flow that
  // uses it — see the "trash flow" block below. Here only its invariants.

  const first = trashTargetNameFor(
    { originalName: 'r.txt', originalUri: 'file:///docs/r.txt' },
    [],
  );
  check('trash name is one segment', first.includes('/'), false);
  check('trash name keeps original prefix', first.startsWith('r.txt.'), true);
  check('trash name has short suffix', first.length < 24, true);
  check('trash name has no colon', first.includes(':'), false);

  // A record already holding this name forces a distinct target.
  const takenWithOwn: TrashItem[] = [
    {
      id: '1',
      originalUri: 'file:///docs/r.txt',
      originalName: 'r.txt',
      trashUri: `file:///app/.trash/${first}`,
      originalParentUri: 'file:///docs/',
      isDirectory: false,
      size: 1,
      deletedAt: 1,
      provider: 'local',
      mimeType: null,
      state: 'STORED',
      reason: null,
    },
  ];
  check(
    'trash name de-duplicates',
    trashTargetNameFor({ originalName: 'r.txt', originalUri: 'file:///docs/r.txt' }, takenWithOwn),
    'r.txt.2',
  );

  // -------------------------------------------------------------- trash flow

  /**
   * A trash store and providers, with the natives replaced by fakes.
   *
   * `capabilities` applies to the provider that *owns the user's files* — the one
   * a delete is performed against. `destinationCapabilities` applies to the
   * provider a restore writes back into, which is a different object and is
   * resolved from the record's original URI. Conflating the two is how a test
   * ends up asserting on a code path the real code never takes.
   */
  function trashHarness(
    options: {
      capabilities?: Partial<ProviderCapabilities>;
      destinationCapabilities?: Partial<ProviderCapabilities>;
      records?: TrashItem[];
      destinationTree?: Tree;
      transferRejects?: unknown;
      /** A transfer that reports success but writes nothing. */
      transferSilent?: boolean;
    } = {},
  ) {
    const records: TrashItem[] = [...(options.records ?? [])];
    const transferred: string[] = [];
    // Tracked separately from the store: "the record was not dropped" is a
    // different claim from "the store still has N rows", and only the first is
    // what a failed restore has to guarantee.
    const removals: string[] = [];
    const trashStore = fakeProvider({});
    const destination = fakeProvider(
      options.destinationTree ?? { 'file:///docs/': [] },
      options.destinationCapabilities,
    );

    const deps: TrashDeps = {
      documentUri: 'file:///app/',
      trash: trashStore.provider,
      transfer: async (source, target) => {
        transferred.push(`${source} -> ${target}`);
        if (options.transferRejects !== undefined) throw options.transferRejects;
        // Materialise the file, because the restore path reads it back before
        // dropping its record. A transfer that reported success without writing
        // anything is the failure the read-back exists to catch, and is exercised
        // separately.
        if (options.transferSilent) return;
        const parent = target.slice(0, target.lastIndexOf('/') + 1);
        const name = target.slice(parent.length);
        const tree = options.destinationTree;
        if (tree) {
          const siblings = tree[parent] ?? (tree[parent] = []);
          siblings.push(item(target, name));
        }
      },
      providerForUri: () => destination.provider,
      listRecords: async () => [...records],
      addRecord: async (record) => {
        records.push(record);
      },
      removeRecord: async (id) => {
        removals.push(id);
        const index = records.findIndex((entry) => entry.id === id);
        if (index >= 0) records.splice(index, 1);
      },
    };

    const source = fakeProvider(
      { 'file:///docs/': [item('file:///docs/r.txt', 'r.txt')] },
      options.capabilities,
    );

    return { deps, records, removals, transferred, source, trashStore, destination };
  }

  // A provider that can move uses move — one operation, no delete, no copy.
  {
    const h = trashHarness();
    const outcome = await trashOrDelete([item('file:///docs/r.txt', 'r.txt')], h.source.provider, {
      useTrash: true,
      deps: h.deps,
    });
    check('trash uses move when capable', h.source.moved.length, 1);
    check('trash move did not copy', h.source.copied, []);
    check('trash move did not delete', h.source.deleted, []);
    check('trash outcome counts one trashed', outcome.trashed, 1);
    check('trash outcome counts no permanent deletes', outcome.deleted, 0);
    check('trash record written', h.records.length, 1);
    check('trash record keeps the original name', h.records[0].originalName, 'r.txt');
    check(
      'trash record remembers the original folder',
      h.records[0].originalParentUri,
      'file:///docs/',
    );
    check('trash record is STORED', h.records[0].state, 'STORED');
    check(
      'trash record location is inside the trash',
      h.records[0].trashUri.startsWith('file:///app/.trash/'),
      true,
    );
  }

  // A provider that cannot move relocates by transfer, then deletes the original
  // — and the delete happens *after*, so a failed transfer leaves the file alone.
  {
    const h = trashHarness({ capabilities: { canMove: false, canRelocateToTrash: true } });
    const outcome = await trashOrDelete([item('file:///docs/r.txt', 'r.txt')], h.source.provider, {
      useTrash: true,
      deps: h.deps,
    });
    check('trash transfers when move unavailable', h.transferred.length, 1);
    check('trash deletes the original after transferring', h.source.deleted, [
      'file:///docs/r.txt',
    ]);
    check('trash still records a trashed item', outcome.trashed, 1);
  }

  // A provider that cannot relocate must delete permanently rather than refuse:
  // the user asked for the file to be gone.
  {
    const h = trashHarness({ capabilities: { canRelocateToTrash: false } });
    const outcome = await trashOrDelete([item('file:///docs/r.txt', 'r.txt')], h.source.provider, {
      useTrash: true,
      deps: h.deps,
    });
    check('an unrelocatable provider deletes permanently', outcome.deleted, 1);
    check('an unrelocatable provider trashes nothing', outcome.trashed, 0);
    check('an unrelocatable provider writes no record', h.records.length, 0);
  }

  // `trashEnabled: false` is a permanent delete, and must not consult the trash.
  {
    const h = trashHarness();
    const outcome = await trashOrDelete([item('file:///docs/r.txt', 'r.txt')], h.source.provider, {
      useTrash: false,
      deps: h.deps,
    });
    check('the trash can be switched off', outcome.deleted, 1);
    check('switching the trash off moves nothing', h.source.moved, []);
    check('switching the trash off writes no record', h.records.length, 0);
  }

  // A file too large to relocate is deleted, and *named* — the caller has to be
  // able to tell the user this one is not coming back.
  {
    // A real `AppError`, because the adapter throws one and the outcome is
    // decided by its code — a bare object would fall through as a generic
    // failure and the test would pass for the wrong reason.
    const h = trashHarness({
      capabilities: { canMove: false },
      transferRejects: new AppError('UNSUPPORTED', { message: 'too large' }),
    });
    const outcome = await trashOrDelete([item('file:///docs/r.txt', 'r.txt')], h.source.provider, {
      useTrash: true,
      deps: h.deps,
    });
    check('an oversized file is deleted instead', outcome.deleted, 1);
    check('an oversized file is reported by name', outcome.tooLarge, ['r.txt']);
    check('an oversized file writes no record', h.records.length, 0);
  }

  // One failure must not abandon the rest of the batch.
  {
    const h = trashHarness();
    let first = true;
    const flaky: StorageProvider = {
      ...h.source.provider,
      async delete(uri) {
        if (first) {
          first = false;
          throw new Error('locked by another app');
        }
        await h.source.provider.delete(uri);
      },
    };
    const a = item('file:///docs/a.txt', 'a.txt');
    const b = item('file:///docs/b.txt', 'b.txt');
    const outcome = await trashOrDelete([a, b], flaky, { useTrash: false, deps: h.deps });
    check('a locked file is counted as failed', outcome.failed, 1);
    check('the rest of the batch still completes', outcome.deleted, 1);
  }

  // Two same-named files in one selection must get distinct trash locations, or
  // the second overwrites the first and one file is lost without a word.
  {
    const h = trashHarness();
    const a = item('file:///docs/x/same.txt', 'same.txt');
    const b = item('file:///docs/y/same.txt', 'same.txt');
    const outcome = await trashOrDelete([a, b], h.source.provider, {
      useTrash: true,
      deps: h.deps,
    });
    check('both same-named files are trashed', outcome.trashed, 2);
    check(
      'they get different trash locations',
      h.records[0].trashUri !== h.records[1].trashUri,
      true,
    );
  }

  // A directory on a provider that cannot move cannot be relocated byte by byte,
  // so it is deleted permanently and counted as such.
  {
    const h = trashHarness({ capabilities: { canMove: false } });
    const folder = item('file:///docs/sub/', 'sub', true);
    const outcome = await trashOrDelete([folder], h.source.provider, {
      useTrash: true,
      deps: h.deps,
    });
    check('a SAF folder is deleted, not trashed', outcome.deleted, 1);
    check('a SAF folder writes no record', h.records.length, 0);
  }

  // An empty selection does nothing, and must not create the trash directory.
  {
    const h = trashHarness();
    const outcome = await trashOrDelete([], h.source.provider, { useTrash: true, deps: h.deps });
    check('an empty selection does nothing', outcome, {
      trashed: 0,
      deleted: 0,
      failed: 0,
      tooLarge: [],
    });
    check('an empty selection writes no record', h.records.length, 0);
  }

  // ---------------------------------------------------------------- restore
  {
    const stored: TrashItem = {
      id: '1',
      originalUri: 'file:///docs/r.txt',
      originalName: 'r.txt',
      trashUri: 'file:///app/.trash/r.txt.1',
      originalParentUri: 'file:///docs/',
      isDirectory: false,
      size: 1,
      deletedAt: 1,
      provider: 'local',
      mimeType: null,
      state: 'STORED',
      reason: null,
    };

    // The original folder is gone: refuse rather than restore somewhere invented.
    {
      const h = trashHarness({ records: [stored], destinationCapabilities: { canMove: false } });
      let code = '';
      try {
        await restoreItem({ ...stored, originalParentUri: 'file:///missing/' }, h.deps);
      } catch (error: any) {
        code = error.code;
      }
      check('restore refuses when the origin is gone', code, 'NOT_FOUND');
      check('a refused restore keeps its record', h.records.length, 1);
    }

    // A provider that cannot move restores by transfer, dropping the stored copy
    // only after the destination write has been read back.
    {
      const h = trashHarness({
        destinationCapabilities: { canMove: false },
        destinationTree: { 'file:///docs/': [] },
      });
      const restored = await restoreItem(stored, h.deps);
      check('restore transfers when move is unavailable', h.transferred.length, 1);
      check('restore drops the stored copy', h.records.length, 0);
      check('restore returns the item', restored.uri, 'file:///docs/r.txt');
    }

    // An already-purged record is not restorable, and says so.
    {
      const h = trashHarness();
      let code = '';
      try {
        await restoreItem({ ...stored, state: 'PURGED' }, h.deps);
      } catch (error: any) {
        code = error.code;
      }
      check('restore refuses a purged record', code, 'NOT_FOUND');
    }

    // A trashed folder on a provider that cannot move is not restorable, rather
    // than being half-recreated.
    {
      const h = trashHarness({ destinationCapabilities: { canMove: false } });
      let code = '';
      try {
        await restoreItem({ ...stored, isDirectory: true }, h.deps);
      } catch (error: any) {
        code = error.code;
      }
      check('restore refuses an unrelocatable folder', code, 'UNSUPPORTED');
    }
  }

  // A write that reports success but leaves nothing readable must not drop the
  // record — that copy is the only one left.
  {
    // The destination folder exists but nothing can be read back from it — the
    // shape of a SAF write that reports success and leaves nothing.
    const h = trashHarness({
      destinationCapabilities: { canMove: false },
      destinationTree: { 'file:///docs/': [] },
      transferSilent: true,
    });
    const blind: TrashDeps = h.deps;
    const stored: TrashItem = {
      id: 'x',
      originalUri: 'file:///docs/r.txt',
      originalName: 'r.txt',
      trashUri: 'file:///app/.trash/r.txt.1',
      originalParentUri: 'file:///docs/',
      isDirectory: false,
      size: 1,
      deletedAt: 1,
      provider: 'local',
      mimeType: null,
      state: 'STORED',
      reason: null,
    };
    let code = '';
    try {
      await restoreItem(stored, blind);
    } catch (error: any) {
      code = error.code;
    }
    check(
      'an unreadable restore is reported, not assumed',
      code === 'NOT_FOUND' || code === 'UNKNOWN',
      true,
    );
    check('an unreadable restore does not drop its record', h.removals, []);
  }

  // Purging a record whose bytes are already gone must be a no-op, not a throw.
  {
    const f = fakeProvider({});
    const missing: TrashItem = {
      id: '1',
      originalUri: 'file:///docs/r.txt',
      originalName: 'r.txt',
      trashUri: 'file:///app/.trash/missing',
      originalParentUri: 'file:///docs/',
      isDirectory: false,
      size: 1,
      deletedAt: 1,
      provider: 'local',
      mimeType: null,
      state: 'STORED',
      reason: null,
    };
    await purgeFromTrash(f.provider, missing);
    check('purge missing is safe', f.deleted, []);
  }

  // ---------------------------------------------------------------- retention
  {
    const now = Date.UTC(2026, 8, 27);
    const DAY = 24 * 60 * 60 * 1000;
    const fresh: TrashItem = createTrashRecord(
      item('file:///docs/a.txt', 'a.txt'),
      'file:///app/.trash/a.1',
      now,
    );
    const stale: TrashItem = createTrashRecord(
      item('file:///docs/b.txt', 'b.txt'),
      'file:///app/.trash/b.1',
      now - 40 * DAY,
    );
    const f = fakeProvider({});

    const h = trashHarness({ records: [fresh, stale] });
    h.deps.trash = f.provider;
    const purged = await sweepExpired(30, h.deps, now);
    check('the sweep purges only expired items', purged, 1);
    check(
      'the expired record is gone',
      h.records.map((r) => r.id),
      [fresh.id],
    );
  }

  // ------------------------------------------- transfer passes targetName down
  {
    // A provider that renames on copy must receive the planner's chosen name.
    const seen: (string | undefined)[] = [];
    const p: StorageProvider = {
      ...fakeProvider({}).provider,
      async copy(_src, _dest, options) {
        seen.push(options?.targetName);
        return item('file:///dest/x', 'x');
      },
      async move(_src, _dest, options) {
        seen.push(options?.targetName);
        return item('file:///dest/x', 'x');
      },
    };

    const plan = await planTransfer(
      { exists: async (u) => u === 'file:///dest/report.txt' } as StorageProvider,
      [item('file:///src/report.txt', 'report.txt')],
      'file:///dest/',
      'copy',
      createConflictResolver(async () => 'KEEP_BOTH'),
    );
    check('planner kept both', plan.entries[0].targetName, 'report (2).txt');

    await executeTransfer(p, plan);
    check('provider received target name', seen, ['report (2).txt']);
  }

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
  if (failures > 0) process.exit(1);
})();
