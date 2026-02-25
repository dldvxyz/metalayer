/**
 * Validation and generation of robots.txt files.
 *
 * @module
 */

import type { ValidationResult } from "./types/_shared.js";
import type { RobotsOptions } from "./types/robots.js";
import { normalizeUrl, validatePath, validateUrl } from "./utils/url.js";

/**
 * Validates each path in the array and pushes an issue for any invalid path.
 *
 * @param paths - The paths to validate (e.g. allow or disallow values).
 * @param directive - Label for the error message ("Allow" or "Disallow").
 * @param agents - User-agent strings for the error message context.
 * @param issues - Mutable array to push any validation issues into.
 */
function validatePaths(
  paths: readonly string[],
  directive: string,
  agents: readonly string[],
  issues: string[]
): void {
  for (const path of paths) {
    if (!validatePath(path)) {
      issues.push(
        `${directive} path "${path}" for user agent ${agents.join(", ")} is not a valid path.`
      );
    }
  }
}

/**
 * Matches a valid ASCII hostname: one or more labels separated by dots, ending with a 2+ char TLD.
 * Internationalized domain names (IDN) must be Punycode-encoded (e.g. "xn--nxasmq6b.com") to match.
 */
const HOSTNAME_RX = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Validates a robots.txt configuration for common mistakes.
 *
 * Checks performed:
 * - Wildcard `"*"` is not mixed with specific agents in the same rule
 * - No duplicate user agents across rules (case-insensitive)
 * - Allow and disallow paths are valid
 * - No overlapping paths in allow and disallow within the same rule
 * - Crawl delay is a positive finite number
 * - Sitemap URLs (if provided) are valid, same-origin, and unique
 * - Host (if provided) is a valid bare hostname
 *
 * @param options - The robots.txt configuration to validate.
 * @returns `{ valid: true, options }` on success, or
 * `{ valid: false, issues }` with an array of issue descriptions.
 *
 * @example
 * ```ts
 * const result = validateRobotsTxt({
 *   rules: [{ userAgent: ["*"], allow: ["/"] }],
 * });
 * if (!result.valid) console.error(result.issues);
 * ```
 */
