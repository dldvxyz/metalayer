/**
 * Validation and generation of XML sitemaps.
 *
 * @module
 */

import type { ValidationResult } from "./types/_shared.js";
import type { SitemapOptions, SitemapUrl } from "./types/sitemap.js";
import { normalizeUrl, validateUrl } from "./utils/url.js";

/** Matches YYYY-MM-DD date format. */
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

/** Matches ISO 8601 datetime: YYYY-MM-DDThh:mm:ss with optional fractional seconds and timezone. */
const DATETIME_RX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Matches one or more trailing slashes. */
const TRAILING_SLASHES_RX = /\/+$/;

/**
 * Strips trailing slashes from an origin so that concatenating
 * `origin + path` (where path starts with "/") doesn't produce
 * double slashes like "https://example.com//about".
 */
function stripTrailingSlashes(origin: string): string {
  return origin.replace(TRAILING_SLASHES_RX, "");
}

/** Escapes XML special characters in a string. */
function escapeXml(str: string): string {
  // "&" must be replaced first to avoid double-escaping
  // the "&" in entities like "&lt;" and "&gt;".
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&apos;")
    .replaceAll('"', "&quot;");
}

/**
 * Validates an ISO 8601 date (YYYY-MM-DD) or datetime string.
 *
 * Checks calendar correctness (not just format), rejects future dates,
 * and rejects dates before 1900.
 */
function isValidDateOrDateTime(value: string): boolean {
  let year: number, month: number, day: number;
  const isDateOnly = DATE_RX.test(value);

  if (isDateOnly) {
    [year, month, day] = value.split("-").map(Number);
  } else if (DATETIME_RX.test(value)) {
    [year, month, day] = value.slice(0, 10).split("-").map(Number);
  } else {
    return false;
  }

  // Verify calendar correctness (e.g. rejects Feb 30)
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return false;

  // Web pages did not exist before 1900; this catches obviously wrong years
  // (e.g. 0001 or 0000) that can result from bad date parsing.
  if (year < 1900) return false;

  // Compare in UTC to avoid timezone-sensitive rejection of "today"
  if (isDateOnly) {
    const now = new Date();
    const todayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );
    const dateUtc = Date.UTC(year, month - 1, day);
    return dateUtc <= todayUtc;
  }

  // For datetimes, compare in absolute (UTC) time — a datetime with a
  // timezone offset is converted to its UTC equivalent before comparison.
  const fullDate = new Date(value);
  if (Number.isNaN(fullDate.getTime())) return false;
  return fullDate <= new Date();
}

/**
 * Validates a sitemap configuration for common mistakes.
 *
 * Checks performed:
 * - Origin is a valid URL
 * - Each URL path forms a valid full URL when combined with origin
 * - No duplicate URLs after normalization
 * - Priority values are between 0.0 and 1.0 with at most one decimal place
 * - lastmod dates are valid ISO 8601 (not in the future or before 1900)
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
  const seenUrls = new Set<string>();

  const origin = stripTrailingSlashes(options.origin);

  // Validate that the origin is a valid URL
  if (!validateUrl(origin)) {
    issues.push(`Origin "${options.origin}" is not a valid URL.`);
  }

  for (const url of options.urls) {
    // Construct and validate the full URL from origin + path
    const fullRaw = origin + url.path;
    const parsed = validateUrl(fullRaw);
    const fullUrl = parsed ? parsed.href : fullRaw;

    if (!parsed) {
      issues.push(
        `URL for path "${url.path}" (${fullUrl}) is not a valid URL.`
      );
    }

    // No duplicate URLs after normalization
    if (seenUrls.has(fullUrl)) {
      issues.push(`Duplicate URL "${fullUrl}" found in sitemap.`);
    }
    seenUrls.add(fullUrl);

    // Priority must be between 0 and 1 with at most one decimal place.
    // The floor(x*10) !== x*10 check reliably detects extra decimals
    // because tenths (0.0-1.0) are precise enough in IEEE 754.
    if (
      url.priority !== undefined &&
      (url.priority < 0 ||
        url.priority > 1 ||
        Math.floor(url.priority * 10) !== url.priority * 10)
    ) {
      issues.push(
        `Priority ${url.priority} for "${fullUrl}" is invalid. Must be between 0.0 and 1.0 with at most one decimal place.`
      );
    }

    // lastmod must be a real date or datetime, not in the future or too far in the past
    if (url.lastmod !== undefined && !isValidDateOrDateTime(url.lastmod)) {
      issues.push(
        `Invalid lastmod "${url.lastmod}" for "${fullUrl}". Must be a valid ISO 8601 date (YYYY-MM-DD) or datetime.`
      );
    }
  }

  if (issues.length > 0) return { valid: false, issues };
  return { valid: true, options };
}

/** Builds a single `<url>` XML element for the sitemap. */
function buildUrlEntry(url: SitemapUrl, origin: string): string {
  const fullUrl = normalizeUrl(origin + url.path);

  // Defense-in-depth: escape all interpolated values even when they are
  // expected to be safe (e.g. ISO dates, enum strings). This prevents
  // malformed output if validation is skipped or a new field is added.
  const parts: string[] = [];
  parts.push("  <url>");
  parts.push(`    <loc>${escapeXml(fullUrl)}</loc>`);

  if (url.lastmod) {
    parts.push(`    <lastmod>${escapeXml(url.lastmod)}</lastmod>`);
  }
  if (url.changefreq) {
    parts.push(`    <changefreq>${escapeXml(url.changefreq)}</changefreq>`);
  }
  if (url.priority !== undefined) {
    parts.push(`    <priority>${url.priority.toFixed(1)}</priority>`);
  }

  parts.push("  </url>");
  return parts.join("\n");
}

/**
 * Generates an XML sitemap string from the given options.
 *
 * Produces a standard sitemap conforming to the sitemaps.org 0.9 schema,
 * with each URL entry including optional lastmod, changefreq, and priority.
 *
 * @remarks
 * This function does not validate the input. Call {@link validateSitemap}
 * first to catch configuration errors. Passing invalid options may produce
 * malformed output.
 *
 * @param options - The sitemap configuration to generate from.
 * @returns An XML string suitable for writing to a sitemap.xml file.
 *
 * @example
 * ```ts
 * const xml = generateSitemap({
 *   origin: "https://example.com",
 *   urls: [{ path: "/" }, { path: "/about" }],
 * });
 * ```
 */
export function generateSitemap(options: SitemapOptions): string {
  const origin = stripTrailingSlashes(options.origin);
  const entries = options.urls.map((url) => buildUrlEntry(url, origin));

  return (
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      "</urlset>"
    ].join("\n") + "\n"
  );
}
