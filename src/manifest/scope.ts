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

/** The manifest scope, parsed once and shared by all scope checks. */
export interface ManifestScope {
  /** The scope as written in the options, for messages. */
  readonly raw: string;
  /** Parsed scope. For a relative scope the origin is a placeholder and must not be compared. */
  readonly url: URL;
  /** Whether the scope was given as a path rather than an absolute URL. */
  readonly isRelative: boolean;
}

/** Outcome of checking a URL against the scope. */
export type ScopeVerdict = "ok" | "invalid" | "outside" | "prefix-only";

/**
 * Parses the scope member.
 *
 * @param raw - The scope as given: an absolute http(s) URL or a path starting with "/".
 * @returns The parsed scope, or `undefined` if it cannot be parsed.
 */
export function parseScope(raw: string): ManifestScope | undefined {
  const url = parseUrlOrPath(raw);
  if (!url) return undefined;
  return { raw, url, isRelative: raw.startsWith("/") };
}

/**
 * Checks a URL or path against the navigation scope.
 *
 * Follows the Web App Manifest specification: the target must be
 * same-origin with the scope (when both are absolute) and its path must
 * start with the scope's path, as a plain string prefix. Query and
 * fragment are ignored. A match that only works because the scope lacks a
 * trailing slash (scope `/app` matching `/application`) is reported
 * separately so the author can make the intent explicit.
 *
 * @param url - The URL or path to check.
 * @param scope - The parsed manifest scope.
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
 * @param scope - The parsed scope, or `undefined` if no valid scope is set.
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
    issues.push(
      `${label} "${displayUrl}" is outside the manifest scope "${scope.raw}".`
    );
  } else if (verdict === "prefix-only") {
    issues.push(
      `${label} "${displayUrl}" is within the manifest scope "${scope.raw}" only because the scope has no trailing slash. Use "${scope.raw}/" to limit the scope to that directory, or move the URL under it.`
    );
  }
}
