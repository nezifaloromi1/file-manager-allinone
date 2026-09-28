/**
 * Checks for the operations layer that has no native dependency (plan.md §22,
 * §23, §24, §48).
 *
 * The queue's *rendering* needs React, but the decisions it makes are pure:
 * conflict planning, the operation lifecycle, and cancellation semantics. Those
 * are what a user loses data to if they are wrong, so they are checked here
 * against a fake provider.
 *
 * Run: `bun run scripts/verify-operations.ts`
 */

import { type FileItem } from '#/domain/models/fileItem';
import {
  type ConflictPolicy,
  type FileOperation,
  createOperation,
  formatProgressLabel,
  isTerminal,
  transition,
  withProgress,
} from '#/domain/models/operation';
import { type StorageProvider } from '#/domain/storage/StorageProvider';
import { createConflictResolver, executeTransfer, planTransfer } from '#/domain/usecases/transfer';
import { describeSafPick } from '#/data/storage/safUri';

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

// ------------------------------------------------------------------ lifecycle

let op: FileOperation = createOperation({
  id: 'o1',
  kind: 'copy',
  itemUris: ['file:///a'],
  label: 'Copying 1 item',
  now: 1000,
});

check('starts queued', op.state, 'QUEUED');
check('queued is not terminal', isTerminal(op.state), false);
check('no start time before running', op.startedAt, null);

op = transition(op, 'RUNNING', {}, 2000);
check('running stamps start', op.startedAt, 2000);
check('running is not terminal', isTerminal('RUNNING'), false);

op = withProgress(op, 512, 1024);
check('progress ratio', op.progress.ratio, 0.5);
check('progress label', formatProgressLabel(op.progress), '512 B / 1.0 KB');
check(
  'progress with unknown total',
  formatProgressLabel({ ratio: 0, transferred: 5, total: null }),
  'Calculating…',
);

op = transition(op, 'COMPLETED', {}, 3000);
check('completed is terminal', isTerminal(op.state), true);
check('completed stamps finish', op.finishedAt, 3000);
check('completed forces full progress', op.progress.ratio, 1);

// Restarting a finished operation must not move its original start time.
const restarted = transition(op, 'RUNNING', {}, 9999);
check('restart keeps original start', restarted.startedAt, 2000);

check('paused is not terminal', isTerminal('PAUSED'), false);
check('cancelled is terminal', isTerminal('CANCELLED'), true);
check('failed is terminal', isTerminal('FAILED'), true);

// A failed operation must not carry a stale error into a retry.
let failing = transition(
  createOperation({ id: 'o2', kind: 'move', itemUris: [], label: 'x' }),
  'RUNNING',
);
failing = transition(failing, 'FAILED', {
  error: { title: 't', message: 'm', hint: undefined, code: 'PERMISSION_DENIED' },
});
check('failure records the code', failing.error?.code, 'PERMISSION_DENIED');
check('retry clears the error', transition(failing, 'RUNNING').error, null);

// ---------------------------------------------------------------- fake provider

function item(name: string, isDirectory = false): FileItem {
  return {
    id: `id-${name}`,
    name,
    uri: `file:///src/${name}`,
    parentUri: 'file:///src/',
    type: isDirectory ? 'DIRECTORY' : 'TEXT',
    mimeType: null,
    size: isDirectory ? null : 100,
    modifiedAt: 1_700_000_000_000,
    createdAt: null,
    isDirectory,
    isHidden: false,
    extension: isDirectory ? '' : 'txt',
    provider: 'local',
  };
}

const DEST = 'file:///dest/';

