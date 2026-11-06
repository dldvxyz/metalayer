/**
 * Generation of XML sitemaps.
 *
 * @module
 */

import { normalizeUrl } from "../shared/url.js";
import { toLocation } from "./location.js";
import type { SitemapOptions, SitemapUrl } from "./types.js";

/** Escapes the five XML special characters in a string. */
function escapeXml(value: string): string {
  // "&" must be replaced first to avoid double-escaping
  // the "&" in entities like "&lt;" and "&gt;".
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&apos;")
    .replaceAll('"', "&quot;");
}

/** Builds a single `<url>` XML element for the sitemap. */
function buildUrlEntry(url: SitemapUrl, origin: string): string {
  const location = normalizeUrl(toLocation(origin, url.path));

  // Defense-in-depth: escape all interpolated values even when they are
  // expected to be safe (e.g. ISO dates, enum strings). This prevents
  // malformed output if validation is skipped or a new field is added.
  const parts = ["  <url>", `    <loc>${escapeXml(location)}</loc>`];

  if (url.lastmod !== undefined) {
    parts.push(`    <lastmod>${escapeXml(url.lastmod)}</lastmod>`);
  }
  if (url.changefreq !== undefined) {
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
 * URLs are normalized by the platform URL parser (percent-encoding of
 * non-ASCII characters, default port removal) and XML-escaped.
 *
 * @remarks
 * This function does not validate the input. Call {@link validateSitemap}
 * first to catch configuration errors. Passing invalid options may produce
 * malformed output; for example, a priority with more than one decimal
 * place is rounded to one decimal.
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
  const entries = options.urls.map((url) => buildUrlEntry(url, options.origin));

  return (
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      "</urlset>"
    ].join("\n") + "\n"
  );
}
