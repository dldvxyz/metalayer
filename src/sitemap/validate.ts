/**
 * Validation of XML sitemap configurations.
 *
 * @module
 */

import type { ValidationResult } from "../shared/types.js";
import { hasControlCharacters, validateUrl } from "../shared/url.js";
import { isValidLastmod } from "./datetime.js";
import { toLocation } from "./location.js";
import type { SitemapChangeFreq, SitemapOptions, SitemapUrl } from "./types.js";

/** A single sitemap file may contain at most this many URLs (sitemaps.org protocol). */
const MAX_URLS_PER_SITEMAP = 50_000;

/** A `<loc>` value must be shorter than this many characters (sitemaps.org protocol). */
const MAX_LOCATION_LENGTH = 2048;

/** Priority is expressed in tenths; multiplying by this exposes extra decimals. */
const PRIORITY_SCALE = 10;

/** Matches a "%" that does not start a valid percent-encoded octet. */
const INVALID_PERCENT_ENCODING_RX = /%(?![0-9a-fA-F]{2})/u;

const CHANGE_FREQUENCIES: ReadonlySet<string> = new Set([
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never"
] satisfies SitemapChangeFreq[]);

/**
 * Validates the origin: a valid http(s) URL without query, fragment or
 * credentials. A path prefix is allowed.
 *
 * @returns Whether entry URLs can be built from the origin.
 */
function validateOrigin(origin: string, issues: string[]): boolean {
  const parsed = validateUrl(toLocation(origin, "/"));
  if (!parsed) {
    issues.push(`Origin "${origin}" is not a valid URL.`);
    return false;
  }
  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    issues.push(
      `Origin "${origin}" must not contain a query, fragment or credentials.`
    );
    return false;
  }
  return true;
}

/**
 * Validates the path of one entry and returns its normalized location.
 *
 * Returns `undefined` when the path cannot form a valid URL, in which case
 * the issue has already been reported.
 */
function validateLocation(
  url: SitemapUrl,
  origin: string,
  seenLocations: Set<string>,
  issues: string[]
): string | undefined {
  const { path } = url;

  if (path !== path.trim()) {
    issues.push(
      `Path ${JSON.stringify(path)} has leading or trailing whitespace.`
    );
    return undefined;
  }
  if (!path.startsWith("/")) {
    issues.push(`Path "${path}" must start with "/".`);
    return undefined;
  }
  if (hasControlCharacters(path)) {
    issues.push(
      `Path ${JSON.stringify(path)} contains a control character such as a line break.`
    );
    return undefined;
  }

  const raw = toLocation(origin, path);
  const parsed = validateUrl(raw);
  if (!parsed) {
    issues.push(`URL for path "${path}" (${raw}) is not a valid URL.`);
    return undefined;
  }

  const location = parsed.href;
  if (parsed.hash) {
    issues.push(
      `URL "${location}" contains a fragment ("#..."), which crawlers ignore. Remove it.`
    );
  }
  if (INVALID_PERCENT_ENCODING_RX.test(path)) {
    issues.push(`Path "${path}" contains an invalid percent-encoding.`);
  }
  if (location.length >= MAX_LOCATION_LENGTH) {
    issues.push(
      `URL "${location.slice(0, 60)}..." is ${location.length} characters long. A <loc> must be shorter than ${MAX_LOCATION_LENGTH} characters.`
    );
  }

  // Fragments are not sent to servers, so "/a" and "/a#x" are the same resource.
  const key = parsed.hash ? location.slice(0, -parsed.hash.length) : location;
  if (seenLocations.has(key)) {
    issues.push(`Duplicate URL "${location}" found in sitemap.`);
  }
  seenLocations.add(key);

  return location;
}

/** Validates the optional metadata (priority, changefreq, lastmod) of one entry. */
function validateMetadata(
  url: SitemapUrl,
  location: string,
  now: Date,
  issues: string[]
): void {
  // Priority must be between 0 and 1 with at most one decimal place.
  // The floor(x*10) !== x*10 check reliably detects extra decimals
  // because tenths (0.0-1.0) are exact enough in IEEE 754.
  if (
    url.priority !== undefined &&
    (url.priority < 0 ||
      url.priority > 1 ||
      Math.floor(url.priority * PRIORITY_SCALE) !==
        url.priority * PRIORITY_SCALE)
  ) {
    issues.push(
      `Priority ${url.priority} for "${location}" is invalid. Must be between 0.0 and 1.0 with at most one decimal place.`
    );
  }

  if (url.changefreq !== undefined && !CHANGE_FREQUENCIES.has(url.changefreq)) {
    issues.push(
      `Invalid changefreq "${url.changefreq}" for "${location}". Must be one of ${[...CHANGE_FREQUENCIES].join(", ")}.`
    );
  }

  if (url.lastmod !== undefined && !isValidLastmod(url.lastmod, now)) {
    issues.push(
      `Invalid lastmod "${url.lastmod}" for "${location}". Must be YYYY-MM-DD or YYYY-MM-DDThh:mm[:ss[.s]] with a time zone (Z or ±hh:mm), and not in the future.`
    );
  }
}

/**
 * Validates a sitemap configuration for common mistakes.
 *
 * Checks performed:
 * - Origin is a valid http(s) URL without query, fragment or credentials
 * - At least one URL and at most 50,000 URLs
 * - Each path starts with `/`, has no stray whitespace, and forms a valid
 *   URL shorter than 2,048 characters when combined with the origin
 * - No fragments and no malformed percent-encoding
 * - No duplicate URLs after normalization
 * - Priority values are between 0.0 and 1.0 with at most one decimal place
 * - changefreq is one of the protocol's values
 * - lastmod values are valid W3C dates or datetimes, not in the future
 *
 * @param options - The sitemap configuration to validate.
 * @returns `{ valid: true, options }` on success, or
 * `{ valid: false, issues }` with an array of issue descriptions.
 *
 * @example
 * ```ts
 * const result = validateSitemap({
 *   origin: "https://example.com",
 *   urls: [{ path: "/" }, { path: "/about", priority: 0.8 }],
 * });
 * if (!result.valid) console.error(result.issues);
 * ```
 */
export function validateSitemap(
  options: SitemapOptions
): ValidationResult<SitemapOptions> {
  const issues: string[] = [];
  const seenLocations = new Set<string>();
  const now = new Date();

  const isOriginValid = validateOrigin(options.origin, issues);

  if (options.urls.length === 0) {
    issues.push("Sitemap has no URLs. At least one entry is required.");
  }
  if (options.urls.length > MAX_URLS_PER_SITEMAP) {
    issues.push(
      `Sitemap contains ${options.urls.length} URLs. A single sitemap may contain at most ${MAX_URLS_PER_SITEMAP}; split it into multiple sitemaps.`
    );
  }

  for (const url of options.urls) {
    // Entry URLs cannot be checked against an unusable origin; report it once.
    const location = isOriginValid
      ? validateLocation(url, options.origin, seenLocations, issues)
      : undefined;
    validateMetadata(url, location ?? url.path, now, issues);
  }

  if (issues.length > 0) return { valid: false, issues };
  return { valid: true, options };
}