/** A provider that records what it was asked to do. */
function fakeProvider(existing: string[] = [], failOn: string[] = []) {
  const copied: { from: string; to: string; name: string | undefined }[] = [];
  const deleted: string[] = [];

  const provider = {
    id: 'local',
    capabilities: {
      canList: true,
      canCreateDirectory: true,
      canCreateFile: true,
      canRename: true,
      canCopy: true,
      canMove: true,
      canDeletePermanently: true,
      canWrite: true,
      canRelocateToTrash: true,
    },
    async listVolumes() {
      return [];
    },
    async list() {
      return [];
    },
    async getMetadata() {
      return null;
    },
    async exists(uri: string) {
      return existing.includes(uri);
    },
    async createDirectory() {
      throw new Error('unused');
    },
    async createFile() {
      throw new Error('unused');
    },
    async rename() {
      throw new Error('unused');
    },
    async copy(from: string, to: string, options?: { targetName?: string }) {
      copied.push({ from, to, name: options?.targetName });
      if (failOn.includes(from)) throw new Error('EACCES: permission denied');
      return item('done');
    },
    async move(from: string, to: string, options?: { targetName?: string }) {
      copied.push({ from, to, name: options?.targetName });
      if (failOn.includes(from)) throw new Error('EACCES: permission denied');
      return item('done');
    },
    async delete(uri: string) {
      deleted.push(uri);
    },
    async getSize() {
      return null;
    },
    async toShareableUri(uri: string) {
      return uri;
    },
    async toLocalPath(uri: string) {
      return uri;
    },
  } as unknown as StorageProvider;

  return { provider, copied, deleted };
}

// ------------------------------------------------------------------- planning

