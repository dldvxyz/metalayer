import type { AbsoluteUrl, NonEmptyArray, UrlPath } from "./_shared.js";

/** ISO 8601 date: YYYY-MM-DD */
export type IsoDate = `${number}-${number}-${number}`;

/** ISO 8601 datetime: YYYY-MM-DDThh:mm:ssZ or with timezone offset */
export type IsoDateTime =
  `${number}-${number}-${number}T${number}:${number}:${number}${string}`;

/**
 * ISO 8601 date or datetime.
 *
 * @example "2024-01-15"
 * @example "2024-01-15T10:30:00Z"
 */
export type IsoDateOrDateTime = IsoDate | IsoDateTime;

/** How frequently a page is likely to change, as a hint to crawlers. */
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
   *
   * @example "/sitemap"
   */
  path: UrlPath;
  /** Last modification date in ISO 8601 format (e.g. "2024-01-15") */
  lastmod?: IsoDateOrDateTime;
  /** How frequently the page is likely to change */
  changefreq?: SitemapChangeFreq;
  /** Priority relative to other URLs on the site, from 0.0 to 1.0 with at most one decimal place (e.g. 0.5, 0.8). */
  priority?: number;
}

/**
 * Configuration options for sitemap generation.
 *
 * @see https://www.sitemaps.org/protocol.html
 */
export interface SitemapOptions {
  /**
   * The origin shared by all URLs.
   *
   * @example "https://example.com"
   */
  origin: AbsoluteUrl;
  /**
   * List of URL paths to include in the sitemap.
   *
   * @example [{ path: "/" }, { path: "/about", priority: 0.8 }]
   */
  urls: NonEmptyArray<SitemapUrl>;
}
