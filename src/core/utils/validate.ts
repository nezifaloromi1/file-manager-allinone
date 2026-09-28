/**
 * Filename validation and safe name composition.
 *
 * plan.md §20/§21 require validating new-folder and rename input; §31 and §45
 * require treating every name as untrusted input, because a name is the one
 * piece of a file's identity that comes from outside the app.
 *
 * The rules below are the intersection of what Android's own filesystems
 * accept, so a name that validates here will not fail opaquely at the syscall
 * layer later.
 */

export const MAX_NAME_BYTES = 255;

/**
 * Characters no mainstream filesystem accepts, on any platform.
 *
 * Note the absence of space and hyphen: `My Report 2 - final.pdf` is an
 * ordinary filename and must validate. An earlier version of this pattern
 * included them by accident, which would have rejected most real files.
 */
const FORBIDDEN_CHARS = /[/\\:*?"<>|]/;

/**
 * Control characters, including NUL.
 *
 * Kept separate from the punctuation class because a NUL inside a string
 * silently truncates it at the syscall boundary: `a\0b.txt` becomes `a` on
 * disk, which is a path the user never typed and cannot select again. Android
 * rejects these outright; this rejects them before that with a reason.
 */

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/** Names Android and desktop Linux reserve, matched case-insensitively. */
const RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

export type NameValidation = { valid: true; name: string } | { valid: false; reason: string };

/**
 * Validates a single path segment.
 *
 * Returns the trimmed name on success so callers can use the result directly
 * rather than re-trimming and risking a mismatch.
 */
export function validateName(input: string): NameValidation {
  const name = input.trim();

  if (name.length === 0) {
    return { valid: false, reason: 'Name cannot be empty.' };
  }
  if (name === '.' || name === '..') {
    return { valid: false, reason: `"${name}" is not a valid name.` };
  }
  if (CONTROL_CHARS.test(name)) {
    return { valid: false, reason: 'Name cannot contain control characters.' };
  }
  if (FORBIDDEN_CHARS.test(name)) {
    return { valid: false, reason: 'Name cannot contain / \\ : * ? " < > |' };
  }
  if (name.endsWith('.')) {
    return { valid: false, reason: 'Name cannot end with a period.' };
  }
  if (RESERVED_NAMES.has(name.toLowerCase().split('.')[0])) {
    return { valid: false, reason: `"${name}" is a reserved name.` };
  }
  if (byteLength(name) > MAX_NAME_BYTES) {
    return { valid: false, reason: `Name must be ${MAX_NAME_BYTES} bytes or fewer.` };
  }

  return { valid: true, name };
}

export function isValidName(input: string): boolean {
  return validateName(input).valid;
}

/**
 * Guards every name that reaches a storage provider.
 *
 * A single separator is the whole defence against path traversal: `..` and
 * `a/b` are both rejected above, so no caller can hand a provider a value that
 * resolves outside the directory it was given. Providers re-check this natively
 * too — it is defence in depth, not the only layer.
 */
export function assertSafeName(input: string): string {
  const result = validateName(input);
  if (!result.valid) {
    throw new Error(result.reason);
  }
  return result.name;
}

export type NameParts = {
  /** Everything before the extension, e.g. `report` from `report.pdf`. */
  stem: string;
  /** The extension including the leading dot, e.g. `.pdf`. Empty if none. */
  extension: string;
};

/**
 * Splits a filename into stem and extension.
 *
 * Only the final segment is considered, and a leading dot never starts an
 * extension — `.gitignore` is a stem, not an extensionless `gitignore`. This is
 * what lets rename (plan.md §20) preserve `report.pdf` instead of silently
 * dropping the extension.
 */
/**
 * Lowercase extension without the dot. Empty string when there is none.
 *
 * Defined here rather than imported from the domain model: `core` sits below
 * `domain` in the dependency order, so it cannot depend on a model.
 */
export function extractExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function splitName(name: string): NameParts {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) {
    return { stem: name, extension: '' };
  }
  return { stem: name.slice(0, dot), extension: name.slice(dot) };
}

/**
 * Composes the new name for a rename.
 *
 * The input is used verbatim. Earlier this tried to be clever — appending the
 * original extension when the input looked extension-less — but "does this
 * input have an extension" is genuinely ambiguous: `notes.md` could be a stem
 * with a dot or a complete new name, and guessing produced `notes.md.pdf` from
 * a user who had simply typed a new name.
 *
 * plan.md §20's requirement ("don't accidentally turn `report.pdf` into
 * `report`") is met at the call site instead: the dialog prefills the full
 * name, and `isExtensionDropped` lets it confirm when the user has removed an
 * extension on purpose.
 */
export function composeRenamedName(currentName: string, input: string): string {
  const trimmed = input.trim();
  return trimmed.length === 0 ? currentName : trimmed;
}

/**
 * True when the rename input no longer carries the original extension.
 *
 * Used to ask for confirmation, since that is the one rename that can change a
 * file's type and break whatever app the user opens it with next.
 */
export function isExtensionDropped(currentName: string, input: string): boolean {
  const { extension } = splitName(currentName);
  if (extension.length === 0) return false;
  const current = extractExtension(currentName);
  const next = extractExtension(input);
  if (next === current) return false;
  // No extension on either side means nothing was removed. An empty `next` with
  // a non-empty `current` is the only case worth confirming.
  return next.length === 0;
}

/**
 * Builds a non-colliding name: `report.pdf` → `report (2).pdf`.
 *
 * Used by the "Keep both" conflict resolution branch (plan.md §24) so the user
 * never loses a file and is never silently overwritten.
 */
export function withCopySuffix(name: string, index: number): string {
  const { stem, extension } = splitName(name);
  return `${stem} (${index})${extension}`;
}

/** UTF-8 byte length — filenames are limited in bytes, not characters. */
export function byteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.codePointAt(i) as number;
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code <= 0xffff) {
      bytes += 3;
    } else {
      // Surrogate pair — codePointAt already combined it, so skip the low half.
      bytes += 4;
      i += 1;
    }
  }
  return bytes;
}
