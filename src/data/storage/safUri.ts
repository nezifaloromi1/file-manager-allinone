/**
 * SAF URI helpers, free of any `expo-file-system` import.
 *
 * The picker hands back a `content://` URI whose document id is percent-encoded
 * (`primary%3ADownload`). Every screen that needs to label a granted folder
 * needs the same decode, and pulling it out of the provider keeps it testable
 * without a device.
 */

export function decodeSafSegmentFor(uri: string): string {
  const withoutTrailing = uri.replace(/\/$/, '');

  // Decode *before* looking for the separator. A real tree URI looks like
  // `content://…/tree/primary%3ADownload`, where the document id is
  // percent-encoded and the only literal colon belongs to the scheme — so
  // searching the raw string for the last `:` finds nothing.
  let decoded = withoutTrailing;
  try {
    decoded = decodeURIComponent(withoutTrailing);
  } catch {
    // A malformed escape must not lose the label entirely; fall through and
    // work from the raw form.
  }

  const lastColon = decoded.lastIndexOf(':');
  const lastSlash = decoded.lastIndexOf('/');
  if (lastColon <= lastSlash) return '';
  return decoded.slice(lastColon + 1);
}

export function isSafUri(uri: string): boolean {
  return uri.startsWith('content://');
}

/**
 * A short, human-readable description of a granted root.
 *
 * The full SAF URI is a few hundred characters of percent-encoded tree path. It
 * is shown truncated for disambiguation — two folders both called `Photos` are
 * otherwise indistinguishable in the access list — but the whole URI is what
 * actually matters, so this is presented as detail rather than as the label.
 */
export function describeSafPick(uri: string): string {
  const match = /\/tree\/([^/]+)\//.exec(uri);
  const documentId = match?.[1];
  if (!documentId) return uri;

  const decoded = (() => {
    try {
      return decodeURIComponent(documentId);
    } catch {
      return documentId;
    }
  })();

  return decoded.length > 60 ? `${decoded.slice(0, 57)}…` : decoded;
}

/**
 * The `content://` URI for a `file://` path, when one can be derived.
 *
 * `expo-file-system` exposes `File.contentUri` for this, but that is a native
 * call. This is the pure fallback for labels and comparisons: it strips the
 * scheme and percent-encodes the path, which is the shape SAF tree URIs use.
 * It is not guaranteed to resolve against a real provider, so anything that
 * actually opens the file must use `File.contentUri` instead.
 */
export function fileUriToContentUri(fileUri: string): string {
  return `content://com.android.externalstorage.documents/document/${encodeURIComponent(
    fileUri.replace(/^file:\/\//, ''),
  )}`;
}
