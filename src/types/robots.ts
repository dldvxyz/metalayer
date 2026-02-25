import type { AbsoluteUrl, NonEmptyArray, UrlPath } from "./_shared.js";

/**
 * User-agent identifier for robots.txt rules.
 *
 * Use `"*"` to target all crawlers, or specify a known bot name.
 * Common bots are provided as autocomplete suggestions, but any
 * custom string is accepted.
 *
 * @example ["*"]
 * @example ["Googlebot"]
 * @example ["Googlebot", "Bingbot"]
 * @see {@link RobotsRule}
 */
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

// Base fields shared by all rule variants. RobotsRule extends this with an allow/disallow union.
interface RobotsRuleBase {
  /**
   * One or more user-agent strings this rule applies to.
   *
   * Must be a non-empty array. Use `["*"]` to target all crawlers.
   * Do not mix `"*"` with specific agents in the same rule — use
   * separate rules instead.
   *
   * @example ["*"]
   * @example ["Googlebot", "Bingbot"]
   */
  userAgent: NonEmptyArray<UserAgent>;
  /**
   * Crawl delay in seconds. Must be a positive number.
   *
   * Tells compliant crawlers to wait this many seconds between requests.
   * Not all crawlers respect this directive.
   */
  crawlDelay?: number;
}

/**
 * A single robots.txt rule group.
 *
 * At least one of `allow` or `disallow` must be provided.
 * Both can be present simultaneously.
 *
 * @example { userAgent: ["*"], disallow: ["/"] }
 * @example { userAgent: ["Googlebot"], allow: ["/public"], disallow: ["/private"] }
 * @see {@link RobotsOptions}
 */
export type RobotsRule = RobotsRuleBase &
  (
    | {
        /**
         * Paths the specified user-agents are allowed to crawl.
         * Each path must start with `/`.
         *
         * @example ["/"]
         * @example ["/public", "/assets"]
         */
        allow: NonEmptyArray<UrlPath>;
        /**
         * Paths the specified user-agents are not allowed to crawl.
         * Each path must start with `/`.
         */
        disallow?: NonEmptyArray<UrlPath>;
      }
    | {
        /**
         * Paths the specified user-agents are allowed to crawl.
         * Each path must start with `/`.
         */
        allow?: NonEmptyArray<UrlPath>;
        /**
         * Paths the specified user-agents are not allowed to crawl.
         * Each path must start with `/`.
         *
         * @example ["/"]
         * @example ["/admin", "/api"]
         */
        disallow: NonEmptyArray<UrlPath>;
      }
  );

/**
 * Configuration options for robots.txt generation.
 *
 * @see https://www.robotstxt.org/robotstxt.html
 * @example
 * ```ts
 * const options: RobotsOptions = {
 *   rules: [
 *     { userAgent: ["*"], allow: ["/"] },
 *     { userAgent: ["GPTBot"], disallow: ["/"] }
 *   ],
 *   sitemaps: ["https://example.com/sitemap.xml"]
 * };
 * ```
 */
export interface RobotsOptions {
  /**
   * One or more user-agent rule groups. At least one rule is required.
   */
  rules: NonEmptyArray<RobotsRule>;
  /**
   * Absolute URL(s) to sitemap(s).
   *
   * All URLs must be valid, share the same origin, and be unique.
   *
   * @example ["https://example.com/sitemap.xml"]
   */
  sitemaps?: NonEmptyArray<AbsoluteUrl>;
  /**
   * Host directive (primarily used by Yandex).
   *
   * @example "example.com"
   */
  host?: string;
}
