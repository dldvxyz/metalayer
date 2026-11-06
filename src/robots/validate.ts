/**
 * Validation of robots.txt configurations.
 *
 * @module
 */

import { utf8ByteLength } from "../shared/text.js";
import type { ValidationResult } from "../shared/types.js";
import {
  canonicalizePercentEncoding,
  hasControlCharacters
} from "../shared/url.js";
import { generateRobotsTxt } from "./generate.js";
import type { RobotsOptions, RobotsRule } from "./types.js";
import { hasLineBreakOrControl, parseHost } from "./values.js";

/**
 * Product token. RFC 9309 (section 2.2.1) allows letters, "_" and "-";
 * digits and "." are tolerated as well because deployed crawlers use them
 * (e.g. "360Spider", "archive.org_bot").
 */
const PRODUCT_TOKEN_RX = /^[A-Za-z\d._-]+$/u;

/** Matches an unpaired UTF-16 surrogate, which cannot be encoded as UTF-8. */
const LONE_SURROGATE_RX = /\p{Cs}/u;

/**
 * Google ignores robots.txt content after 500 KiB, the minimum parsing
 * limit that RFC 9309 (section 2.5) sets.
 */
const MAX_ROBOTS_BYTES = 500 * 1024;

/** How a rule is referred to in issue messages. */
interface RuleName {
  /** Used mid-sentence, e.g. "for user agent Googlebot". */
  label: string;
  /** Used at the start of a sentence, e.g. "The rule for user agent Googlebot". */
  subject: string;
}

/** Names a rule after its user agents, or after its position when it has none. */
function nameRule(rule: RobotsRule, index: number): RuleName {
  if (rule.userAgent.length === 0) {
    return { label: `rule #${index + 1}`, subject: `Rule #${index + 1}` };
  }
  const label = `user agent ${rule.userAgent.join(", ")}`;
  return { label, subject: `The rule for ${label}` };
}

/**
 * Checks a path pattern against the RFC 9309 path-pattern grammar.
 *
 * @param path - The pattern to check.
 * @returns A description of the problem, or `undefined` if the pattern is valid.
 */
