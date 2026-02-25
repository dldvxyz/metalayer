/** Placeholder origin used to validate relative paths as if they were full URLs. */
const ARBITRARY_ORIGIN = "https://example.com";

/**
 * Validates a URL string.
 *
 * Returns a URL object if the string is a valid, parseable URL
 * without consecutive slashes in the pathname (the "//" in the
 * protocol like "https://" is unaffected). Returns undefined otherwise.
 *
 * Returns a URL object (instead of a boolean) so callers can
 * inspect properties like `origin` for cross-URL comparisons.
 *
 * @param raw - The URL string to validate.
 * @returns The parsed URL object, or `undefined` if the string is not a valid URL.
 */
export function validateUrl(raw: string): URL | undefined {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
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
 * @param path - A path string, typically starting with "/".
 * @returns `true` if the path would form a valid URL, `false` otherwise.
 */
export function validatePath(path: string): boolean {
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
 * Checks whether a string is a valid absolute URL or a valid path.
 *
 * @param urlOrPath - A string to check as either an absolute URL or a path starting with "/".
 * @returns `true` if the string is a valid absolute URL or a valid path, `false` otherwise.
 */
export function isValidUrlOrPath(urlOrPath: string): boolean {
  if (urlOrPath.startsWith("/")) return validatePath(urlOrPath);
  return validateUrl(urlOrPath) !== undefined;
}
