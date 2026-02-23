import type {
  AbsoluteUrl,
  NonEmptyArray,
  NonUnitaryArray,
  PathString
} from "./_shared";

export type UserAgent =
  | "*"
  | "Googlebot"
  | "Bingbot"
  | "Slurp"
  | "DuckDuckBot"
  | "Baiduspider"
  | "YandexBot"
  | "Applebot"
  | "GPTBot"
  | "ChatGPT-User"
  | "CCBot"
  | "anthropic-ai"
  | "ClaudeBot"
  | "Google-Extended"
  | (string & {});

interface RobotsRuleBase {
  /** User agents that the rules apply to
   *
   * @argument Single string or an array of at least 2
   */
  userAgent: UserAgent | NonUnitaryArray<UserAgent>;
  /** Crawl delay in seconds */
  crawlDelay?: number;
}

export type RobotsRule = RobotsRuleBase &
  (
    | {
        allow: PathString | NonUnitaryArray<PathString>;
        disallow?: PathString | NonUnitaryArray<PathString>;
      }
    | {
        allow?: PathString | NonUnitaryArray<PathString>;
        disallow: PathString | NonUnitaryArray<PathString>;
      }
  );

export interface RobotsOptions {
  /** One or more user-agent rule groups */
  rules: NonEmptyArray<RobotsRule>;
  /** Absolute URL(s) to sitemap(s) */
  sitemaps?: NonEmptyArray<AbsoluteUrl>;
  /** Host directive (used by Yandex) */
  host?: string;
}
