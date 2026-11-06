/**
 * Validation of robots.txt configurations.
 *
 * @module
 */

import type { ValidationResult } from "../shared/types.js";
import { hasControlCharacters, validateUrl } from "../shared/url.js";
import type { RobotsOptions, RobotsRule } from "./types.js";

/**
 * RFC 9309 (section 2.2.1) product token: letters, "_" and "-". Digits are
 * tolerated as well because widely deployed crawlers use them (e.g. "360Spider").
 */
const PRODUCT_TOKEN_RX = /^[A-Za-z0-9_-]+$/u;

/** Matches a percent-encoded octet and captures its two hex digits. */
const PERCENT_OCTET_RX = /%(?<hex>[0-9a-fA-F]{2})/gu;

/** Matches a single RFC 3986 unreserved character. */
const UNRESERVED_CHAR_RX = /^[A-Za-z0-9._~-]$/u;

/** Matches any non-ASCII code point. */
const NON_ASCII_RX = /[\u0080-\u{10FFFF}]/gu;

/** Matches an optional http(s) scheme prefix on a host value. */
const HOST_SCHEME_RX = /^https?:\/\//u;

/**
 * Canonicalizes a robots.txt path pattern for comparison, following
 * RFC 9309 section 2.2.2: non-ASCII characters are percent-encoded as
 * UTF-8, percent-encoded unreserved ASCII characters are decoded, and the
 * hex digits of the remaining escapes are uppercased.
 *
 * `*`, `$` and `?` are left untouched because they are matched verbatim
 * by crawlers; the WHATWG URL parser must not be used here because it
 * drops a trailing "?" and resolves ".." segments, neither of which a
 * robots.txt matcher does.
 *
 * @param pattern - The path pattern to canonicalize.
 * @returns The canonical form, or the pattern unchanged if it cannot be encoded.
 */
function canonicalizePattern(pattern: string): string {
  try {
    return pattern
      .replaceAll(NON_ASCII_RX, (char) => encodeURIComponent(char))
      .replaceAll(PERCENT_OCTET_RX, (match, hex: string) => {
        const char = String.fromCodePoint(Number.parseInt(hex, 16));
        return UNRESERVED_CHAR_RX.test(char) ? char : match.toUpperCase();
      });
  } catch {
    return pattern;
  }
}

/**
 * Checks a path pattern against the RFC 9309 path-pattern grammar.
 *
 * @param path - The pattern to check.
 * @returns A description of the problem, or `undefined` if the pattern is valid.
 */
function getPathPatternIssue(path: string): string | undefined {
  if (!path.startsWith("/")) return 'must start with "/"';
  if (hasControlCharacters(path)) {
    return "contains a control character such as a line break";
  }
  if (path.includes(" ")) return 'contains a space. Percent-encode it as "%20"';
  if (path.includes("#")) {
    return 'contains "#", which starts a comment in robots.txt. Percent-encode it as "%23"';
  }
  const anchor = path.indexOf("$");
  if (anchor !== -1 && anchor !== path.length - 1) {
    return 'contains "$" before the end. "$" anchors the end of a pattern; percent-encode a literal one as "%24"';
  }
  return undefined;
}

/**
 * Checks a user-agent value against the RFC 9309 product-token grammar.
 *
 * @param agent - The user-agent value to check.
 * @returns A description of the problem, or `undefined` if the value is valid.
 */
function getUserAgentIssue(agent: string): string | undefined {
  if (agent === "*") return undefined;
  if (agent.length === 0) return "is empty";
  if (!PRODUCT_TOKEN_RX.test(agent)) {
    return 'is not a valid product token. Use letters, digits, "_" and "-" only (e.g. "Googlebot"), not a full User-Agent header string';
  }
  return undefined;
}

/**
 * Validates the user agents of one rule: token syntax, duplicates within
 * the rule and across rules, and wildcard mixing.
 */
function validateUserAgents(
  agents: readonly string[],
  label: string,
  seenAgents: Set<string>,
  issues: string[]
): void {
  if (agents.length === 0) {
    issues.push(
      `${label} has no user agents. Use ["*"] to target all crawlers.`
    );
    return;
  }

  const seenInRule = new Set<string>();
  for (const agent of agents) {
    const problem = getUserAgentIssue(agent);
    if (problem !== undefined) {
      issues.push(`User agent ${JSON.stringify(agent)} ${problem}.`);
    }

    // Crawlers match product tokens case-insensitively (RFC 9309, section 2.2.1)
    const key = agent.toLowerCase();
    if (seenInRule.has(key)) {
      issues.push(
        `User agent ${JSON.stringify(agent)} is listed twice in the same rule.`
      );
    } else if (seenAgents.has(key)) {
      issues.push(
        `Duplicate user agent ${JSON.stringify(agent)} found across multiple rules. Combine rules for the same agent into one.`
      );
    }
    seenInRule.add(key);
    seenAgents.add(key);
  }

  // Check that wildcard "*" is not mixed with specific agents in the same rule
  const specific = agents.filter((agent) => agent !== "*");
  if (specific.length > 0 && specific.length < agents.length) {
    issues.push(
      `Rule has wildcard "*" mixed with specific user agents: ${specific.join(", ")}. Use "*" alone or list specific agents without "*".`
    );
  }
}

