/**
 * Navigation scope checks for manifest URL members.
 *
 * @module
 */

import {
  isValidUrlOrPath,
  parseUrlOrPath,
  validateUrl
} from "../shared/url.js";

/** The navigation scope that URL members are checked against. */
export interface ManifestScope {
  /** The scope as written, or as derived from start_url, for messages. */
  readonly raw: string;
  /** Parsed scope. For a relative scope the origin is a placeholder and must not be compared. */
  readonly url: URL;
  /** Whether the app origin is unknown, so only paths can be compared. */
  readonly isRelative: boolean;
  /** How messages refer to the scope, e.g. `the manifest scope "/app/"`. */
  readonly description: string;
}

/** Outcome of checking a URL against the scope. */
export type ScopeVerdict = "ok" | "invalid" | "outside" | "prefix-only";

/** Parses a URL or path, resolving paths against the app origin when it is known. */
function resolve(
  urlOrPath: string,
  origin: string | undefined
): URL | undefined {
  return urlOrPath.startsWith("/") && origin !== undefined
    ? validateUrl(origin + urlOrPath)
    : parseUrlOrPath(urlOrPath);
}

/**
 * Parses the scope member.
 *
 * @param raw - The scope as given: an absolute http(s) URL or a path starting with "/".
 * @param origin - The app origin when known (from an absolute start_url), used to resolve a path scope.
 * @returns The parsed scope, or `undefined` if it cannot be parsed.
 */
export function parseScope(
  raw: string,
  origin: string | undefined
): ManifestScope | undefined {
  const url = resolve(raw, origin);
  if (!url) return undefined;
  return {
    raw,
    url,
    isRelative: raw.startsWith("/") && origin === undefined,
    description: `the manifest scope "${raw}"`
  };
}

/**
 * Derives the scope browsers use when the scope member is absent: the
 * start URL with its file name, query and fragment removed.
 *
 * @param startUrl - The start_url member.
 * @param origin - The app origin when known.
 * @returns The default scope, or `undefined` if start_url cannot be parsed.
 */
export function deriveDefaultScope(
  startUrl: string,
  origin: string | undefined
): ManifestScope | undefined {
  const base = resolve(startUrl, origin);
  if (!base) return undefined;

  const url = new URL(".", base);
  const isRelative = startUrl.startsWith("/") && origin === undefined;
  const raw = isRelative ? url.pathname : url.href;
  return {
    raw,
    url,
    isRelative,
    description: `the default scope "${raw}" that browsers derive from start_url`
  };
}

/**
 * Checks a URL or path against the navigation scope.
 *
 * Follows the Web App Manifest specification: the target must be
 * same-origin with the scope (when the app origin is known) and its path
 * must start with the scope's path, as a plain string prefix. Query and
 * fragment are ignored. A match that only works because the scope lacks a
 * trailing slash (scope `/app` matching `/application`) is reported
 * separately so the author can make the intent explicit.
 *
 * @param url - The URL or path to check.
 * @param scope - The navigation scope.
 * @returns The verdict for this URL.
 */
export function checkWithinScope(
  url: string,
  scope: ManifestScope
): ScopeVerdict {
  const resolved = url.startsWith("/")
    ? validateUrl(scope.url.origin + url)
    : validateUrl(url);
  if (!resolved) return "invalid";

  if (!scope.isRelative && resolved.origin !== scope.url.origin) {
    return "outside";
  }

  const scopePath = scope.url.pathname;
  const targetPath = resolved.pathname;
  if (!targetPath.startsWith(scopePath)) return "outside";

  const continuesSegment =
    !scopePath.endsWith("/") &&
    targetPath.length > scopePath.length &&
    targetPath[scopePath.length] !== "/";
  return continuesSegment ? "prefix-only" : "ok";
}

/**
 * Validates a URL or path, checking scope containment when a scope is available.
 *
 * @param url - The URL or path to validate.
 * @param label - Label for the issue message (e.g. `"start_url"`).
 * @param scope - The navigation scope, or `undefined` if none is known.
 * @param issues - Mutable array to push any validation issues into.
 * @param displayUrl - The value to show in messages when `url` was pre-processed.
 */
export function validateScopedUrl(
  url: string,
  label: string,
  scope: ManifestScope | undefined,
  issues: string[],
  displayUrl: string = url
): void {
  if (scope === undefined) {
    if (!isValidUrlOrPath(url)) {
      issues.push(`${label} "${displayUrl}" is not a valid URL or path.`);
    }
    return;
  }

  const verdict = checkWithinScope(url, scope);
  if (verdict === "invalid") {
    issues.push(`${label} "${displayUrl}" is not a valid URL or path.`);
  } else if (verdict === "outside") {
    issues.push(`${label} "${displayUrl}" is outside ${scope.description}.`);
  } else if (verdict === "prefix-only") {
    issues.push(
      `${label} "${displayUrl}" is within ${scope.description} only because the scope has no trailing slash. Use "${scope.raw}/" to limit the scope to that directory, or move the URL under it.`
    );
  }
}
