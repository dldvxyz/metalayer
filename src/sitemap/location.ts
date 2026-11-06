/**
 * Building `<loc>` values from the shared origin and a path.
 *
 * Used by both the validator and the generator so the two cannot drift.
 *
 * @module
 */

/** Matches one or more trailing slashes. */
const TRAILING_SLASHES_RX = /\/+$/u;

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
  return origin.replace(TRAILING_SLASHES_RX, "") + path;
}
