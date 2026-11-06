import type { AbsoluteUrl, NonEmptyArray, UrlPath } from "../shared/types.js";

/** `Z` for UTC, or a `±hh:mm` offset. */
type TimeZone = "Z" | `${"+" | "-"}${number}:${number}`;

/**
 * Calendar date: `YYYY-MM-DD`.
 *
 * The type checks the shape only. {@link validateSitemap} checks that the
 * date exists and is neither before 1900 nor in the future.
 *
 * @example "2024-01-15"
 */
export type IsoDate = `${number}-${number}-${number}`;

/**
 * Date and time with seconds and a time zone: `YYYY-MM-DDThh:mm:ss`,
 * optionally with a decimal fraction of a second, followed by `Z` or a
 * `±hh:mm` offset. Both the W3C Datetime profile that the sitemap protocol
 * uses and the protocol's XML schema accept this form.
 *
 * The type checks the shape only. {@link validateSitemap} checks the field
 * ranges and that the value is not in the future.
 *
 * @example "2024-01-15T10:30:00Z"
 * @example "2024-01-15T10:30:00.123+05:30"
 */
export type IsoDateTime = `${IsoDate}T${number}:${number}:${number}${TimeZone}`;

/**
 * Value accepted by `lastmod`: a date, or a date and time with seconds and
 * a time zone.
 *
 * @example "2024-01-15"
 * @example "2024-01-15T10:30:00Z"
 */
export type IsoDateOrDateTime = IsoDate | IsoDateTime;

/**
 * How frequently a page is likely to change.
 *
 * @remarks
 * Google ignores this value; other engines may use it as a hint.
 * Prefer an accurate `lastmod`.
 */
export type SitemapChangeFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

/**
 * A single URL entry in the sitemap.
 *
 * Combined with the `origin` from {@link SitemapOptions} to produce the full URL.
 */
export interface SitemapUrl {
  /**
   * Path of the URL relative to `origin`, starting with "/".
   * Must not contain a fragment (`#...`), which crawlers ignore.
   *
   * @example "/about"
   */
  path: UrlPath;
  /**
   * Last modification date, as `YYYY-MM-DD` or as a date and time with
   * seconds and a time zone (`YYYY-MM-DDThh:mm:ss[.s]` followed by `Z` or
   * `±hh:mm`). Must not be in the future.
   *
   * @example "2024-01-15"
   * @example "2024-01-15T10:30:00Z"
   */
  lastmod?: IsoDateOrDateTime | undefined;
  /**
   * How frequently the page is likely to change.
   *
   * @remarks
   * Google ignores this value; other engines may use it as a hint.
   */
  changefreq?: SitemapChangeFreq | undefined;
  /**
   * Priority relative to other URLs on the site, from 0.0 to 1.0 with at
   * most one decimal place (e.g. 0.5, 0.8).
   *
   * @remarks
   * Google ignores this value; other engines may use it as a hint.
   */
  priority?: number | undefined;
}

/**
 * Configuration options for sitemap generation.
 *
 * @see https://www.sitemaps.org/protocol.html
 */
export interface SitemapOptions {
  /**
   * The base URL shared by all URLs: scheme and host, optionally followed
   * by a path prefix. Must not contain a query, fragment or credentials.
   * A trailing slash is ignored, so with a path prefix the entry `path: "/"`
   * yields `"<prefix>/"`. To list the prefix URL without a trailing slash,
   * use the bare origin and full paths instead.
   *
   * @example "https://example.com"
   * @example "https://example.com/blog"
   */
  origin: AbsoluteUrl;
  /**
   * List of URL paths to include in the sitemap. At least one entry is
   * required; a single sitemap may hold at most 50,000 URLs and 50 MB.
   *
   * @example [{ path: "/" }, { path: "/about", priority: 0.8 }]
   */
  urls: NonEmptyArray<SitemapUrl>;
}