export function validateRobotsTxt(
  options: RobotsOptions
): ValidationResult<RobotsOptions> {
  const issues: string[] = [];
  const seenAgents = new Set<string>();

  for (const rule of options.rules) {
    const agents = rule.userAgent;

    // Check that wildcard "*" is not mixed with specific agents in the same rule
    if (agents.length > 1 && agents.includes("*")) {
      issues.push(
        `Rule has wildcard "*" mixed with specific user agents: ${agents.filter((a) => a !== "*").join(", ")}. Use "*" alone or list specific agents without "*".`
      );
    }

    // Check for duplicate user agents across rules (case-insensitive per RFC 9309)
    for (const agent of agents) {
      const key = agent.toLowerCase();
      if (seenAgents.has(key)) {
        issues.push(
          `Duplicate user agent "${agent}" found across multiple rules. Combine rules for the same agent into one.`
        );
      }
      seenAgents.add(key);
    }

    // Validate allow/disallow paths
    const allows: readonly string[] = rule.allow ?? [];
    const disallows: readonly string[] = rule.disallow ?? [];

    validatePaths(allows, "Allow", agents, issues);
    validatePaths(disallows, "Disallow", agents, issues);

    // Crawl delay must be a positive finite number
    if (
      rule.crawlDelay !== undefined &&
      (!Number.isFinite(rule.crawlDelay) || rule.crawlDelay <= 0)
    ) {
      issues.push(
        `Crawl delay ${rule.crawlDelay} for user agent ${agents.join(", ")} must be a positive number.`
      );
    }

    // Detect paths that appear in both allow and disallow after normalization.
    // 1. Build a Set of normalized disallow paths for O(1) lookups.
    // 2. Normalize each allow path into a parallel array (same indices as `allows`).
    // 3. Filter `allows` by checking whether normalizedAllows[i] is in the Set.
    //    This maps back to the original un-normalized path for the error message.
    const normalizedDisallowSet = new Set(disallows.map(normalizeUrl));
    const normalizedAllows = allows.map(normalizeUrl);
    const overlapping = allows.filter((_, i) =>
      normalizedDisallowSet.has(normalizedAllows[i])
    );

    if (overlapping.length > 0) {
      issues.push(
        `Path(s) ${overlapping.map((p) => `"${p}"`).join(", ")} appear in both Allow and Disallow for user agent ${agents.join(", ")}.`
      );
    }
  }

  // Validate sitemap URLs: must be valid, same origin, no duplicates
  if (options.sitemaps) {
    const seenSitemapUrls = new Set<string>();
    let sitemapOrigin: string | undefined;

    for (const rawUrl of options.sitemaps) {
      const parsed = validateUrl(rawUrl);

      if (!parsed) {
        issues.push(`Sitemap URL "${rawUrl}" is not a valid URL.`);
        continue;
      }

      // Check that all sitemap URLs share the same origin
      if (sitemapOrigin === undefined) {
        sitemapOrigin = parsed.origin;
      } else if (parsed.origin !== sitemapOrigin) {
        issues.push(
          `Sitemap URL "${parsed.href}" has a different origin than the other sitemap URLs. All sitemap URLs must share the same origin (${sitemapOrigin}).`
        );
      }

      // Check for duplicate sitemap URLs after normalization
      if (seenSitemapUrls.has(parsed.href)) {
        issues.push(`Duplicate sitemap URL "${parsed.href}".`);
      }
      seenSitemapUrls.add(parsed.href);
    }
  }

  // Validate host: must be a bare hostname (e.g. "example.com")
  if (options.host && !HOSTNAME_RX.test(options.host)) {
    issues.push(
      `Host "${options.host}" is not a valid hostname. Provide a bare hostname without a protocol (e.g. "example.com").`
    );
  }

  if (issues.length > 0) return { valid: false, issues };
  return { valid: true, options };
}

/**
 * Generates a standards-compliant robots.txt string from the given options.
 *
 * Output order per rule: User-agent directives, Allow paths, Disallow paths, Crawl-delay.
 * Rules are separated by blank lines. Sitemap and Host directives appear after all rules.
 * Allow and disallow paths are written verbatim (not normalized) to preserve
 * glob patterns (`*` and `$`) used by crawlers.
 * The output ends with a trailing newline.
 *
 * @remarks
 * This function does not validate the input. Call {@link validateRobotsTxt}
 * first to catch configuration errors. Passing invalid options may produce
 * malformed output.
 *
 * @param options - The robots.txt configuration to generate from.
 * @returns The robots.txt file content as a string.
 *
 * @example
 * ```ts
 * const txt = generateRobotsTxt({
 *   rules: [{ userAgent: ["*"], allow: ["/"] }],
 *   sitemaps: ["https://example.com/sitemap.xml"],
 * });
 * ```
 */
export function generateRobotsTxt(options: RobotsOptions): string {
  const lines: string[] = [];

  // Paths are written verbatim (not normalized) to preserve the user's
  // exact input, including any glob patterns (* and $) used for
  // pattern matching by crawlers.
  for (const rule of options.rules) {
    for (const agent of rule.userAgent) {
      lines.push(`User-agent: ${agent}`);
    }

    if (rule.allow !== undefined) {
      for (const path of rule.allow) {
        lines.push(`Allow: ${path}`);
      }
    }

    if (rule.disallow !== undefined) {
      for (const path of rule.disallow) {
        lines.push(`Disallow: ${path}`);
      }
    }

    if (rule.crawlDelay !== undefined) {
      lines.push(`Crawl-delay: ${rule.crawlDelay}`);
    }

    lines.push("");
  }

  if (options.sitemaps) {
    for (const url of options.sitemaps) {
      lines.push(`Sitemap: ${normalizeUrl(url)}`);
    }
  }

  if (options.host) {
    lines.push(`Host: ${options.host}`);
  }

  return lines.join("\n").trim() + "\n";
}
