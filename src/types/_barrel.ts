/**
 * Public type definitions for metalayer.
 *
 * @module
 */

export type {
  AbsoluteUrl,
  NonEmptyArray,
  NonUnitaryArray,
  UrlPath,
  ValidationResult
} from "./_shared.js";

export type {
  CssColor,
  ImageMimeType,
  ImagePurpose,
  ImageSize,
  ManifestDisplay,
  ManifestDisplayOverride,
  ManifestFileHandler,
  ManifestImageResource,
  ManifestImageResourceBase,
  ManifestLaunchHandler,
  ManifestOptions,
  ManifestOrientation,
  ManifestProtocolHandler,
  ManifestRelatedApplication,
  ManifestScreenshot,
  ManifestShareTarget,
  ManifestShortcut,
  UrlOrPath
} from "./manifest.js";

export type {
  RobotsOptions,
  RobotsRule,
  UserAgent
} from "./robots.js";

export type {
  IsoDate,
  IsoDateOrDateTime,
  IsoDateTime,
  SitemapChangeFreq,
  SitemapOptions,
  SitemapUrl
} from "./sitemap.js";
