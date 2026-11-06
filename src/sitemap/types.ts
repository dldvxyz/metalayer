import type { AbsoluteUrl, NonEmptyArray, UrlPath } from "../shared/types.js";

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type Month = `0${Exclude<Digit, "0">}` | `1${"0" | "1" | "2"}`;
type Day = `${"0" | "1" | "2"}${Digit}` | `3${"0" | "1"}`;
type TimeZone = "Z" | `+${number}:${number}` | `-${number}:${number}`;
type Seconds = `:${number}${"" | `.${number}`}`;

/**
 * Calendar date: `YYYY-MM-DD`.
 *
 * The month and day positions are checked at the type level; calendar
 * validity (e.g. February 30) is checked by {@link validateSitemap}.
 *
 * @example "2024-01-15"
 */
export type IsoDate = `${number}-${Month}-${Day}`;

/**
 * Date and time with a mandatory time zone: `YYYY-MM-DDThh:mm[:ss[.s]]`
 * followed by `Z` or a `±hh:mm` offset (W3C Datetime, as used by the
 * sitemap protocol).
 *
 * @example "2024-01-15T10:30:00Z"
 * @example "2024-01-15T10:30:00.123+05:30"
 * @example "2024-01-15T10:30Z"
 */
export type IsoDateTime =
  `${IsoDate}T${number}:${number}${"" | Seconds}${TimeZone}`;

/**
 * W3C Datetime value accepted by `lastmod`: a date, or a date and time
 * with a time zone.
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
   * Path component of the URL, starting with "/".
   * Combined with the `origin` option to form the full URL.
   * Must not contain a fragment (`#...`), which crawlers ignore.
   *
   * @example "/sitemap"
   */
  path: UrlPath;
  /**
   * Last modification date, as `YYYY-MM-DD` or a datetime with a time zone
   * (`YYYY-MM-DDThh:mm[:ss[.s]]Z` or `±hh:mm`). Must not be in the future.
   *
   * @example "2024-01-15"
   * @example "2024-01-15T10:30:00Z"
   */
  lastmod?: IsoDateOrDateTime;
  /**
   * How frequently the page is likely to change.
   *
   * @remarks
   * Google ignores this value; other engines may use it as a hint.
   */
  changefreq?: SitemapChangeFreq;
  /**
   * Priority relative to other URLs on the site, from 0.0 to 1.0 with at
   * most one decimal place (e.g. 0.5, 0.8).
   *
   * @remarks
   * Google ignores this value; other engines may use it as a hint.
   */
  priority?: number;
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
   * A trailing slash is ignored.
   *
   * @example "https://example.com"
   * @example "https://example.com/blog"
   */
  origin: AbsoluteUrl;
  /**
   * List of URL paths to include in the sitemap. At least one entry is
   * required and a single sitemap may hold at most 50,000 URLs.
   *
   * @example [{ path: "/" }, { path: "/about", priority: 0.8 }]
   */
  urls: NonEmptyArray<SitemapUrl>;
}
