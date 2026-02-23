import type { ValidationResult } from "./types/_shared.js";
import type { RobotsOptions } from "./types/robots.js";

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function validateRobotsTxt(
  options: RobotsOptions
): ValidationResult<RobotsOptions> {
  const issues: string[] = [];
  const seenAgents = new Set<string>();

  for (const rule of options.rules) {
    const agents = toArray(rule.userAgent);

    // Check for * mixed with specific agents in the same rule
    if (agents.length > 1 && agents.includes("*")) {
      issues.push(
        `Rule has wildcard "*" mixed with specific user agents: ${agents.filter((a) => a !== "*").join(", ")}. Use "*" alone or list specific agents without "*".`
      );
    }

    // Check for duplicate user agents across rules
    for (const agent of agents) {
      if (seenAgents.has(agent)) {
        issues.push(
          `Duplicate user agent "${agent}" found across multiple rules. Combine rules for the same agent into one.`
        );
      }
      seenAgents.add(agent);
    }

    // Check for overlapping paths in allow and disallow
    const allows = toArray(rule.allow);
    const disallows = toArray(rule.disallow);
    const overlapping = allows.filter((p) => disallows.includes(p));

    if (overlapping.length > 0) {
      issues.push(
        `Path(s) ${overlapping.map((p) => `"${p}"`).join(", ")} appear in both Allow and Disallow for user agent ${agents.join(", ")}.`
      );
    }
  }

  if (issues.length > 0) return { valid: false, issues };
  return { valid: true, options };
}

export function generateRobotsTxt(options: RobotsOptions) {
  const lines: string[] = [];

  for (const rule of options.rules) {
    const agents = toArray(rule.userAgent);

    for (const agent of agents) {
      lines.push(`User-agent: ${agent}`);
    }

    if (rule.allow !== undefined) {
      for (const path of toArray(rule.allow)) {
        lines.push(`Allow: ${path}`);
      }
    }

    if (rule.disallow !== undefined) {
      for (const path of toArray(rule.disallow)) {
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
      lines.push(`Sitemap: ${url}`);
    }
  }

  if (options.host) {
    lines.push(`Host: ${options.host}`);
  }

  return lines.join("\n").trim();
}