/**
 * Validates the allow/disallow patterns of one rule and detects patterns
 * that appear in both lists.
 */
function validatePaths(
  rule: RobotsRule,
  label: string,
  issues: string[]
): void {
  const allows: readonly string[] = rule.allow ?? [];
  const disallows: readonly string[] = rule.disallow ?? [];

  if (allows.length === 0 && disallows.length === 0) {
    issues.push(
      `The rule for ${label} has neither Allow nor Disallow paths. An empty group implicitly allows everything.`
    );
    return;
  }

  for (const [directive, paths] of [
    ["Allow", allows],
    ["Disallow", disallows]
  ] as const) {
    for (const path of paths) {
      const problem = getPathPatternIssue(path);
      if (problem !== undefined) {
        issues.push(
          `${directive} path ${JSON.stringify(path)} for ${label} ${problem}.`
        );
      }
    }
  }

  // Identical patterns in both lists are ambiguous. RFC 9309 resolves the tie
  // in favour of Allow, which is rarely what the author meant.
  const canonicalDisallows = new Set(disallows.map(canonicalizePattern));
  const overlapping = allows.filter((path) =>
    canonicalDisallows.has(canonicalizePattern(path))
  );
  if (overlapping.length > 0) {
    issues.push(
      `Path(s) ${overlapping.map((path) => JSON.stringify(path)).join(", ")} appear in both Allow and Disallow for ${label}.`
    );
  }
}

/** Validates one rule group. */
function validateRule(
  rule: RobotsRule,
  index: number,
  seenAgents: Set<string>,
  issues: string[]
): void {
  const agents = rule.userAgent;
  const label =
    agents.length > 0
      ? `user agent ${agents.join(", ")}`
      : `Rule #${index + 1}`;

  validateUserAgents(agents, label, seenAgents, issues);
  validatePaths(rule, label, issues);

  // Crawl delay must be a positive whole number of seconds
  if (
    rule.crawlDelay !== undefined &&
    (!Number.isSafeInteger(rule.crawlDelay) || rule.crawlDelay <= 0)
  ) {
    issues.push(
      `Crawl delay ${rule.crawlDelay} for ${label} must be a positive integer number of seconds.`
    );
  }
}

/** Validates sitemap URLs: must be valid http(s) URLs, no duplicates after normalization. */
function validateSitemaps(sitemaps: readonly string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const rawUrl of sitemaps) {
    const parsed = validateUrl(rawUrl);
    if (!parsed) {
      issues.push(`Sitemap URL "${rawUrl}" is not a valid absolute URL.`);
      continue;
    }
    if (seen.has(parsed.href)) {
      issues.push(`Duplicate sitemap URL "${parsed.href}".`);
    }
    seen.add(parsed.href);
  }
}

/**
 * Validates the Host directive: a bare hostname, optionally prefixed with
 * an http(s) scheme, without path, query, fragment or credentials.
 * Internationalized domain names are accepted in Unicode or Punycode form.
 */
function validateHost(host: string, issues: string[]): void {
  const parsed = validateUrl(
    HOST_SCHEME_RX.test(host) ? host : "https://" + host
  );
  const isBareHost =
    parsed !== undefined &&
    parsed.pathname === "/" &&
    !host.endsWith("/") &&
    parsed.search === "" &&
    parsed.hash === "" &&
    parsed.username === "" &&
    parsed.password === "";
  if (!isBareHost) {
    issues.push(
      `Host "${host}" is not a valid hostname. Provide a bare hostname such as "example.com", optionally prefixed with "https://".`
    );
  }
}

/**
 * Validates a robots.txt configuration for common mistakes.
 *
 * Checks performed:
 * - Each rule has at least one user agent and at least one Allow or Disallow path
 * - User agents are valid product tokens (RFC 9309, section 2.2.1)
 * - Wildcard `"*"` is not mixed with specific agents in the same rule
 * - No duplicate user agents within a rule or across rules (case-insensitive)
 * - Path patterns start with `/` and contain no control characters, spaces,
 *   `#` (starts a comment) or a `$` before the end (RFC 9309, section 2.2.3)
 * - No identical patterns in Allow and Disallow within the same rule
 * - Crawl delay is a positive integer
 * - Sitemap URLs (if provided) are valid absolute http(s) URLs and unique
 * - Host (if provided) is a bare hostname
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

  if (options.rules.length === 0) {
    issues.push("At least one rule is required.");
  }
  for (const [index, rule] of options.rules.entries()) {
    validateRule(rule, index, seenAgents, issues);
  }

  if (options.sitemaps) validateSitemaps(options.sitemaps, issues);
  // oxlint-disable-next-line typescript/no-deprecated -- still supported for compatibility
  if (options.host !== undefined) validateHost(options.host, issues);

  if (issues.length > 0) return { valid: false, issues };
  return { valid: true, options };
}
