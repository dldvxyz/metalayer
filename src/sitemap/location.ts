/**
 * Building `<loc>` values from the shared origin and a path.
 *
 * Used by both the validator and the generator so the two cannot drift.
 *
 * @module
 */

import { validateUrl } from "../shared/url.js";

/**
 * Characters that RFC 3986 does not allow in a path, query or fragment but
 * that the WHATWG URL serializer may leave unencoded.
 */
const NON_RFC3986_RX = /[[\]{}|^`\\]/gu;

/** Code point of "/". */
const SLASH = 0x2f;

/** Length of the "//" that follows the scheme of an http(s) URL. */
const AUTHORITY_PREFIX_LENGTH = 2;

/**
 * Joins the sitemap origin and a path into a raw URL string.
 *
 * Trailing slashes are stripped from the origin so that `origin + path`
 * (where `path` starts with "/") does not produce "https://example.com//about".
 *
 * @param origin - The origin or base URL shared by all entries.
 * @param path - The path of the entry, starting with "/".
 * @returns The concatenated URL, not yet normalized.
 */
export function toLocation(origin: string, path: string): string {
  let end = origin.length;
  while (end > 0 && origin.codePointAt(end - 1) === SLASH) end -= 1;
  return origin.slice(0, end) + path;
}

/**
 * Serializes a parsed http(s) URL as an RFC 3986 URI.
 *
 * Starts from the WHATWG serialization (percent-encoded non-ASCII, IDN host
 * in Punycode, default port removed) and percent-encodes the characters
 * RFC 3986 forbids after the authority, such as "[", "]" and "|". The sitemap
 * protocol requires RFC 3986 URLs, and its schema rejects the raw characters.
 *
 * @param url - A parsed http(s) URL.
 * @returns The RFC 3986 form of the URL.
 */
export function formatLocation(url: URL): string {
  const { href } = url;
  // For http(s) URLs the path always starts with the first "/" after "//".
  const pathStart = href.indexOf(
    "/",
    url.protocol.length + AUTHORITY_PREFIX_LENGTH
  );
  if (pathStart === -1) return href;
  const tail = href
    .slice(pathStart)
    .replaceAll(
      NON_RFC3986_RX,
      (char) => `%${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}`
    );
  return href.slice(0, pathStart) + tail;
}

/**
 * Builds the `<loc>` value of an entry: origin and path joined, normalized
 * and RFC 3986-escaped.
 *
 * @param origin - The origin or base URL shared by all entries.
 * @param path - The path of the entry, starting with "/".
 * @returns The location, or `undefined` if the joined string is not a valid URL.
 */
export function buildLocation(
  origin: string,
  path: string
): string | undefined {
  const parsed = validateUrl(toLocation(origin, path));
  return parsed ? formatLocation(parsed) : undefined;
}
