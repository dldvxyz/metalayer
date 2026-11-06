import type { AbsoluteUrl, NonEmptyArray, UrlPath } from "../shared/types.js";

/**
 * User-agent product token for robots.txt rules.
 *
 * Use `"*"` to target all crawlers, or specify a crawler's product token.
 * Well-known tokens are provided as autocomplete suggestions, but any
 * custom string is accepted. Tokens are matched case-insensitively by
 * crawlers (RFC 9309, section 2.2.1).
 *
 * Use the product token, not a full `User-Agent` header string:
 * `"Googlebot"`, not `"Mozilla/5.0 (compatible; Googlebot/2.1; ...)"`.
 *
 * @remarks
 * `"ChatGPT-User"` and `"Claude-User"` identify user-initiated fetches;
 * their operators state that robots.txt rules may not apply to them.
 *
 * @example ["*"]
 * @example ["Googlebot"]
 * @example ["Googlebot", "Bingbot"]
 * @see {@link RobotsRule}
 */
export type UserAgent =
  | "*"
  // Search engines
  | "Googlebot"
  | "Googlebot-Image"
  | "Googlebot-News"
  | "Googlebot-Video"
  | "Google-InspectionTool"
  | "Storebot-Google"
  | "GoogleOther"
  | "Bingbot"
  | "Slurp"
  | "DuckDuckBot"
  | "Baiduspider"
  | "YandexBot"
  | "Applebot"
  // AI training and AI search
  | "GPTBot"
  | "ChatGPT-User"
  | "OAI-SearchBot"
  | "ClaudeBot"
  | "Claude-User"
  | "Claude-SearchBot"
  | "Google-Extended"
  | "Applebot-Extended"
  | "PerplexityBot"
  | "Perplexity-User"
  | "Amazonbot"
  | "Bytespider"
  | "CCBot"
  | "meta-externalagent"
  // SEO tools and link previews
  | "AhrefsBot"
  | "SemrushBot"
  | "facebookexternalhit"
  | "Twitterbot"
  | "LinkedInBot"
  | (string & Record<never, never>);

/**
 * A robots.txt path pattern.
 *
 * Must start with `/`. May use `*` as a wildcard and `$` as the end-of-URL
 * anchor (RFC 9309, section 2.2.3). Spaces, `#` and a literal `$` that is
 * not at the end must be percent-encoded (`%20`, `%23`, `%24`).
 *
 * @example "/"
 * @example "/private/"
 * @example "/*.pdf$"
 */
export type RobotsPath = UrlPath;

// Base fields shared by all rule variants. RobotsRule extends this with an allow/disallow union.
interface RobotsRuleBase {
  /**
   * One or more user-agent product tokens this rule applies to.
   *
   * Must be a non-empty array. Use `["*"]` to target all crawlers.
   * Do not mix `"*"` with specific agents in the same rule; use
   * separate rules instead.
   *
   * @example ["*"]
   * @example ["Googlebot", "Bingbot"]
   */
  userAgent: NonEmptyArray<UserAgent>;
  /**
   * Crawl delay in whole seconds. Must be a positive integer.
   *
   * Non-standard directive. Google and Yandex ignore it; Bing honours
   * positive integers and recommends values of 10 or less.
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
         * Path patterns the specified user-agents are allowed to crawl.
         *
         * @example ["/"]
         * @example ["/public", "/assets"]
         * @see {@link RobotsPath}
         */
        allow: NonEmptyArray<RobotsPath>;
        /**
         * Path patterns the specified user-agents are not allowed to crawl.
         * @see {@link RobotsPath}
         */
        disallow?: NonEmptyArray<RobotsPath>;
      }
    | {
        /**
         * Path patterns the specified user-agents are allowed to crawl.
         * @see {@link RobotsPath}
         */
        allow?: NonEmptyArray<RobotsPath>;
        /**
         * Path patterns the specified user-agents are not allowed to crawl.
         *
         * @example ["/"]
         * @example ["/admin", "/api"]
         * @see {@link RobotsPath}
         */
        disallow: NonEmptyArray<RobotsPath>;
      }
  );

/**
 * Configuration options for robots.txt generation.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9309 — Robots Exclusion Protocol
 * @see https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt — Google's interpretation
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
   * Absolute URL(s) of sitemap(s).
   *
   * All URLs must be valid http(s) URLs and unique. They do not have to
   * share the host of the robots.txt file; cross-host sitemaps are allowed.
   *
   * @example ["https://example.com/sitemap.xml"]
   */
  sitemaps?: NonEmptyArray<AbsoluteUrl>;
  /**
   * Host directive naming the preferred mirror.
   *
   * @deprecated Yandex, the crawler that read this directive, dropped
   * support for it in 2018. Use a 301 redirect to your canonical host
   * instead. Still validated and emitted for compatibility.
   * @example "example.com"
   */
  host?: string;
}
