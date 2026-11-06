/**
 * URL helpers shared by all generators and validators.
 *
 * Validation is deliberately strict: only http(s) URLs are accepted, raw
 * control characters are rejected (the WHATWG URL parser would silently
 * strip tabs and newlines, which could otherwise smuggle extra lines into
 * line-based formats such as robots.txt), and consecutive slashes in a path
 * are treated as a mistake (they almost always come from joining an origin
 * that already ends with "/" to a path that starts with "/").
 *
 * @module
 */

/** Placeholder origin used to validate relative paths as if they were full URLs. */
const ARBITRARY_ORIGIN = "https://example.com";

/** Code point of the last C0 control character (US, 0x1F). */
const LAST_C0_CONTROL = 0x1f;

/** Code point of DEL (0x7F), the only C1-adjacent control in ASCII. */
const DELETE = 0x7f;

/**
 * Checks whether a string contains ASCII control characters
 * (U+0000–U+001F or U+007F), including tabs and line breaks.
 *
 * @param value - The string to check.
 * @returns `true` if any control character is present.
 */
export function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= LAST_C0_CONTROL || codePoint === DELETE) return true;
  }
  return false;
}

/**
 * Validates an absolute http(s) URL string.
 *
 * Returns a URL object if the string is a parseable http or https URL
 * without control characters and without consecutive slashes in the
 * pathname (the "//" in the protocol is unaffected). Returns `undefined`
 * otherwise.
 *
 * Returns a URL object (instead of a boolean) so callers can inspect
 * properties like `origin` and `pathname` for cross-URL comparisons.
 *
 * @param raw - The URL string to validate.
 * @returns The parsed URL object, or `undefined` if the string is not a valid URL.
 */
export function validateUrl(raw: string): URL | undefined {
  if (hasControlCharacters(raw)) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return undefined;
  }
  if (parsed.pathname.includes("//")) return undefined;
  return parsed;
}

/**
 * Validates that a path (starting with "/") would form a valid URL.
 *
 * Concatenates the path with an arbitrary origin and checks
 * if the result is a valid, parseable URL.
 *
 * @param path - A path string that must start with "/".
 * @returns `true` if the path would form a valid URL, `false` otherwise.
 */
export function validatePath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  return validateUrl(ARBITRARY_ORIGIN + path) !== undefined;
}

/**
 * Normalizes a path by parsing it as a URL and extracting
 * the pathname, search, and hash components.
 *
 * Does not validate the path. If the path is invalid and
 * cannot be parsed, it is returned as-is.
 *
 * @param path - A path string, typically starting with "/".
 * @returns The normalized path, or the original path if it cannot be parsed.
 */
export function normalizePath(path: string): string {
  const parsed = validateUrl(ARBITRARY_ORIGIN + path);
  if (!parsed) return path;
  return parsed.pathname + parsed.search + parsed.hash;
}

/**
 * Normalizes a URL or path string to its canonical form.
 *
 * Normalization is performed by the platform URL parser, which applies
 * percent-encoding normalization, default port removal, and path
 * resolution (e.g. collapsing `/../` segments).
 *
 * For paths (starting with "/"), delegates to {@link normalizePath}.
 * For absolute URLs, parses and returns the normalized href.
 * For strings that do not start with "/" and are not parseable as
 * absolute URLs, the original string is returned unchanged.
 *
 * @param url - An absolute URL or a path starting with "/".
 * @returns The normalized URL or path, or the original string if it cannot be parsed.
 */
export function normalizeUrl(url: string): string {
  if (url.startsWith("/")) return normalizePath(url);
  const parsed = validateUrl(url);
  return parsed ? parsed.href : url;
}

/**
 * Parses an absolute http(s) URL or a path starting with "/".
 *
 * Paths are resolved against a placeholder origin, so the returned URL
 * object is useful for inspecting `pathname`, `search` and `hash`, but
 * its `origin` is only meaningful for absolute input.
 *
 * @param urlOrPath - An absolute URL or a path starting with "/".
 * @returns The parsed URL object, or `undefined` if the string is neither a valid URL nor a valid path.
 */
export function parseUrlOrPath(urlOrPath: string): URL | undefined {
  return validateUrl(
    urlOrPath.startsWith("/") ? ARBITRARY_ORIGIN + urlOrPath : urlOrPath
  );
}

/**
 * Checks whether a string is a valid absolute http(s) URL or a valid path.
 *
 * @param urlOrPath - A string to check as either an absolute URL or a path starting with "/".
 * @returns `true` if the string is a valid absolute URL or a valid path, `false` otherwise.
 */
export function isValidUrlOrPath(urlOrPath: string): boolean {
  return parseUrlOrPath(urlOrPath) !== undefined;
}

/**
 * Extracts the lowercase pathname of a URL or path, without query or hash.
 *
 * Useful for file-extension checks that must not be fooled by cache
 * busters (`/icon.svg?v=2`) or uppercase extensions (`/ICON.SVG`).
 *
 * @param urlOrPath - An absolute URL or a path starting with "/".
 * @returns The lowercase pathname, or `undefined` if the string cannot be parsed.
 */
export function getPathname(urlOrPath: string): string | undefined {
  return parseUrlOrPath(urlOrPath)?.pathname.toLowerCase();
}
