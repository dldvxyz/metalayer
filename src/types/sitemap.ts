import type { AbsoluteUrl, NonEmptyArray } from "./_shared";

/** ISO 8601 date: YYYY-MM-DD */
type IsoDateString = `${number}-${number}-${number}`;

/** ISO 8601 datetime: YYYY-MM-DDThh:mm:ssZ or with timezone offset */
type IsoDateTimeString =
  `${number}-${number}-${number}T${number}:${number}:${number}${string}`;

/** ISO 8601 date or datetime */
export type IsoDate = IsoDateString | IsoDateTimeString;

export type SitemapChangeFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface SitemapUrl {
  /** Absolute URL of the page */
  loc: AbsoluteUrl;
  /** Last modification date in ISO 8601 format (e.g. "2024-01-15") */
  lastmod?: IsoDate;
  /** How frequently the page is likely to change */
  changefreq?: SitemapChangeFreq;
  /** Priority relative to other URLs on the site, 0.0 to 1.0 */
  priority?: number;
}

export interface SitemapOptions {
  /** List of URLs to include in the sitemap */
  urls: NonEmptyArray<SitemapUrl>;
  /** Pretty-print the XML output (default: true) */
  pretty?: boolean;
}
