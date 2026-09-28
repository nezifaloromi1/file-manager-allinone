/**
 * Typed, user-presentable errors.
 *
 * plan.md §42: "Every operation needs meaningful errors." A bare "Error" tells
 * the user nothing actionable, so every error carries three separable parts:
 *
 *   title  — what failed          ("Couldn't move the file.")
 *   message— why it failed        ("The destination doesn't have enough free space.")
 *   hint   — what to do next      ("Try another location.")
 *
 * `title` is safe to render directly. `message` and `hint` are built-in copy and
 * never interpolate user data, so a hostile filename can't smuggle text into
 * the UI (plan.md §31, §42).
 */

export type ErrorCode =
  /** The OS refused access to the path (plan.md §11). */
  | 'PERMISSION_DENIED'
  /** The path no longer exists — it may have been moved or deleted elsewhere. */
  | 'NOT_FOUND'
  /** A sibling with that name already exists (plan.md §21). */
  | 'ALREADY_EXISTS'
  /** The name failed validation (empty, illegal characters, reserved). */
  | 'INVALID_NAME'
  /** The volume is full, or the copy would exceed the destination's quota. */
  | 'NOT_ENOUGH_SPACE'
  /** The item is locked, or an open handle prevents the operation. */
  | 'IN_USE'
  /** The provider cannot perform this operation at all (plan.md §9). */
  | 'UNSUPPORTED'
  /** A move was attempted across volumes, which cannot be atomic. */
  | 'CROSS_DEVICE'
  /** The user dismissed a picker or a permission prompt. */
  | 'CANCELLED'
  /** Reading or parsing the underlying resource failed. */
  | 'CORRUPT'
  /** The operation was aborted by the user or by a lifecycle change. */
  | 'ABORTED'
  /** Anything we could not classify. */
  | 'UNKNOWN';

type ErrorCopy = {
  title: string;
  /** `undefined` when the title alone is the whole message — e.g. `Cancelled.` */
  message?: string;
  hint?: string;
};

const DEFAULT_COPY: Record<ErrorCode, ErrorCopy> = {
  PERMISSION_DENIED: {
    title: 'Storage access is required.',
    message: 'The app is not allowed to read or write this location.',
    hint: 'Grant access to this folder to continue.',
  },
  NOT_FOUND: {
    title: 'This item is no longer available.',
    message: 'It was moved, renamed, or deleted outside of the app.',
    hint: 'Refresh to see the current contents.',
  },
  ALREADY_EXISTS: {
    title: 'That name is already taken.',
    message: 'Another item in this folder uses the same name.',
    hint: 'Choose a different name.',
  },
  INVALID_NAME: {
    title: "That name can't be used.",
    message: 'Folder and file names cannot be empty or contain certain characters.',
    hint: 'Try a shorter, simpler name.',
  },
  NOT_ENOUGH_SPACE: {
    title: 'Not enough free space.',
    message: "The destination doesn't have enough available storage.",
    hint: 'Free up space or try another location.',
  },
  IN_USE: {
    title: 'This item is in use.',
    message: 'Another app has it open, so it cannot be changed right now.',
    hint: 'Close the other app and try again.',
  },
  UNSUPPORTED: {
    title: "This action isn't available here.",
    message: 'The selected storage location does not support this operation.',
    hint: 'Grant full file access in Settings to enable it.',
  },
  CROSS_DEVICE: {
    title: "Can't move between locations.",
    message: 'Source and destination are on different storage volumes.',
    hint: 'Copy instead, then delete the original.',
  },
  CANCELLED: {
    title: 'Cancelled.',
  },
  CORRUPT: {
    title: "This file couldn't be read.",
    message: 'It may be damaged, or the format is not what it claims to be.',
    hint: 'Try opening it with another app.',
  },
  ABORTED: {
    title: 'The operation was interrupted.',
    message: 'The app closed or the connection was lost before it finished.',
    hint: 'Try the operation again.',
  },
  UNKNOWN: {
    title: 'Something went wrong.',
    hint: 'Try again. If it keeps happening, restart the app.',
  },
};

export type AppErrorOptions = {
  /** Replaces the built-in explanation for this code. */
  message?: string;
  /** Replaces the built-in next step. */
  hint?: string;
  /** The underlying failure, preserved for logging. Never rendered. */
  cause?: unknown;
  /** Structured, privacy-safe context for the log (plan.md §49). */
  context?: Record<string, unknown>;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly title: string;
  readonly detail: string;
  readonly hint: string | undefined;
  readonly context: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const copy = DEFAULT_COPY[code];
    // `CANCELLED` carries no body — the title is the whole message — so fall
    // back to the title rather than leaving `Error.message` empty, which would
    // make logs and `String(error)` useless.
    super(options.message ?? copy.message ?? copy.title);
    this.name = 'AppError';
    this.code = code;
    this.title = copy.title;
    this.detail = options.message ?? copy.message ?? copy.title;
    this.hint = options.hint ?? copy.hint;
    this.context = options.context;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Maps a raw thrown value onto a code.
 *
 * `expo-file-system` throws plain `Error` subclasses with a message, so this
 * matches on message text. It is a heuristic on purpose: a misclassified code
 * degrades the wording, it never changes what the app actually did.
 */
export function classifyError(error: unknown): ErrorCode {
  if (isAppError(error)) return error.code;
  if (!(error instanceof Error)) return 'UNKNOWN';

  const message = error.message.toLowerCase();

  if (message.includes('permission') || message.includes('eacces') || message.includes('eperm')) {
    return 'PERMISSION_DENIED';
  }
  if (message.includes('no space left') || message.includes('enospc')) {
    return 'NOT_ENOUGH_SPACE';
  }
  if (message.includes('already exists') || message.includes('eexist')) {
    return 'ALREADY_EXISTS';
  }
  if (message.includes('enoent') || message.includes('does not exist')) {
    return 'NOT_FOUND';
  }
  if (message.includes('eisdir') || message.includes('not a directory')) {
    return 'IN_USE';
  }
  if (message.includes('exdev')) {
    return 'CROSS_DEVICE';
  }
  // expo-file-system throws these for copy/move/rename against a SAF content URI.
  if (message.includes('cannot be used with content uris')) {
    return 'UNSUPPORTED';
  }
  // Native messages from expo-file-system's `validateFileSystemChildName` and
  // its parent-containment check. Matched on the stable fragment only, since
  // the surrounding wording has changed between releases.
  if (message.includes('single path segment') || message.includes('escapes parent directory')) {
    return 'INVALID_NAME';
  }
  return 'UNKNOWN';
}

/** Normalises any thrown value into an `AppError` without losing the cause. */
export function toAppError(error: unknown, context?: Record<string, unknown>): AppError {
  if (isAppError(error)) return error;
  return new AppError(classifyError(error), { cause: error, context });
}

/** The shape every screen needs in order to render a failure. */
export type ErrorDescription = {
  title: string;
  message: string;
  hint: string | undefined;
  code: ErrorCode;
};

export function describeError(error: unknown): ErrorDescription {
  const appError = toAppError(error);
  return {
    title: appError.title,
    message: appError.detail,
    hint: appError.hint,
    code: appError.code,
  };
}