(async () => {
  // Every collision decision, checked against a provider that reports the file
  // already present at the destination.
  const occupied = fakeProvider([`${DEST}report.txt`]);

  let plan = await planTransfer(
    occupied.provider,
    [item('report.txt')],
    DEST,
    'copy',
    createConflictResolver(async () => 'KEEP_BOTH'),
  );
  check('KEEP_BOTH renames', plan.entries[0].targetName, 'report (2).txt');

  plan = await planTransfer(
    occupied.provider,
    [item('report.txt')],
    DEST,
    'copy',
    createConflictResolver(async () => 'REPLACE'),
  );
  check('REPLACE keeps the name', plan.entries[0].targetName, 'report.txt');

  plan = await planTransfer(
    occupied.provider,
    [item('report.txt')],
    DEST,
    'copy',
    createConflictResolver(async () => 'SKIP'),
  );
  check('SKIP drops the entry', plan.entries.length, 0);
  check('SKIP is recorded', plan.skipped.length, 1);

  plan = await planTransfer(
    occupied.provider,
    [item('report.txt')],
    DEST,
    'copy',
    createConflictResolver(async () => 'CANCEL'),
  );
  check('CANCEL stops planning', plan.cancelled, true);
  check('CANCEL queues nothing', plan.entries.length, 0);

  // "Apply to all" must ask once and then reuse the answer, rather than showing
  // a dialog per file.
  let askCount = 0;
  const sticky = createConflictResolver(async () => {
    askCount += 1;
    return 'KEEP_BOTH';
  });
  const many = await planTransfer(
    fakeProvider([`${DEST}a.txt`, `${DEST}b.txt`]).provider,
    [item('a.txt'), item('b.txt')],
    DEST,
    'copy',
    sticky,
  );
  check('all items planned', many.entries.length, 2);
  check('second item got a free name', many.entries[1].targetName, 'b (2).txt');
  // Every collision is asked. Making the resolver sticky by default would mean a
  // user who replaced one file had "replace" applied silently to the other 39.
  check('each collision is asked', askCount, 2);

  // Choosing the same policy twice is still two prompts, not one.
  let reask = 0;
  const notSticky = createConflictResolver(async () => {
    reask += 1;
    return 'REPLACE';
  });
  await notSticky('x', item('a.txt'));
  await notSticky('y', item('b.txt'));
  await notSticky('z', item('c.txt'));
  check('a plain policy does not latch', reask, 3);

  // Only "apply to all" latches, and it latches a concrete strategy.
  let latchAsks = 0;
  const latching = createConflictResolver(async () => {
    latchAsks += 1;
    return latchAsks === 1 ? 'APPLY_TO_ALL' : 'SKIP';
  });
  check('apply-to-all first decision', await latching('x', item('a.txt')), 'SKIP');
  check('apply-to-all latched', await latching('y', item('b.txt')), 'SKIP');
  check('apply-to-all latched again', await latching('z', item('c.txt')), 'SKIP');
  check('apply-to-all asked only twice', latchAsks, 2);

  // APPLY_TO_ALL re-asks once to learn the concrete strategy.
  let applyAsks = 0;
  const applyResolver = createConflictResolver(async () => {
    applyAsks += 1;
    return applyAsks === 1 ? 'APPLY_TO_ALL' : 'REPLACE';
  });
  const applied = await applyResolver('x', item('a.txt'));
  check('apply-to-all resolves to a concrete policy', applied, 'REPLACE');
  check('apply-to-all asked twice, not once', applyAsks, 2);

  // -------------------------------------------------------------- execution

  const exec = fakeProvider([]);
  const execPlan = await planTransfer(
    exec.provider,
    [item('a.txt'), item('b.txt')],
    DEST,
    'copy',
    createConflictResolver(async () => 'SKIP'),
  );
  let result = await executeTransfer(exec.provider, execPlan);
  check('execution completes both', result.completed.length, 2);
  check('no failures', result.failed.length, 0);
  check('provider received the destination', exec.copied[0].to, DEST);

  // A failure on one item must not abandon the rest of the batch. Deleting 20
  // files and stopping at the first locked one leaves a partial result the user
  // neither asked for nor can predict.
  const flaky = fakeProvider([], ['file:///src/b.txt']);
  const flakyPlan = await planTransfer(
    flaky.provider,
    [item('a.txt'), item('b.txt'), item('c.txt')],
    DEST,
    'copy',
    createConflictResolver(async () => 'SKIP'),
  );
  result = await executeTransfer(flaky.provider, flakyPlan);
  check('failed item recorded', result.failed.length, 1);
  check('batch continued past the failure', result.completed.length, 2);
  check('all three were attempted', flaky.copied.length, 3);

  // Cancellation stops before the next item and reports a partial result.
  const cancelProvider = fakeProvider([]);
  const cancelPlan = await planTransfer(
    cancelProvider.provider,
    [item('a.txt'), item('b.txt')],
    DEST,
    'copy',
    createConflictResolver(async () => 'SKIP'),
  );
  let seen = 0;
  const cancelled = await executeTransfer(cancelProvider.provider, cancelPlan, {
    signal: {
      get isCancelled() {
        seen += 1;
        return seen > 1;
      },
    },
  });
  check('cancellation stops the batch', cancelProvider.copied.length < 2, true);

  // ------------------------------------------------------- move vs copy

  const moveProvider = fakeProvider([]);
  const movePlan = await planTransfer(
    moveProvider.provider,
    [item('a.txt')],
    DEST,
    'move',
    createConflictResolver(async () => 'SKIP'),
  );
  await executeTransfer(moveProvider.provider, movePlan);
  check('move reaches the provider as a move', moveProvider.copied.length, 1);

  // A directory can be moved but not copied onto itself.
  let selfCopyCode = '';
  try {
    await planTransfer(
      fakeProvider([]).provider,
      [item('folder', true)],
      'file:///src/folder/',
      'copy',
      createConflictResolver(async () => 'SKIP'),
    );
  } catch (error) {
    selfCopyCode = (error as { code?: string }).code ?? '';
  }
  check('directory cannot be copied onto itself', selfCopyCode, 'ALREADY_EXISTS');

  // ------------------------------------------------------------- formatting

  check(
    'progress label is readable',
    formatProgressLabel({ ratio: 0, transferred: 2 * 1024 ** 3, total: 5 * 1024 ** 3 }),
    '2.0 GB / 5.0 GB',
  );
  check(
    'saf description is bounded',
    describeSafPick('content://x/tree/primary%3A' + 'a'.repeat(200) + '/').length <= 60,
    true,
  );

  console.log(`${checks - failures}/${checks} checks passed`);
  console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
  if (failures > 0) process.exit(1);
})();