function getPathPatternIssue(path: string): string | undefined {
  if (!path.startsWith("/")) return 'must start with "/"';
  if (hasLineBreakOrControl(path)) {
    return "contains a control character or line break";
  }
  if (LONE_SURROGATE_RX.test(path)) {
    return "contains an unpaired surrogate, which is not valid Unicode";
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
 * Checks a user-agent value against the product-token grammar.
 *
 * @param agent - The user-agent value to check.
 * @returns A description of the problem, or `undefined` if the value is valid.
 */
function getUserAgentIssue(agent: string): string | undefined {
  if (agent === "*") return undefined;
  if (agent.length === 0) return "is empty";
  if (!PRODUCT_TOKEN_RX.test(agent)) {
    return 'is not a valid product token. Use letters, digits, ".", "_" and "-" only (e.g. "Googlebot"), not a full User-Agent header string';
  }
  return undefined;
}

/**
 * Validates the user agents of one rule: token syntax, duplicates within
 * the rule and across rules, and wildcard mixing.
 */
function validateUserAgents(
  agents: readonly string[],
  name: RuleName,
  seenAgents: Set<string>,
  issues: string[]
): void {
  if (agents.length === 0) {
    issues.push(
      `${name.subject} has no user agents. Use ["*"] to target all crawlers.`
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

  const specific = agents.filter((agent) => agent !== "*");
  if (specific.length > 0 && specific.length < agents.length) {
    issues.push(
      `${name.subject} mixes the wildcard "*" with specific user agents (${specific.join(", ")}). Use "*" alone or list the specific agents without "*".`
    );
  }
}

/**
 * Validates the allow/disallow patterns of one rule and detects patterns
 * that appear in both lists.
 */
function validatePaths(
  rule: RobotsRule,
  name: RuleName,
  issues: string[]
): void {
  const allows: readonly string[] = rule.allow ?? [];
  const disallows: readonly string[] = rule.disallow ?? [];

  if (allows.length === 0 && disallows.length === 0) {
    issues.push(
      `${name.subject} has neither Allow nor Disallow paths. Crawlers merge a group without rules into the next group; use allow: ["/"] to allow everything.`
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
          `${directive} path ${JSON.stringify(path)} for ${name.label} ${problem}.`
        );
      }
    }
  }

  // Equivalent patterns in both lists are ambiguous. RFC 9309 resolves the
  // tie in favour of Allow, which is rarely what the author meant.
  const disallowsByKey = new Map<string, string>();
  for (const path of disallows) {
    const key = canonicalizePercentEncoding(path);
    if (!disallowsByKey.has(key)) disallowsByKey.set(key, path);
  }
  for (const allow of allows) {
    const disallow = disallowsByKey.get(canonicalizePercentEncoding(allow));
    if (disallow === undefined) continue;
    issues.push(
      disallow === allow
        ? `Path ${JSON.stringify(allow)} appears in both Allow and Disallow for ${name.label}.`
        : `Allow ${JSON.stringify(allow)} and Disallow ${JSON.stringify(disallow)} are the same pattern for ${name.label}.`
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
  const name = nameRule(rule, index);

  validateUserAgents(rule.userAgent, name, seenAgents, issues);
  validatePaths(rule, name, issues);

  // Crawl delay must be a positive whole number of seconds
  if (
    rule.crawlDelay !== undefined &&
    (!Number.isSafeInteger(rule.crawlDelay) || rule.crawlDelay <= 0)
  ) {
    issues.push(
      `Crawl delay ${rule.crawlDelay} for ${name.label} must be a positive integer number of seconds.`
    );
  }
}

/**
 * Checks a sitemap URL for a Sitemap directive.
 *
 * @param rawUrl - The URL as configured.
 * @returns A description of the problem, or `undefined` if the URL is valid.
 */
function getSitemapIssue(rawUrl: string): string | undefined {
  if (hasControlCharacters(rawUrl)) {
    return "contains a control character such as a line break";
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "is not a valid URL";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "must use http or https";
  }
  if (parsed.pathname.includes("//")) return 'has "//" in its path';
  if (parsed.username !== "" || parsed.password !== "") {
    return "must not contain credentials; robots.txt is public";
  }
  if (rawUrl.includes("#")) {
    return 'contains "#", which starts a comment in robots.txt';
  }
  return undefined;
}

/** Validates sitemap URLs and reports duplicates after normalization. */
function validateSitemaps(sitemaps: readonly string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const rawUrl of sitemaps) {
    const problem = getSitemapIssue(rawUrl);
    if (problem !== undefined) {
      issues.push(`Sitemap URL ${JSON.stringify(rawUrl)} ${problem}.`);
      continue;
    }
    const { href } = new URL(rawUrl);
    const key = canonicalizePercentEncoding(href);
    if (seen.has(key)) {
      issues.push(`Duplicate sitemap URL "${href}".`);
    }
    seen.add(key);
  }
}

/**
 * Validates a robots.txt configuration for common mistakes.
 *
 * Checks performed:
 * - At least one rule; each rule has at least one user agent and at least
 *   one Allow or Disallow path
 * - User agents are product tokens: RFC 9309 (section 2.2.1) letters, "_"
 *   and "-", plus the digits and "." that deployed crawlers use
 * - Wildcard `"*"` is not mixed with specific agents in the same rule
 * - No duplicate user agents within a rule or across rules (case-insensitive)
 * - Path patterns start with `/` and contain no control characters, line
 *   separators, invalid Unicode, spaces, `#` (starts a comment) or a `$`
 *   before the end (RFC 9309, section 2.2.3)
 * - No equivalent patterns in Allow and Disallow within the same rule
 * - Crawl delay is a positive integer
 * - Sitemap URLs (if provided) are unique http(s) URLs without credentials or fragments
 * - Host (if provided) is a domain name, optionally with an http(s) scheme and a port
 * - The generated file stays within the 500 KiB that Google reads
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

  // An empty host is treated as absent, as the generator does.
  // oxlint-disable-next-line typescript/no-deprecated -- still supported for compatibility
  const { host } = options;
  if (host !== undefined && host !== "" && parseHost(host) === undefined) {
    issues.push(
      `Host ${JSON.stringify(host)} is not a valid hostname. Provide a domain name such as "example.com", optionally with "https://" and a port.`
    );
  }

  if (issues.length > 0) return { valid: false, issues };

  const bytes = utf8ByteLength(generateRobotsTxt(options));
  if (bytes > MAX_ROBOTS_BYTES) {
    return {
      valid: false,
      issues: [
        `The generated robots.txt is ${bytes} bytes. Google ignores everything after ${MAX_ROBOTS_BYTES} bytes (500 KiB).`
      ]
    };
  }
  return { valid: true, options };
}
